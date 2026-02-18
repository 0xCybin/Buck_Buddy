#!/usr/bin/env node
/**
 * BuckBuddy2 Asset Generator
 * Uses PixelLab API v2 to generate all pixel art assets for the tamagotchi system
 * Based on existing Buck character: da03d4fc-46be-43bc-824f-7f5fd65b5938
 */

const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const API_BASE = 'https://api.pixellab.ai/v2';
const API_KEY = process.env.PIXELLAB_KEY || 'f2f57d7f-1506-481d-8c32-adc40c3f5241';
const CHARACTER_ID = 'da03d4fc-46be-43bc-824f-7f5fd65b5938';
const ASSETS_DIR = path.resolve(__dirname, '..', 'src', 'assets');
const BUCK_DIR = path.join(ASSETS_DIR, 'buck');
const TAMAGOTCHI_DIR = path.join(ASSETS_DIR, 'tamagotchi');

// Rate limiting - sequential to avoid 429s
const MAX_CONCURRENT = 1;
const DELAY_BETWEEN_REQUESTS_MS = 3000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 15000;
let activeRequests = 0;

// Load Buck south rotation as base64 reference
const buckRefPath = path.join(BUCK_DIR, 'pixellab_extracted', 'rotations', 'south.png');
const BUCK_REF_B64 = fs.readFileSync(buckRefPath).toString('base64');

// ─── Helpers ───────────────────────────────────────────────────────────

async function apiCall(endpoint, body, method = 'POST', retryCount = 0) {
  const url = `${API_BASE}${endpoint}`;
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);

  // Retry on 429 rate limit
  if (res.status === 429 && retryCount < MAX_RETRIES) {
    const delay = RETRY_BASE_DELAY_MS * (retryCount + 1);
    console.log(`    ⏳ Rate limited, retrying in ${delay / 1000}s (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
    await new Promise(r => setTimeout(r, delay));
    return apiCall(endpoint, body, method, retryCount + 1);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status} on ${endpoint}: ${text.substring(0, 200)}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('image/png')) {
    return { type: 'image', buffer: Buffer.from(await res.arrayBuffer()) };
  }
  return res.json();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// ─── Post-Processing (Jimp) ──────────────────────────────────────────
// Cleans up anti-aliased edges: enforces solid black outlines,
// removes stray semi-transparent fringe pixels outside the character.

async function postProcess(buffer) {
  const img = await Jimp.read(buffer);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const data = img.bitmap.data;

  // Pass 1: alpha threshold — remove semi-transparent fringe
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a > 0 && a < 128) {
      // Semi-transparent pixel → fully transparent
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
    } else if (a >= 128 && a < 255) {
      // Nearly opaque → make fully opaque
      data[i + 3] = 255;
    }
  }

  // Pass 2: enforce solid black outlines — dark pixels become pure black
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue; // skip transparent
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r < 60 && g < 60 && b < 60) {
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
    }
  }

  // Pass 3: remove isolated stray pixels (opaque pixels with < 2 opaque neighbors)
  const isOpaque = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    return data[(y * w + x) * 4 + 3] > 0;
  };
  const toRemove = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3] === 0) continue;
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (isOpaque(x + dx, y + dy)) neighbors++;
        }
      }
      if (neighbors < 2) toRemove.push(idx);
    }
  }
  for (const idx of toRemove) {
    data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
  }

  return await img.getBufferAsync(Jimp.MIME_PNG);
}

async function saveImage(buffer, filePath, skipPostProcess = false) {
  ensureDir(path.dirname(filePath));
  const cleaned = skipPostProcess ? buffer : await postProcess(buffer);
  fs.writeFileSync(filePath, cleaned);
  console.log(`  ✓ Saved: ${path.relative(ASSETS_DIR, filePath)}`);
}

async function saveImageFromUrl(url, filePath, skipPostProcess = false) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} from ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await saveImage(buffer, filePath, skipPostProcess);
}

// Decode base64 image from API response
function getImageBuffer(data) {
  // API returns { images: [{ base64, format }] } or { image: { base64 } }
  if (data.images && data.images.length > 0) {
    return Buffer.from(data.images[0].base64, 'base64');
  }
  if (data.image && data.image.base64) {
    return Buffer.from(data.image.base64, 'base64');
  }
  if (data.base64) {
    return Buffer.from(data.base64, 'base64');
  }
  return null;
}

function getMultipleImageBuffers(data) {
  if (data.images) {
    return data.images.map(img => Buffer.from(img.base64, 'base64'));
  }
  return [];
}

async function pollJob(jobId, maxAttempts = 60, intervalMs = 5000) {
  for (let i = 0; i < maxAttempts; i++) {
    const data = await apiCall(`/background-jobs/${jobId}`, null, 'GET');
    if (data.status === 'completed') return data;
    if (data.status === 'failed') throw new Error(`Job ${jobId} failed: ${JSON.stringify(data)}`);
    console.log(`    Polling job ${jobId}: ${data.status} (attempt ${i + 1}/${maxAttempts})`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Job ${jobId} timed out`);
}

