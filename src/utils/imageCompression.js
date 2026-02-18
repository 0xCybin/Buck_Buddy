// src/utils/imageCompression.js
// Compresses pasted images for template storage using an offscreen canvas.
// Targets ~60-150KB per screenshot by resizing to max 800x600 and encoding as JPEG.

const MAX_WIDTH = 800;
const MAX_HEIGHT = 600;
const JPEG_QUALITY = 0.7;
export const MAX_IMAGES_PER_TEMPLATE = 3;

/**
 * Compress an image blob to a smaller JPEG data URL.
 * @param {Blob} blob - The raw image blob from clipboard
 * @returns {Promise<{dataUrl: string, width: number, height: number}>}
 */
export async function compressImage(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down preserving aspect ratio
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      resolve({ dataUrl, width, height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = url;
  });
}
