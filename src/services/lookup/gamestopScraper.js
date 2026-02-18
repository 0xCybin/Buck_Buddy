// src/services/lookup/gamestopScraper.js
// GameStop product lookup via SKU. Two-tier scraping approach:
//   1. Fast path: direct fetch + regex HTML parsing (~1-3s). Often blocked by WAF (Akamai/Cloudflare).
//   2. Slow path: opens a background tab, injects MAIN world scripts to access window.dataLayer,
//      JSON-LD, and DOM data. Navigates search page -> product detail page (~5-10s).
// Results are cached in chrome.storage.local with a 30-min TTL keyed by "product_cache_{sku}".
// NOTE: Service workers have no DOMParser, so the fast path must use regex to parse HTML.

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Main entry point. Checks cache first, then tries fast path, then slow path.
async function lookupProduct(sku) {
  const cached = await getCached(sku);
  if (cached) return cached;

  const searchUrl = `https://www.gamestop.com/search/?q=${encodeURIComponent(sku)}&type=product`;

  // ── Fast path: direct fetch + regex parse (~1-3s) ──────────────────────
  let product = null;
  try {
    product = await tryDirectFetch(sku, searchUrl);
  } catch {}

  // ── Slow path: background tab, search → product page (~5-10s) ──────────
  if (!product) {
    try {
      product = await tryTabScrape(searchUrl);
    } catch {}
  }

  if (!product) throw new Error('Product not found');

  product.sku = sku;
  if (!product.url) product.url = searchUrl;
  product.platform = extractPlatform(product.name);

  await cacheResult(sku, product);
  return product;
}

// ═════════════════════════════════════════════════════════════════════════════
// FAST PATH — direct fetch, regex parse (no DOM in service worker)
// ═════════════════════════════════════════════════════════════════════════════

// Fast path: fetch the search page HTML directly and parse with regex.
// If the search page lacks structured data, follows the first product link for a second fetch.
// Aborts after 8s per request. Returns null if WAF blocks or no product found.
async function tryDirectFetch(sku, searchUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(searchUrl, { signal: controller.signal });
    if (!response.ok) return null;
    const html = await response.text();

    // Attempt extraction from search results page first
    let product = parseHtmlWithRegex(html, searchUrl);
    if (product) return fixUrls(product);

    // Search page had no structured product data; follow the first product link
    const productUrl = findProductUrlInHtml(html);
    if (productUrl) {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 8000);
      try {
        const resp2 = await fetch(productUrl, { signal: controller2.signal });
        if (resp2.ok) {
          const html2 = await resp2.text();
          product = parseHtmlWithRegex(html2, productUrl);
          if (product) return fixUrls(product);
        }
      } catch {} finally {
        clearTimeout(timeout2);
      }
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Regex scan for the first product detail link in raw HTML.
// Checks absolute URLs first, then relative URLs.
function findProductUrlInHtml(html) {
  const pattern = /href\s*=\s*["'](https?:\/\/www\.gamestop\.com\/[^"']*\/products\/[^"']*\.html)["']/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    return match[1];
  }
  // Also try relative URLs
  const relPattern = /href\s*=\s*["'](\/[^"']*\/products\/[^"']*\.html)["']/gi;
  while ((match = relPattern.exec(html)) !== null) {
    return 'https://www.gamestop.com' + match[1];
  }
  return null;
}

