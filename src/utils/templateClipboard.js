// src/utils/templateClipboard.js
// Copies a template to the clipboard. For templates with image attachments,
// builds rich HTML with inline <img> tags and writes both text/html and
// text/plain to the clipboard via ClipboardItem. Falls back to writeText
// for text-only templates.

import { resolveTemplateVariables } from './templateVariables';

/**
 * Escapes HTML special characters in a string.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Copy a template to the clipboard with image support.
 * @param {Object} template - Template object with content, and optional attachments[]
 * @param {Object} ticketData - Current ticket data for variable resolution
 */
export async function copyTemplateToClipboard(template, ticketData) {
  const resolved = resolveTemplateVariables(template.content, ticketData);

  // Text-only path: no attachments, use simple writeText
  if (!template.attachments || template.attachments.length === 0) {
    await navigator.clipboard.writeText(resolved);
    return;
  }

  // Rich clipboard path: build HTML with inline images
  const plainText = resolved.replace(/\[Screenshot \d+\]/g, '[image]');

  // Split on [Screenshot N] placeholders and interleave with <img> tags
  const parts = resolved.split(/(\[Screenshot \d+\])/g);
  let html = '';

  for (const part of parts) {
    const match = part.match(/^\[Screenshot (\d+)\]$/);
    if (match) {
      const index = parseInt(match[1], 10) - 1;
      const attachment = template.attachments[index];
      if (attachment) {
        html += `<img src="${attachment.dataUrl}" width="${attachment.width}" height="${attachment.height}" style="max-width:100%;height:auto;display:block;margin:8px 0;" />`;
      } else {
        html += escapeHtml(part);
      }
    } else {
      // Convert newlines to <br> for rich text, escape HTML
      html += escapeHtml(part).replace(/\n/g, '<br>');
    }
  }

  const htmlBlob = new Blob([html], { type: 'text/html' });
  const textBlob = new Blob([plainText], { type: 'text/plain' });

  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': htmlBlob,
      'text/plain': textBlob,
    }),
  ]);
}
