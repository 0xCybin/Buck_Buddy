// src/utils/templateVariables.js
// Template variable substitution for quick-reply templates. Replaces
// {Placeholder} tokens in template strings with data extracted from the
// current Freshdesk ticket. Array fields (orders, tracking, etc.) use
// the first element only.

// Maps display placeholder names to ticketData keys.
// isArray: true means the data source is a list; only the first item is used.
export const TEMPLATE_VARIABLES = [
  { placeholder: 'Customer Name', key: 'customerName', isArray: false },
  { placeholder: 'Order Number', key: 'orderNumbers', isArray: true },
  { placeholder: 'Tracking Number', key: 'trackingNumbers', isArray: true },
  { placeholder: 'Email', key: 'emails', isArray: true },
  { placeholder: 'Phone', key: 'phones', isArray: true },
  { placeholder: 'Store Number', key: 'storeNumbers', isArray: true },
  { placeholder: 'Gift Card', key: 'giftCards', isArray: true },
  { placeholder: 'PUR Number', key: 'purNumbers', isArray: true },
  { placeholder: 'SKU', key: 'skus', isArray: true },
  { placeholder: 'Ticket Number', key: 'tickets', isArray: true },
];

/**
 * Replaces {Variable Name} placeholders in a template string with actual ticket data.
 * - Case-insensitive matching
 * - Array fields use the first item
 * - Unresolved placeholders are left as-is
 */
export function resolveTemplateVariables(content, ticketData) {
  if (!content || !ticketData) return content;

  let resolved = content;

  for (const { placeholder, key, isArray } of TEMPLATE_VARIABLES) {
    // Build case-insensitive regex for {placeholder}
    const regex = new RegExp(`\\{${placeholder}\\}`, 'gi');

    const raw = ticketData[key];
    let value;

    if (isArray) {
      value = Array.isArray(raw) && raw.length > 0 ? raw[0] : null;
    } else {
      value = raw || null;
    }

    if (value) {
      resolved = resolved.replace(regex, value);
    }
    // If value is null/undefined, leave the placeholder as-is
  }

  return resolved;
}