async function throttled(fn) {
  while (activeRequests >= MAX_CONCURRENT) {
    await new Promise(r => setTimeout(r, 200));
  }
  activeRequests++;
  try {
    return await fn();
  } finally {
    activeRequests--;
  }
}

// Buck reference in direct format (for animate-with-text-v2, etc.)
function buckRefDirect() {
  return { type: 'base64', base64: BUCK_REF_B64, format: 'png' };
}

// Buck reference wrapped for style endpoints (generate-with-style-v2)
function buckRefStyleImage() {
  return { image: { type: 'base64', base64: BUCK_REF_B64, format: 'png' }, width: 128, height: 128 };
}

// ─── Character Animation Generation ────────────────────────────────────

async function generateCharacterAnimation(templateId, actionDesc, animName) {
  console.log(`\n🎬 Queuing animation: ${animName} (template: ${templateId})`);
  try {
    const result = await apiCall('/animate-character', {
      character_id: CHARACTER_ID,
      template_animation_id: templateId,
      action_description: actionDesc || undefined,
      text_guidance_scale: 8,
    });
    console.log(`  → Queued: ${JSON.stringify(result).substring(0, 200)}`);
    return result;
  } catch (err) {
    console.error(`  ✗ Failed ${animName}: ${err.message}`);
    return null;
  }
}

// Use text-based animation for custom emotions
async function generateTextAnimation(action, outputDir, frameCount = 4) {
  console.log(`\n🎭 Generating text animation: ${action}`);
  try {
    const result = await apiCall('/animate-with-text-v2', {
      reference_image: buckRefDirect(),
      reference_image_size: { width: 128, height: 128 },
      action: `${action}, pixel art with solid black outline, clean hard edges, no anti-aliasing`,
      image_size: { width: 128, height: 128 },
      no_background: true,
    });

    const buffers = getMultipleImageBuffers(result);
    ensureDir(outputDir);
    for (let i = 0; i < buffers.length; i++) {
      await saveImage(buffers[i], path.join(outputDir, `frame_${String(i).padStart(3, '0')}.png`));
    }
    console.log(`  → Generated ${buffers.length} frames`);
    return buffers.length;
  } catch (err) {
    console.error(`  ✗ Failed "${action}": ${err.message}`);
    return 0;
  }
}

// ─── Item/Object Generation ────────────────────────────────────────────

async function generateItem(description, size, outputPath, noBackground = true) {
  return throttled(async () => {
    console.log(`\n🖼  Generating: ${description} (${size.width}x${size.height})`);
    try {
      const result = await apiCall('/generate-image-v2', {
        description: `pixel art ${description}, cute style, game item sprite, solid black outline, clean hard edges, no anti-aliasing`,
        image_size: size,
        no_background: noBackground,
        style_image: buckRefStyleImage(),
        style_options: {
          color_palette: true,
          outline: true,
          detail: true,
          shading: true,
        },
      });

      const buffer = getImageBuffer(result);
      if (buffer) {
        await saveImage(buffer, outputPath);
        return true;
      }
      console.error(`  ✗ No image data in response for: ${description}`);
      return false;
    } catch (err) {
      console.error(`  ✗ Failed "${description}": ${err.message}`);
      return false;
    }
  });
}

