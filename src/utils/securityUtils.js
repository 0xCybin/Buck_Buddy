/**
 * securityUtils.js -- Data masking utilities for customer PII.
 * Detects and masks sensitive data (names, emails, addresses, phones, credit cards,
 * order/tracking numbers) using regex patterns from patterns.js.
 */

import { PATTERNS } from "./patterns";

// Physical address patterns (street lines, ZIP codes, PO boxes)
const ADDRESS_PATTERNS = {
  streetAddress: /\b\d+\s+([A-Za-z]+(\.?\s)?)+\b/g,
  zipCode: /\b\d{5}(-\d{4})?\b/g,
  poBox: /\bP\.?O\.?\s*Box\s+\d+\b/gi,
};

// Unified map of all PII patterns: type -> regex or regex[]
const SENSITIVE_PATTERNS = {
  ...PATTERNS.orderNumber,
  tracking: Object.values(PATTERNS.tracking).flat(),
  phone: PATTERNS.phone,
  email: PATTERNS.email,
  creditCard: /\b(?:\d[ -]*?){13,16}\b/g,
  address: Object.values(ADDRESS_PATTERNS),
};

/**
 * Masks a string with asterisks while preserving some characters for context
 * @param {string} str - String to mask
 * @param {number} preserveStart - Number of characters to preserve at start
 * @param {number} preserveEnd - Number of characters to preserve at end
 * @returns {string} Masked string
 */
const maskString = (str, preserveStart = 0, preserveEnd = 0) => {
  if (!str) return str;
  const length = str.length;
  const maskedLength = length - preserveStart - preserveEnd;
  if (maskedLength <= 0) return str;

  return (
    str.slice(0, preserveStart) +
    "*".repeat(maskedLength) +
    str.slice(length - preserveEnd)
  );
};

/**
 * Determines appropriate masking format based on data type
 * @param {string} match - String to mask
 * @param {string} type - Type of sensitive data
 * @returns {string} Masked string
 */
const getMaskedValue = (match, type) => {
  switch (type) {
    case "creditCard":
      return maskString(match, 4, 4); // "4111****1111"
    case "phone":
      return maskString(match, 0, 4); // "******1234"
    case "email":
      const [localPart, domain] = match.split("@");
      return `${maskString(localPart, 2, 0)}@${domain}`; // "jo****@domain.com"
    case "address":
      // Keep house number + street suffix; mask the middle.
      // BUG: assumes 2+ words -- single-word addresses will produce garbled output.
      const words = match.split(" ");
      return `${words[0]} ${maskString(words.slice(1, -1).join(" "))} ${words[words.length - 1]}`;
    default:
      return maskString(match, 2, 2); // generic: preserve first 2 and last 2 chars
  }
};

/**
 * Masks all sensitive information in a string
 * @param {string} input - Input string to mask
 * @returns {string} String with sensitive data masked
 */
// Replace all detected PII in a string with masked versions
export const maskSensitiveData = (input) => {
  if (!input || typeof input !== "string") return input;

  let maskedText = input;

  // Iterate every pattern type and apply its masking strategy
  Object.entries(SENSITIVE_PATTERNS).forEach(([type, patterns]) => {
    const patternArray = Array.isArray(patterns) ? patterns : [patterns];

    patternArray.forEach((pattern) => {
      maskedText = maskedText.replace(pattern, (match) => {
        return getMaskedValue(match, type);
      });
    });
  });

  return maskedText;
};

/**
 * Checks if a string contains sensitive information
 * @param {string} input - Input string to check
 * @returns {boolean} True if sensitive data is found
 */
// Quick boolean check -- does not mask, just tests for any PII match.
// Uses fresh RegExp copies to avoid /g lastIndex statefulness bugs.
export const containsSensitiveData = (input) => {
  if (!input || typeof input !== "string") return false;

  return Object.values(SENSITIVE_PATTERNS).some((patterns) => {
    const patternArray = Array.isArray(patterns) ? patterns : [patterns];
    return patternArray.some((pattern) => {
      const fresh = new RegExp(pattern.source, pattern.flags);
      return fresh.test(input);
    });
  });
};