// Parse product data from raw HTML using three strategies in priority order:
//   A) JSON-LD structured data (most reliable, always on product pages)
//   B) OpenGraph meta tags (og:title, og:image, etc.)
//   C) Inline <script> blocks containing JSON with name+price fields
function parseHtmlWithRegex(html, pageUrl) {
  // Convert relative URLs to absolute
  function abs(u) {
    if (!u) return null;
    if (u.startsWith('http')) return u;
    if (u.startsWith('/')) return 'https://www.gamestop.com' + u;
    return u;
  }

  // Strategy A: JSON-LD (most structured — product pages always have this)
  const ldBlocks = html.match(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (ldBlocks) {
    for (const block of ldBlocks) {
      try {
        const jsonStr = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
        const data = JSON.parse(jsonStr);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] === 'Product' || item['@type'] === 'IndividualProduct') {
            const offer = Array.isArray(item.offers) ? item.offers[0] : (item.offers || {});
            return {
              name: item.name || null,
              price: parsePrice(offer.price || offer.lowPrice),
              currency: offer.priceCurrency || 'USD',
              availability: mapAvail(offer.availability),
              image: abs(extractImageFromLd(item)),
              url: abs(item.url) || pageUrl,
              description: (item.description || '').substring(0, 200) || null,
            };
          }
        }
      } catch {}
    }
  }

  // Strategy B: OpenGraph meta tags
  const ogTitle = htmlMetaContent(html, 'og:title');
  if (ogTitle && !ogTitle.toLowerCase().includes('search')) {
    const priceMatch = html.match(/\$\s*(\d{1,4}\.\d{2})/);
    return {
      name: decodeHtmlEntities(ogTitle),
      price: priceMatch ? parseFloat(priceMatch[1]) : null,
      currency: 'USD',
      availability: null,
      image: abs(htmlMetaContent(html, 'og:image')),
      url: abs(htmlMetaContent(html, 'og:url')) || pageUrl,
      description: htmlMetaContent(html, 'og:description')?.substring(0, 200) || null,
    };
  }

  // Strategy C: Inline script JSON with name+price (brute-force scan of all <script> blocks)
  const scriptBlocks = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of scriptBlocks) {
    const inner = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
    if (inner.length < 30 || inner.length > 500000) continue; // skip trivial or huge blocks
    const jsonMatches = inner.match(/\{[^{}]*"name"\s*:\s*"[^"]{5,}[^{}]*"price"\s*:[^{}]*\}/g);
    if (jsonMatches) {
      for (const jm of jsonMatches) {
        try {
          const obj = JSON.parse(jm);
          if (obj.name && obj.price) {
            return {
              name: obj.name,
              price: parsePrice(obj.price),
              currency: obj.currency || 'USD',
              availability: mapAvail(obj.availability),
              image: abs(obj.image || obj.imageUrl),
              url: abs(obj.url) || pageUrl,
              description: null,
            };
          }
        } catch {}
      }
    }
  }

  return null;
}

// Extract image URL from JSON-LD. Handles string, object {url}, or array formats.
function extractImageFromLd(item) {
  if (!item.image) return null;
  if (typeof item.image === 'string') return item.image;
  if (item.image.url) return item.image.url;
  if (Array.isArray(item.image)) {
    for (const img of item.image) {
      if (typeof img === 'string') return img;
      if (img?.url) return img.url;
    }
  }
  return null;
}

// Extract content attribute from a <meta> tag by property name.
// Handles both property-before-content and content-before-property orderings.
function htmlMetaContent(html, property) {
  const re1 = new RegExp('<meta[^>]+property\\s*=\\s*["\']' + property + '["\'][^>]+content\\s*=\\s*["\']([^"\']+)["\']', 'i');
  const re2 = new RegExp('<meta[^>]+content\\s*=\\s*["\']([^"\']+)["\'][^>]+property\\s*=\\s*["\']' + property + '["\']', 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? m[1] : null;
}

// Manual HTML entity decoding (no DOMParser in service workers).
function decodeHtmlEntities(str) {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
}

// ═════════════════════════════════════════════════════════════════════════════
// SLOW PATH — background tab: search page → find link → product detail page
// ═════════════════════════════════════════════════════════════════════════════

// Slow path: opens a hidden background tab to scrape via injected scripts.
// Steps: 1) load search page, 2) extract or find first product link,
// 3) navigate to product detail page, 4) extract full product data.
// MAIN world injection is required to access window.dataLayer and React state.
async function tryTabScrape(searchUrl) {
  let tab;
  try {
    tab = await chrome.tabs.create({ url: searchUrl, active: false });
    await waitForTabLoad(tab.id);

    // Try extracting directly from the search results page
    let product = await tryExtract(tab.id);
    if (product && product.image) return fixUrls(product);

    // Find the first product link. Retries up to 5 times because search results
    // render client-side via JS and may not be in the DOM immediately.
    let productUrl = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const linkResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: findFirstProductLink,
      });
      productUrl = linkResults?.[0]?.result;
      if (productUrl) break;
      await new Promise((r) => setTimeout(r, 1500));
    }

    if (productUrl) {
      // Ensure absolute URL
      if (productUrl.startsWith('/')) productUrl = 'https://www.gamestop.com' + productUrl;

      // Step 3: Navigate to the product detail page
      await chrome.tabs.update(tab.id, { url: productUrl });
      await waitForTabLoad(tab.id);

      // Step 4: Extract from the product detail page (has JSON-LD, images, everything)
      const detailProduct = await tryExtract(tab.id);
      if (detailProduct) return fixUrls(detailProduct);
    }

    // If we got partial data from step 1, return that
    if (product) return fixUrls(product);

    return null;
  } finally {
    if (tab?.id) {
      try { await chrome.tabs.remove(tab.id); } catch {}
    }
  }
}