async function generateStyledItem(description, size, outputPath, noBackground = true) {
  return throttled(async () => {
    console.log(`\n🎨 Generating styled: ${description} (${size.width}x${size.height})`);
    try {
      const result = await apiCall('/generate-with-style-v2', {
        style_images: [buckRefStyleImage()],
        description: `pixel art ${description}, cute game sprite style, solid black outline, clean hard edges, no anti-aliasing`,
        image_size: size,
        no_background: noBackground,
      });

      const buffer = getImageBuffer(result);
      if (buffer) {
        await saveImage(buffer, outputPath);
        return true;
      }
      console.error(`  ✗ No image data for: ${description}`);
      return false;
    } catch (err) {
      console.error(`  ✗ Failed "${description}": ${err.message}`);
      return false;
    }
  });
}

// ─── Background Scene Generation ───────────────────────────────────────

async function generateBackground(description, size, outputPath) {
  console.log(`\n🏢 Generating background: ${description}`);
  try {
    const result = await apiCall('/create-image-pixflux', {
      description: `pixel art ${description}, solid black outline, clean hard edges`,
      image_size: size,
      text_guidance_scale: 8,
      outline: 'single color outline',
      shading: 'basic shading',
      detail: 'medium detail',
      no_background: false,
    });

    const buffer = getImageBuffer(result);
    if (buffer) {
      await saveImage(buffer, outputPath, true); // skip post-process for backgrounds
      return true;
    }
    return false;
  } catch (err) {
    console.error(`  ✗ Failed background "${description}": ${err.message}`);
    return false;
  }
}

// ─── Map Objects (Furniture) ───────────────────────────────────────────

