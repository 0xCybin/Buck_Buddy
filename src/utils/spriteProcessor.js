// src/utils/spriteProcessor.js
// Canvas-based black background removal using edge flood fill.
// Preserves internal black details (eyes, outlines, shadows) by only
// removing near-black pixels connected to the image edges.

const processedCache = new Map();

export function removeBlackBackground(imgSrc, threshold = 25) {
  if (processedCache.has(imgSrc)) {
    return Promise.resolve(processedCache.get(imgSrc));
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const w = canvas.width = img.width;
      const h = canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, w, h);
      const { data } = imageData;
      const visited = new Uint8Array(w * h);
      const stack = [];

      // A pixel is "removable" if it's already transparent OR opaque near-black
      const isRemovable = (pos) => {
        const i = pos * 4;
        if (data[i + 3] < 10) return true;
        return data[i] < threshold && data[i + 1] < threshold && data[i + 2] < threshold;
      };

      // Seed flood fill from all edge pixels
      for (let x = 0; x < w; x++) {
        const top = x;
        const bottom = (h - 1) * w + x;
        if (isRemovable(top) && !visited[top]) { visited[top] = 1; stack.push(top); }
        if (isRemovable(bottom) && !visited[bottom]) { visited[bottom] = 1; stack.push(bottom); }
      }
      for (let y = 1; y < h - 1; y++) {
        const left = y * w;
        const right = y * w + w - 1;
        if (isRemovable(left) && !visited[left]) { visited[left] = 1; stack.push(left); }
        if (isRemovable(right) && !visited[right]) { visited[right] = 1; stack.push(right); }
      }

      // DFS flood fill: mark all connected removable pixels as transparent
      while (stack.length > 0) {
        const pos = stack.pop();
        const i = pos * 4;

        // Only blank out opaque pixels (transparent ones are already fine)
        if (data[i + 3] >= 10) {
          data[i + 3] = 0;
        }

        const x = pos % w;
        const y = (pos - x) / w;

        // 4-connected neighbors
        if (x > 0)     { const n = pos - 1; if (!visited[n] && isRemovable(n)) { visited[n] = 1; stack.push(n); } }
        if (x < w - 1) { const n = pos + 1; if (!visited[n] && isRemovable(n)) { visited[n] = 1; stack.push(n); } }
        if (y > 0)     { const n = pos - w; if (!visited[n] && isRemovable(n)) { visited[n] = 1; stack.push(n); } }
        if (y < h - 1) { const n = pos + w; if (!visited[n] && isRemovable(n)) { visited[n] = 1; stack.push(n); } }
      }

      ctx.putImageData(imageData, 0, 0);
      const result = canvas.toDataURL('image/png');
      processedCache.set(imgSrc, result);
      resolve(result);
    };

    img.onerror = () => resolve(imgSrc);
    img.src = imgSrc;
  });
}

// Batch process multiple images in parallel
export async function processSprites(srcMap) {
  const entries = Object.entries(srcMap);
  const results = await Promise.all(
    entries.map(([key, src]) =>
      removeBlackBackground(src).then(processed => [key, processed])
    )
  );
  return Object.fromEntries(results);
}

export function clearSpriteCache() {
  processedCache.clear();
}