// Inject extractProductFromPage into the tab (MAIN world) and retry up to 3 times.
// Retries account for client-side rendering delays.
async function tryExtract(tabId) {
  for (let i = 0; i < 3; i++) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: extractProductFromPage,
    });
    const product = results?.[0]?.result;
    if (product) return product;
    if (i < 2) await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

// Wait for a tab to finish loading. Times out after 15s.
// Adds a 1.5s buffer after 'complete' for JS-rendered content to settle.
function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Page load timed out'));
    }, 15000);

    function listener(id, changeInfo) {
      if (id === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timer);
        setTimeout(resolve, 1500);
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

// INJECTED INTO PAGE (MAIN world): find the first product detail link on a search results page.
// Uses var declarations (not const/let) for broad browser compat in injected context.
function findFirstProductLink() {
  // Look for links to product detail pages (.html URLs with /products/)
  var links = document.querySelectorAll('a[href]');
  for (var i = 0; i < links.length; i++) {
    var href = links[i].href || '';
    if (href.includes('/products/') && href.includes('.html') &&
        !href.includes('/search') && !href.includes('/cart')) {
      return href;
    }
  }
  // Fallback: any gamestop link that ends in .html and isn't utility
  for (var j = 0; j < links.length; j++) {
    var h = links[j].href || '';
    if (h.includes('gamestop.com') && h.endsWith('.html') &&
        !h.includes('/search') && !h.includes('/cart') && !h.includes('/account') &&
        !h.includes('/help') && h !== location.href) {
      return h;
    }
  }
  return null;
}

// INJECTED INTO PAGE (MAIN world): extract product data from any GameStop page.
// Tries 5 extraction strategies in priority order:
//   1) JSON-LD structured data
//   2) window.dataLayer (GTM ecommerce events) -- requires MAIN world
//   3) data-* analytics attributes on DOM elements
//   4) h1 product name + price selectors
//   5) document.title fallback
function extractProductFromPage() {
  function absUrl(u) {
    if (!u) return null;
    if (u.startsWith('http')) return u;
    if (u.startsWith('/')) return location.origin + u;
    return u;
  }
  // Extract price: strip non-numeric chars, return null if invalid
  function ep(v) {
    if (v == null) return null;
    var n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return (isNaN(n) || n <= 0) ? null : n;
  }
  // Map availability string to normalized label
  function ma(v) {
    if (!v) return null;
    var l = String(v).toLowerCase();
    if (l.includes('instock') || l.includes('in stock') || l.includes('in_stock')) return 'In Stock';
    if (l.includes('outofstock') || l.includes('out of stock') || l.includes('sold out')) return 'Out of Stock';
    if (l.includes('preorder') || l.includes('pre-order')) return 'Pre-Order';
    if (l.includes('backorder') || l.includes('back-order')) return 'Backorder';
    if (l.includes('limited')) return 'Limited Stock';
    return null;
  }
  // Find the best product image on the page.
  // Priority: GameStop CDN images > largest non-logo/icon image.
  function findImage() {
    var imgs = document.querySelectorAll('img[src]');
    for (var i = 0; i < imgs.length; i++) {
      var src = imgs[i].src || '';
      if (src.includes('media.gamestop.com') || src.includes('productimages') ||
          src.includes('/products/') || src.includes('image.api') ||
          src.includes('psacard.com') || src.includes('media.') ) {
        if (imgs[i].naturalWidth > 50 || imgs[i].width > 50) return src;
      }
    }
    // Fallback: largest non-logo image
    var best = null, bestSize = 0;
    for (var j = 0; j < imgs.length; j++) {
      var w = imgs[j].naturalWidth || imgs[j].width || 0;
      var h = imgs[j].naturalHeight || imgs[j].height || 0;
      var s = imgs[j].src || '';
      if (w * h > bestSize && w > 80 && h > 80 &&
          !s.includes('logo') && !s.includes('icon') && !s.includes('sprite') && !s.includes('svg')) {
        bestSize = w * h; best = s;
      }
    }
    return best;
  }
  function extractImgFromLd(item) {
    if (!item.image) return null;
    if (typeof item.image === 'string') return item.image;
    if (item.image.url) return item.image.url;
    if (Array.isArray(item.image)) {
      for (var i = 0; i < item.image.length; i++) {
        if (typeof item.image[i] === 'string') return item.image[i];
        if (item.image[i] && item.image[i].url) return item.image[i].url;
      }
    }
    return null;
  }

  // 1. JSON-LD — product detail pages always have this
  try {
    var lds = document.querySelectorAll('script[type="application/ld+json"]');
    for (var j = 0; j < lds.length; j++) {
      var d = JSON.parse(lds[j].textContent);
      var arr = Array.isArray(d) ? d : [d];
      for (var k = 0; k < arr.length; k++) {
        var t = arr[k]['@type'];
        // Accept Product, IndividualProduct, or any type with name + offers
        if (t === 'Product' || t === 'IndividualProduct' || (arr[k].name && arr[k].offers)) {
          var o = Array.isArray(arr[k].offers) ? arr[k].offers[0] : (arr[k].offers || {});
          return {
            name: arr[k].name || null,
            price: ep(o.price || o.lowPrice),
            currency: o.priceCurrency || 'USD',
            availability: ma(o.availability),
            image: absUrl(extractImgFromLd(arr[k])) || findImage(),
            url: absUrl(arr[k].url) || location.href,
            description: (arr[k].description || '').substring(0, 200) || null,
          };
        }
      }
    }
  } catch (x) {}

  // 2. dataLayer (GTM) -- only accessible in MAIN world, not ISOLATED
  try {
    if (window.dataLayer) {
      for (var i = window.dataLayer.length - 1; i >= 0; i--) {
        var e = window.dataLayer[i];
        var items = e && e.ecommerce && (e.ecommerce.items || (e.ecommerce.detail && e.ecommerce.detail.products) || e.ecommerce.impressions);
        if (items && items.length) {
          var it = items[0];
          return {
            name: it.item_name || it.name || null,
            price: ep(it.price), currency: 'USD',
            availability: null, image: findImage(),
            url: absUrl(it.url) || location.href, description: null,
          };
        }
      }
    }
  } catch (x) {}

  // 3. data-* analytics attributes
  try {
    var das = document.querySelectorAll('[data-gtmdata], [data-analytics], [data-product], [data-item]');
    for (var di = 0; di < das.length; di++) {
      var raw = das[di].getAttribute('data-gtmdata') || das[di].getAttribute('data-analytics') ||
                das[di].getAttribute('data-product') || das[di].getAttribute('data-item');
      var p = JSON.parse(raw);
      if (p.name || p.productName || p.item_name) {
        return {
          name: p.name || p.productName || p.item_name,
          price: ep(p.price || p.salePrice), currency: 'USD',
          availability: ma(p.availability), image: absUrl(p.image) || findImage(),
          url: absUrl(p.url) || location.href, description: null,
        };
      }
    }
  } catch (x) {}

  // 4. h1 / product-name from DOM (product detail pages always have this)
  try {
    var h1 = document.querySelector('h1.product-name, h1[data-testid], h1[itemprop="name"], .product-detail h1, .pdp-title, h1');
    if (h1) {
      var pName = h1.textContent.trim();
      if (pName.length > 5 && pName.length < 300) {
        var priceEl = document.querySelector('[class*="price"] .sale, [class*="price"] span, .product-price, [itemprop="price"], [data-price]');
        var prc = null;
        if (priceEl) {
          prc = ep(priceEl.textContent || priceEl.getAttribute('content') || priceEl.getAttribute('data-price'));
        }
        if (!prc) {
          var bodyPrice = (document.body ? document.body.innerText : '').match(/\$\s*(\d{1,4}\.\d{2})/);
          if (bodyPrice) prc = parseFloat(bodyPrice[1]);
        }
        return {
          name: pName, price: prc, currency: 'USD',
          availability: null, image: findImage(),
          url: location.href, description: null,
        };
      }
    }
  } catch (x) {}

  // 5. Page title fallback
  try {
    var title = (document.title || '').replace(/\s*[\|\-–—]\s*GameStop.*$/i, '').trim();
    if (title.length > 8 && !/search|result|find/i.test(title)) {
      var bp = (document.body ? document.body.innerText : '').match(/\$\s*(\d{1,4}\.\d{2})/);
      return {
        name: title, price: bp ? parseFloat(bp[1]) : null,
        currency: 'USD', availability: null,
        image: findImage(), url: location.href, description: null,
      };
    }
  } catch (x) {}

  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
// URL fixup — ensure all URLs are absolute (not relative)
// ═════════════════════════════════════════════════════════════════════════════

function fixUrls(product) {
  if (!product) return product;
  if (product.url && product.url.startsWith('/')) {
    product.url = 'https://www.gamestop.com' + product.url;
  }
  if (product.image && product.image.startsWith('/')) {
    product.image = 'https://www.gamestop.com' + product.image;
  }
  return product;
}

// ═════════════════════════════════════════════════════════════════════════════
// Shared helpers
// ═════════════════════════════════════════════════════════════════════════════

// Strip non-numeric chars and parse as float. Returns null for invalid/zero prices.
function parsePrice(v) {
  if (v == null) return null;
  var n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return (isNaN(n) || n <= 0) ? null : n;
}

// Normalize schema.org / freetext availability strings to display labels.
function mapAvail(v) {
  if (!v) return null;
  var l = String(v).toLowerCase();
  if (l.includes('instock') || l.includes('in stock') || l.includes('in_stock')) return 'In Stock';
  if (l.includes('outofstock') || l.includes('out of stock') || l.includes('sold out')) return 'Out of Stock';
  if (l.includes('preorder') || l.includes('pre-order')) return 'Pre-Order';
  if (l.includes('backorder') || l.includes('back-order')) return 'Backorder';
  if (l.includes('limited')) return 'Limited Stock';
  return null;
}

// Detect gaming platform from product name. Uses "nintendo switch" (not just "switch")
// to avoid false matches on KVM switches, keyboard switches, etc.
function extractPlatform(name) {
  if (!name) return null;
  var lower = name.toLowerCase();
  var platforms = [
    { keywords: ['playstation 5', 'ps5'], label: 'PS5' },
    { keywords: ['playstation 4', 'ps4'], label: 'PS4' },
    { keywords: ['xbox series x|s', 'xbox series x', 'xbox series s'], label: 'Xbox Series X|S' },
    { keywords: ['xbox one'], label: 'Xbox One' },
    { keywords: ['nintendo switch'], label: 'Nintendo Switch' },
  ];
  for (var i = 0; i < platforms.length; i++) {
    for (var j = 0; j < platforms[i].keywords.length; j++) {
      if (lower.includes(platforms[i].keywords[j])) return platforms[i].label;
    }
  }
  // Only match "PC" if accompanied by gaming-related keywords to avoid false positives
  if (/\bpc\b/.test(lower) && /(game|edition|version|digital|download|steam|epic)/i.test(lower)) {
    return 'PC';
  }
  return null;
}

// Check chrome.storage.local for a cached product. Evicts expired entries.
async function getCached(sku) {
  try {
    var key = 'product_cache_' + sku;
    var result = await chrome.storage.local.get(key);
    var entry = result[key];
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
    if (entry) await chrome.storage.local.remove(key);
    return null;
  } catch { return null; }
}

// Store product data with a timestamp for TTL-based expiry.
async function cacheResult(sku, data) {
  try {
    var key = 'product_cache_' + sku;
    await chrome.storage.local.set({ [key]: { data, timestamp: Date.now() } });
  } catch {}
}

export default { lookupProduct };