async function generateMapObject(description, size, outputPath) {
  return throttled(async () => {
    console.log(`\n🪑 Generating object: ${description}`);
    try {
      const result = await apiCall('/map-objects', {
        description: `pixel art ${description}, cute game asset, solid black outline, clean hard edges`,
        image_size: size,
        view: 'side',
        outline: 'single color outline',
        shading: 'basic shading',
        detail: 'medium detail',
        text_guidance_scale: 8,
      });

      const buffer = getImageBuffer(result);
      if (buffer) {
        await saveImage(buffer, outputPath);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`  ✗ Failed object "${description}": ${err.message}`);
      return false;
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════
// ASSET DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

// ─── P1 Character Animations (via animate-character templates) ──────

const CHARACTER_ANIMATIONS = [
  // Existing: walking (S/N/W), talking, waving, pointing
  // Need to add:
  { template: 'breathing-idle',   action: 'idle breathing, slight body movement',  name: 'idle' },
  { template: 'drinking',         action: 'drinking from a cup',                    name: 'drinking' },
  { template: 'crouching',        action: 'sitting down on floor',                  name: 'sitting' },
];

// ─── P1 Custom Emotion/Action Animations (via animate-with-text-v2) ─

const CUSTOM_ANIMATIONS = [
  // Emotions
  { action: 'looking sad with droopy ears and frowning, dejected pose',             dir: 'emotions/sad' },
  { action: 'rubbing belly looking hungry, thinking about food',                     dir: 'emotions/hungry' },
  { action: 'angry and frustrated, puffed cheeks with steam coming from head',       dir: 'emotions/angry' },
  { action: 'looking sick with dizzy swirls, wobbly stance, green tinted',           dir: 'emotions/sick' },
  { action: 'in love with hearts floating up, dreamy happy expression',              dir: 'emotions/love' },
  { action: 'happy bounce, smiling wide with slight jump',                           dir: 'emotions/happy' },

  // Actions
  { action: 'eating food, chomping and chewing with mouth open and closed',          dir: 'actions/eating' },
  { action: 'celebrating excitedly, jumping up and down with arms raised',           dir: 'actions/celebrating' },
  { action: 'sleeping peacefully, eyes closed, curled up with Z letters floating',   dir: 'actions/sleeping' },
  { action: 'typing at a computer desk, working hard, sitting in office chair',      dir: 'actions/working' },

  // P2 Movement
  { action: 'sitting down from standing position, transition to seated',             dir: 'movement/sitting_down' },
  { action: 'standing up from seated position, getting up',                          dir: 'movement/standing_up' },

  // P3 Special
  { action: 'leveling up with glowing sparkle effects, triumphant pose',             dir: 'special/level_up' },
  { action: 'catching a gold coin excitedly, grabbing with hands',                   dir: 'special/coin_collect' },
  { action: 'holding trophy proudly, achievement unlocked celebration',              dir: 'special/achievement' },
  { action: 'dancing happily, fun dance moves, party time',                          dir: 'special/dancing' },
  { action: 'waving goodbye with a suitcase, leaving for vacation',                  dir: 'special/vacation_depart' },
  { action: 'waving hello happily, returning from trip, excited to be back',         dir: 'special/vacation_return' },
  { action: 'surprised with wide eyes and exclamation mark, shocked expression',     dir: 'emotions/surprised_new' },
];

// ─── P1 Food Items (32x32) ────────────────────────────────────────────

const FOOD_ITEMS = [
  { desc: 'hamburger cheeseburger, juicy fast food',       file: 'burger.png' },
  { desc: 'pizza slice with melted cheese and pepperoni',   file: 'pizza.png' },
  { desc: 'red apple, fresh fruit',                         file: 'apple.png' },
  { desc: 'sandwich with lettuce and tomato',               file: 'sandwich.png' },
  { desc: 'chocolate chip cookie, round baked treat',       file: 'cookie.png' },
  { desc: 'candy bar, chocolate snack wrapper',             file: 'candy_bar.png' },
];

// ─── P1 Drink Items (32x32) ───────────────────────────────────────────

const DRINK_ITEMS = [
  { desc: 'hot coffee cup with steam, ceramic mug',         file: 'coffee.png' },
  { desc: 'water bottle, clear plastic with blue cap',      file: 'water.png' },
  { desc: 'red soda can, fizzy drink',                      file: 'soda.png' },
  { desc: 'energy drink can, green lightning bolt design',   file: 'energy_drink.png' },
];

// ─── P3 Premium Food (32x32) ──────────────────────────────────────────

const PREMIUM_FOOD = [
  { desc: 'birthday cake with candles, celebration cake',    file: 'cake.png' },
  { desc: 'ramen noodle bowl with chopsticks, steaming',     file: 'ramen.png' },
  { desc: 'ice cream cone, two scoops pink and brown',       file: 'ice_cream.png' },
  { desc: 'frosted donut with sprinkles, round pastry',      file: 'donut.png' },
];

// ─── P2 Hats (32x32) ─────────────────────────────────────────────────

const HATS = [
  { desc: 'red baseball cap visor, GameStop style',           file: 'visor.png' },
  { desc: 'golden royal crown with jewels',                   file: 'crown.png' },
  { desc: 'sporty headband, red sweatband',                   file: 'headband.png' },
  { desc: 'red santa claus hat with white pom pom',           file: 'santa_hat.png' },
  { desc: 'colorful party hat with polka dots',               file: 'party_hat.png' },
  { desc: 'purple wizard hat with stars and moon',            file: 'wizard_hat.png' },
];

// ─── P3 Eyewear (32x32) ──────────────────────────────────────────────

const EYEWEAR = [
  { desc: 'cool black sunglasses, aviator style',             file: 'sunglasses.png' },
  { desc: 'nerdy thick black frame glasses',                   file: 'nerd_glasses.png' },
  { desc: 'fancy golden monocle with chain',                   file: 'monocle.png' },
];

// ─── P2 Outfits (32x32) ──────────────────────────────────────────────

const OUTFITS = [
  { desc: 'red polo shirt, GameStop employee uniform',        file: 'gamestop_polo.png' },
  { desc: 'red hoodie sweatshirt with GameStop logo',         file: 'gamestop_hoodie.png' },
  { desc: 'black tuxedo with bow tie, formal suit',           file: 'tuxedo.png' },
  { desc: 'red superhero cape, flowing fabric',                file: 'cape.png' },
  { desc: 'tropical hawaiian shirt with flowers',              file: 'hawaiian_shirt.png' },
];

// ─── P3 Held Items (32x32) ───────────────────────────────────────────

const HELD_ITEMS = [
  { desc: 'game controller, console gamepad',                  file: 'controller.png' },
  { desc: 'giant foam finger, number one hand',                file: 'foam_finger.png' },
  { desc: 'magic wand with sparkle star tip',                  file: 'magic_wand.png' },
  { desc: 'colorful party balloon on string',                  file: 'balloon.png' },
];

// ─── P1 UI Icons (24x24) ─────────────────────────────────────────────

const UI_ICONS = [
  { desc: 'fork and knife icon, feed button',                  file: 'icon_feed.png' },
  { desc: 'play button triangle icon, game',                   file: 'icon_play.png' },
  { desc: 'broom cleaning icon, clean button',                 file: 'icon_clean.png' },
  { desc: 'moon and stars sleep icon',                         file: 'icon_sleep.png' },
  { desc: 'shopping bag with coin, shop icon',                 file: 'icon_shop.png' },
  { desc: 'bar chart stats icon, statistics',                  file: 'icon_stats.png' },
  { desc: 'gear cog settings icon',                            file: 'icon_settings.png' },
  { desc: 'left arrow back icon',                              file: 'icon_back.png' },
  { desc: 'X close button icon',                               file: 'icon_close.png' },
];

// ─── P1 Speech Bubbles (48x48) ───────────────────────────────────────

const BUBBLES = [
  { desc: 'white speech bubble with tail, empty talk bubble',            file: 'speech_bubble.png', size: 48 },
  { desc: 'cloud shaped thought bubble with small circles',              file: 'thought_bubble.png', size: 48 },
  { desc: 'red exclamation mark alert bubble',                           file: 'exclamation_bubble.png', size: 32 },
  { desc: 'pink heart love bubble floating',                             file: 'heart_bubble.png', size: 32 },
  { desc: 'three dots ellipsis thinking bubble',                         file: 'dots_bubble.png', size: 32 },
  { desc: 'Z Z Z sleeping bubble, blue letters',                        file: 'zzz_bubble.png', size: 32 },
  { desc: 'yellow exclamation mark alert icon',                          file: 'alert_icon.png', size: 32 },
  { desc: 'musical notes floating, happy melody',                        file: 'music_notes.png', size: 32 },
];

// ─── P1 Currency & Rewards ────────────────────────────────────────────

const CURRENCY = [
  { desc: 'shiny gold coin with G letter, game currency, front view',            file: 'gme_coin_1.png', size: 32 },
  { desc: 'shiny gold coin with G letter, game currency, slight angle',          file: 'gme_coin_2.png', size: 32 },
  { desc: 'shiny gold coin edge view, thin gold disc',                           file: 'gme_coin_3.png', size: 32 },
  { desc: 'shiny gold coin with G letter, game currency, opposite angle',        file: 'gme_coin_4.png', size: 32 },
  { desc: 'yellow sparkle particle effect, coin collect shine',                   file: 'coin_sparkle.png', size: 32 },
  { desc: 'small pile of gold coins, few coins stacked',                          file: 'coin_pile_small.png', size: 32 },
  { desc: 'medium pile of gold coins, decent stack',                              file: 'coin_pile_medium.png', size: 32 },
  { desc: 'large pile of gold coins overflowing, treasure',                       file: 'coin_pile_large.png', size: 32 },
  { desc: 'blue glowing XP star orb, experience point',                           file: 'xp_orb.png', size: 32 },
];

// ─── P2 Notification Icons (24x24) ───────────────────────────────────

const NOTIFICATION_ICONS = [
  { desc: 'stomach rumble hunger warning, fork and plate',                       file: 'notif_hunger.png' },
  { desc: 'frowny face sad warning icon, unhappy',                               file: 'notif_happiness.png' },
  { desc: 'alarm clock break time warning icon',                                  file: 'notif_break.png' },
  { desc: 'golden star achievement icon',                                         file: 'notif_achievement.png' },
  { desc: 'orange flame streak icon, fire streak',                                file: 'notif_streak.png' },
  { desc: 'white sparkle new item indicator',                                     file: 'notif_new.png' },
];

// ─── P2 Shop UI (32x32) ──────────────────────────────────────────────

const SHOP_UI = [
  { desc: 'wooden shop sign banner with text SHOP',                               file: 'shop_sign.png', size: 64 },
  { desc: 'decorative item card frame border, wooden',                             file: 'item_frame.png', size: 48 },
  { desc: 'red SOLD stamp badge overlay',                                          file: 'badge_sold.png', size: 32 },
  { desc: 'yellow NEW exclamation badge',                                          file: 'badge_new.png', size: 32 },
  { desc: 'price tag label with gold coin icon',                                   file: 'price_tag.png', size: 32 },
  { desc: 'gray padlock lock icon, locked item',                                   file: 'lock_icon.png', size: 32 },
];

// ─── P1 Office Background & Furniture ─────────────────────────────────

const OFFICE_BACKGROUND = {
  desc: 'cozy pixel art office room interior, GameStop themed, desk with computer monitor and keyboard, office chair, headset on desk, coffee mug, bookshelf with game cases, GameStop poster on wall, window showing daytime sky, potted plant, carpet floor, warm lighting',
  file: 'office_bg.png',
  size: { width: 256, height: 192 },
};

const OFFICE_FURNITURE = [
  { desc: 'office desk wooden table front view with drawers',                       file: 'desk.png', size: 64 },
  { desc: 'office rolling chair with armrests, black',                              file: 'chair.png', size: 48 },
  { desc: 'computer monitor screen glowing blue, on stand',                         file: 'monitor.png', size: 48 },
  { desc: 'keyboard on desk, computer keyboard front view',                         file: 'keyboard.png', size: 48 },
  { desc: 'headset headphones with microphone boom',                                file: 'headset.png', size: 32 },
  { desc: 'coffee mug cup with GameStop red logo, steaming',                        file: 'mug.png', size: 32 },
  { desc: 'bookshelf with video game cases and books',                              file: 'bookshelf.png', size: 64 },
  { desc: 'small green potted plant succulent on desk',                             file: 'plant.png', size: 32 },
  { desc: 'small trash can wastebasket near desk',                                  file: 'trashcan.png', size: 32 },
  { desc: 'sticky notes colorful on wall, yellow pink blue',                        file: 'sticky_notes.png', size: 32 },
  { desc: 'GameStop logo poster banner on wall, red and white',                     file: 'poster.png', size: 48 },
  { desc: 'desk lamp on, warm light glowing',                                       file: 'lamp.png', size: 32 },
];

const WINDOW_VARIANTS = [
  { desc: 'window with morning sunrise sky, orange pink clouds, early day',          file: 'window_morning.png', size: 64 },
  { desc: 'window with bright blue daytime sky, white clouds, sunny',                file: 'window_day.png', size: 64 },
  { desc: 'window with orange sunset evening sky, purple clouds',                    file: 'window_evening.png', size: 64 },
  { desc: 'window with dark night sky, stars and moon, city lights',                 file: 'window_night.png', size: 64 },
];

// ─── P2 Effects & Particles ───────────────────────────────────────────

const EFFECTS = [
  { desc: 'white sparkle shimmer effect, glitter particles',                         file: 'sparkle.png', size: 32 },
  { desc: 'brown dust poof cloud, small explosion',                                  file: 'dust_poof.png', size: 32 },
  { desc: 'colorful confetti pieces falling, celebration',                            file: 'confetti.png', size: 32 },
  { desc: 'pink red hearts floating upward, love effect',                             file: 'hearts_float.png', size: 32 },
  { desc: 'angry red steam puffs above head',                                         file: 'steam_angry.png', size: 32 },
  { desc: 'blue sweat drop nervous, anxious drop',                                    file: 'sweat_drop.png', size: 32 },
  { desc: 'yellow star burst explosion, achievement effect',                           file: 'star_burst.png', size: 32 },
  { desc: 'gold coins raining down shower, coin rain',                                file: 'coin_shower.png', size: 32 },
];

// ─── P1 Status Bars ──────────────────────────────────────────────────

const STATUS_BARS = [
  { desc: 'red hunger status bar UI frame with fork icon on left, horizontal bar',     file: 'bar_hunger.png', size: { w: 64, h: 64 } },
  { desc: 'yellow happiness status bar UI frame with smiley icon on left',             file: 'bar_happiness.png', size: { w: 64, h: 64 } },
  { desc: 'blue energy status bar UI frame with lightning bolt icon on left',          file: 'bar_energy.png', size: { w: 64, h: 64 } },
  { desc: 'green health status bar UI frame with heart icon on left',                  file: 'bar_health.png', size: { w: 64, h: 64 } },
  { desc: 'purple XP experience level bar UI frame with star icon on left',            file: 'bar_xp.png', size: { w: 64, h: 64 } },
];

// ─── P3 Mini-Game Assets ─────────────────────────────────────────────

const MINIGAME_ASSETS = [
  { desc: 'card back design, red GameStop themed pattern',                             file: 'card_back.png', size: 32 },
  { desc: 'game controller icon for memory card front',                                file: 'card_controller.png', size: 32 },
  { desc: 'gold coin icon for memory card front',                                      file: 'card_coin.png', size: 32 },
  { desc: 'cute bunny face icon for memory card front',                                file: 'card_bunny.png', size: 32 },
  { desc: 'power button icon for memory card front',                                   file: 'card_power.png', size: 32 },
  { desc: 'game case box icon for memory card front',                                  file: 'card_game.png', size: 32 },
  { desc: 'golden star icon for memory card front',                                    file: 'card_star.png', size: 32 },
  { desc: 'wooden bucket basket for catching coins game',                              file: 'catcher_bucket.png', size: 48 },
  { desc: 'round black bomb with fuse, avoid item',                                   file: 'bomb.png', size: 32 },
];

// ═══════════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════════

async function generateAllAnimations() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 1: CHARACTER ANIMATIONS');
  console.log('═'.repeat(60));

  // Template animations (idle, drinking, sitting) already queued on PixelLab character
  // They'll be available in the character ZIP download
  // Skip re-queuing to avoid wasting credits and hitting rate limits

  // Generate custom text-based animations
  const animDir = path.join(TAMAGOTCHI_DIR, 'animations');
  for (const anim of CUSTOM_ANIMATIONS) {
    const outDir = path.join(animDir, anim.dir);
    // Skip if first frame already exists
    if (fs.existsSync(path.join(outDir, 'frame_000.png'))) {
      console.log(`  ⏭ Skipping (exists): ${anim.dir}`);
      continue;
    }
    await generateTextAnimation(anim.action, outDir);
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_REQUESTS_MS));
  }

}

async function generateAllItems() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 2: FOOD, DRINKS & ITEMS');
  console.log('═'.repeat(60));

  const itemDir = path.join(TAMAGOTCHI_DIR, 'items');
  const size32 = { width: 32, height: 32 };

  const allItems = [
    ...FOOD_ITEMS.map(i => ({ ...i, subdir: 'food' })),
    ...DRINK_ITEMS.map(i => ({ ...i, subdir: 'drinks' })),
    ...PREMIUM_FOOD.map(i => ({ ...i, subdir: 'food_premium' })),
    ...HATS.map(i => ({ ...i, subdir: 'hats' })),
    ...EYEWEAR.map(i => ({ ...i, subdir: 'eyewear' })),
    ...OUTFITS.map(i => ({ ...i, subdir: 'outfits' })),
    ...HELD_ITEMS.map(i => ({ ...i, subdir: 'held_items' })),
  ];

  // Process sequentially to avoid 429 rate limits
  for (const item of allItems) {
    const filePath = path.join(itemDir, item.subdir, item.file);
    // Skip if already exists
    if (fs.existsSync(filePath)) {
      console.log(`  ⏭ Skipping (exists): ${path.relative(ASSETS_DIR, filePath)}`);
      continue;
    }
    await generateStyledItem(item.desc, size32, filePath);
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_REQUESTS_MS));
  }
}

