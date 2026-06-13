const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const MAX_WIDTH = 800;
const WEBP_QUALITY = 82;

async function optimizeUploadedImage(inputPath) {
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(dir, `${base}.webp`);
  const tempPath = path.join(dir, `_opt_${Date.now()}.webp`);

  await sharp(inputPath)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(tempPath);

  if (path.resolve(inputPath) !== path.resolve(outputPath)) {
    try { fs.unlinkSync(inputPath); } catch (_) { /* Windows may lock briefly */ }
  }
  if (fs.existsSync(outputPath)) {
    try { fs.unlinkSync(outputPath); } catch (_) {}
  }
  fs.renameSync(tempPath, outputPath);

  return path.basename(outputPath);
}

function isLocalUploadUrl(url) {
  return typeof url === 'string' && url.startsWith('/uploads/');
}

function isExternalImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

module.exports = {
  optimizeUploadedImage,
  isLocalUploadUrl,
  isExternalImageUrl,
  MAX_WIDTH,
  WEBP_QUALITY,
};
