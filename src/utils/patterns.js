/**
 * patterns.js -- Shared regex patterns for data extraction and Freshdesk DOM selectors.
 * Used by contentScript, securityUtils, DataGroup, and other modules to detect
 * order numbers, tracking numbers, PII, and page elements.
 */

export const PATTERNS = {
  // GameStop order formats: GS (11000000 + 8 digits = 16 total), Web (W + 8), Digital (D + 8), Store (S + 8), Short (20 + 7)
  orderNumber: {
    gamestop: /\b11000000\d{8}\b/g,
    web: /\bW\d{8}\b/g,
    digital: /\bD\d{8}\b/g,
    store: /\bS\d{8}\b/g,
    short: /\b20\d{7}\b/g,
  },
  giftCard: /\b636\d{16}\b/g, // GameStop gift cards start with 636
  ticket: /\b\d{6}-\d{6}\b/g, // Freshdesk ticket ID format
  sku: [
    /\b\d{6}\b/g,       // 6-digit numeric SKU
    /\bPSA\d{8}\b/g,    // PSA-prefixed SKU
  ],
  tracking: {
    // FedEx: 12 or 14 digit, negative lookahead excludes PUR numbers (38...)
    fedex: [/\b(?!38\d{11})\d{12}\b/g, /\b(?!38\d{11})\d{14}\b/g],
    // USPS: multiple formats -- IMpb, certified, registered, intl, routing barcodes, etc.
    usps: [
      /\b(94|93|92|95)\d{18,20}\b/g,                              // IMpb (20-22 digit)
      /\b(94|93|92|95)\d{16}\b/g,                                  // IMpb (18 digit)
      /\b(70|14|23|03|02)\d{14}\b/g,                               // certified/registered
      /\b[A-Z]{2}\d{9}[A-Z]{2}\b/g,                                // international (e.g. RR123456789CN)
      /\b[MPCELV]\d{9}\b/g,                                        // 10-char letter-prefixed
      /\b[A-Z]{2}\d{9}US\b/g,                                      // US-origin international
      /\b420\d{5}(91|92|93|94|95|01|03|04|70|23|13)\d{22}\b/g,     // routing barcode with ZIP prefix
      /\b(43|42|41|03)\d{9}\b/g,                                    // older format
      /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2}\b/g,       // spaced 22-digit
    ],
  },
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: [
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,               // 5551234567 or 555-123-4567
    /\(\d{3}\)\s?\d{3}[-.]?\d{4}/g,                  // (555) 123-4567
    /\b\d{3}\s\d{3}\s\d{4}\b/g,                      // 555 123 4567
    /\+\d{1,2}\s?\d{3}[-.]?\d{3}[-.]?\d{4}/g,        // +1 555-123-4567
  ],
  pur: /\b38\d{11}\b/g,   // PUR (PowerUp Rewards) number -- starts with 38, 13 digits
  numbers: /\b\d+\b/g,    // generic number fallback
};

// Freshdesk DOM selectors (migrated from Zendesk)
export const SELECTORS = {
  ticket: {
    container: '.ticket-details, .ticket-content-wrapper, #ticket-details-container',
    content: '.ticket-content, .conversation-text',
    subject: '.ticket-subject-heading, .subject-field input, h2.heading',
    comments: '.conversation-pane .conversation, .reply-box',
    metadata: '.ticket-properties, .ticket-meta',
    customFields: '.ticket-custom-fields .custom-field, .custom_field',
  },
  // Customer info panel -- multiple selectors for Freshdesk layout variations
  customer: {
    container: '.contact-info, .requester-info, .ticket-requester, .contact-details',
    name: [
      '.contact-name a',
      '.contact-name',
      '.requester-name',
      '.contact-info .name',
      'a[data-contact-id]',
    ],
    email: [
      '.contact-email a',
      '.contact-email',
      '.requester-email',
      'a[href^="mailto:"]',
    ],
    phone: [
      '.contact-phone',
      '.requester-phone',
      'a[href^="tel:"]',
    ],
  },
};