async function generateAllUI() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 3: UI ELEMENTS');
  console.log('═'.repeat(60));

  const uiDir = path.join(TAMAGOTCHI_DIR, 'ui');
  const size32 = { width: 32, height: 32 };

  const allUI = [
    ...UI_ICONS.map(i => ({ desc: i.desc, size: size32, path: path.join(uiDir, 'icons', i.file) })),
    ...BUBBLES.map(b => ({ desc: b.desc, size: { width: b.size, height: b.size }, path: path.join(uiDir, 'bubbles', b.file) })),
    ...CURRENCY.map(c => ({ desc: c.desc, size: { width: c.size, height: c.size }, path: path.join(uiDir, 'currency', c.file) })),
    ...NOTIFICATION_ICONS.map(n => ({ desc: n.desc, size: size32, path: path.join(uiDir, 'notifications', n.file) })),
    ...SHOP_UI.map(s => ({ desc: s.desc, size: { width: s.size, height: s.size }, path: path.join(uiDir, 'shop', s.file) })),
    ...STATUS_BARS.map(b => ({ desc: b.desc, size: { width: b.size.w, height: b.size.h }, path: path.join(uiDir, 'bars', b.file) })),
  ];

  for (const item of allUI) {
    if (fs.existsSync(item.path)) {
      console.log(`  ⏭ Skipping (exists): ${path.relative(ASSETS_DIR, item.path)}`);
      continue;
    }
    await generateStyledItem(item.desc, item.size, item.path);
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_REQUESTS_MS));
  }
}

