// lib/imageDownscale.js  (browser)
// Shrinks a photo to max 1600 px on the long side as JPEG (~0.8) before upload:
// phone photos are often 4–8 MB, the API accepts 4 MB. PDFs and small files
// pass through unchanged. Falls back to the original file on any error.
export async function downscaleImage(file, maxSide = 1600, quality = 0.8) {
  try {
    if (!file?.type?.startsWith('image/') || file.type === 'image/gif') return file;
    if (file.size < 900 * 1024) return file;
    const url = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], (file.name || 'receipt').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