async function generateOffice() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 4: OFFICE BACKGROUND & FURNITURE');
  console.log('═'.repeat(60));

  const officeDir = path.join(TAMAGOTCHI_DIR, 'office');

  // Main background
  await generateBackground(
    OFFICE_BACKGROUND.desc,
    OFFICE_BACKGROUND.size,
    path.join(officeDir, OFFICE_BACKGROUND.file)
  );

  // Furniture objects - use generateStyledItem (map-objects endpoint has format issues)
  for (const f of OFFICE_FURNITURE) {
    const fp = path.join(officeDir, 'furniture', f.file);
    if (fs.existsSync(fp)) { console.log(`  ⏭ Skipping (exists): ${path.relative(ASSETS_DIR, fp)}`); continue; }
    await generateStyledItem(f.desc, { width: f.size, height: f.size }, fp);
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_REQUESTS_MS));
  }

  // Window variants
  for (const w of WINDOW_VARIANTS) {
    const fp = path.join(officeDir, 'windows', w.file);
    if (fs.existsSync(fp)) { console.log(`  ⏭ Skipping (exists): ${path.relative(ASSETS_DIR, fp)}`); continue; }
    await generateStyledItem(w.desc, { width: w.size, height: w.size }, fp, false);
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_REQUESTS_MS));
  }
}

async function generateEffectsAndMinigame() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 5: EFFECTS & MINI-GAME ASSETS');
  console.log('═'.repeat(60));

  const effectsDir = path.join(TAMAGOTCHI_DIR, 'effects');
  const minigameDir = path.join(TAMAGOTCHI_DIR, 'minigame');

  const allEffectsAndGames = [
    ...EFFECTS.map(e => ({ desc: e.desc, size: { width: e.size, height: e.size }, path: path.join(effectsDir, e.file) })),
    ...MINIGAME_ASSETS.map(g => ({ desc: g.desc, size: { width: g.size, height: g.size }, path: path.join(minigameDir, g.file) })),
  ];

  for (const item of allEffectsAndGames) {
    if (fs.existsSync(item.path)) { console.log(`  ⏭ Skipping (exists): ${path.relative(ASSETS_DIR, item.path)}`); continue; }
    await generateStyledItem(item.desc, item.size, item.path);
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_REQUESTS_MS));
  }
}

// ═══════════════════════════════════════════════════════════════════════

async function main() {
  console.log('🐰 BuckBuddy2 Asset Generator');
  console.log(`📁 Output: ${TAMAGOTCHI_DIR}`);
  console.log(`🔑 Character: ${CHARACTER_ID}`);

  // Check balance
  const balance = await apiCall('/balance', null, 'GET');
  console.log(`💰 Balance: ${balance.subscription?.generations || 0} generations remaining`);
  console.log('');

  // Parse CLI args for phase selection
  const args = process.argv.slice(2);
  const phases = args.length > 0 ? args : ['all'];

  try {
    if (phases.includes('all') || phases.includes('animations') || phases.includes('1')) {
      await generateAllAnimations();
    }
    if (phases.includes('all') || phases.includes('items') || phases.includes('2')) {
      await generateAllItems();
    }
    if (phases.includes('all') || phases.includes('ui') || phases.includes('3')) {
      await generateAllUI();
    }
    if (phases.includes('all') || phases.includes('office') || phases.includes('4')) {
      await generateOffice();
    }
    if (phases.includes('all') || phases.includes('effects') || phases.includes('5')) {
      await generateEffectsAndMinigame();
    }
  } catch (err) {
    console.error(`\n❌ Fatal error: ${err.message}`);
    console.error(err.stack);
  }

  // Final balance
  const finalBalance = await apiCall('/balance', null, 'GET');
  console.log('\n' + '═'.repeat(60));
  console.log(`✅ Generation complete!`);
  console.log(`💰 Remaining: ${finalBalance.subscription?.generations || 0} generations`);
  console.log('═'.repeat(60));
}

main().catch(console.error);
