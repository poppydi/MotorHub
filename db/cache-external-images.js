/**
 * Скачивает внешние URL картинок товаров, сжимает и сохраняет в public/uploads/.
 * Запуск: npm run cache-product-images
 */
const fs = require('fs');
const path = require('path');
const { initDb, getDb } = require('./index');
const { optimizeUploadedImage } = require('../lib/images');
const { PRODUCT_IMAGE_FIXES } = require('../lib/product-image-fixes');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
const PLACEHOLDER = '/img/product-placeholder.svg';
const TIMEOUT_MS = 25000;

function applyKnownFixes(db) {
  for (const [article, url] of Object.entries(PRODUCT_IMAGE_FIXES)) {
    db.prepare(`
      UPDATE products SET image_url = ?
      WHERE article_number = ?
        AND (
          image_url LIKE 'http://%' OR image_url LIKE 'https://%'
          OR image_url = ? OR image_url LIKE '%grantauto.ru%'
        )
    `).run(url, article, PLACEHOLDER);
  }
}

async function downloadToTemp(url, slug) {
  const origin = new URL(url).origin;
  const safeSlug = String(slug || 'img').replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 48);
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: origin + '/',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) throw new Error('File too small');
  const ct = res.headers.get('content-type') || '';
  const ext = ct.includes('png') ? '.png' : ct.includes('webp') ? '.webp' : '.jpg';
  const tempPath = path.join(uploadDir, `${safeSlug}-${Date.now()}${ext === '.webp' ? '.bin' : ext}`);
  fs.writeFileSync(tempPath, buf);
  return tempPath;
}

async function cacheExternalImages() {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  initDb();
  const db = getDb();
  applyKnownFixes(db);

  const rows = db.prepare(`
    SELECT id, name, article_number, image_url FROM products
    WHERE image_url != '' AND (image_url LIKE 'http://%' OR image_url LIKE 'https://%')
  `).all();

  console.log(`Найдено товаров с внешними фото: ${rows.length}`);
  let ok = 0;
  let fail = 0;

  for (const row of rows) {
    const label = row.article_number || row.name.slice(0, 30);
    process.stdout.write(`[${row.id}] ${label}… `);
    try {
      const tempPath = await downloadToTemp(row.image_url, row.article_number || `id${row.id}`);
      const filename = await optimizeUploadedImage(tempPath);
      const imageUrl = '/uploads/' + filename;
      db.prepare('UPDATE products SET image_url = ? WHERE id = ?').run(imageUrl, row.id);
      console.log('OK →', imageUrl);
      ok++;
    } catch (err) {
      db.prepare('UPDATE products SET image_url = ? WHERE id = ?').run(PLACEHOLDER, row.id);
      console.log('FAIL → placeholder:', err.message);
      fail++;
    }
  }

  console.log(`\nГотово: ${ok} скачано, ${fail} заменено на заглушку`);
}

cacheExternalImages().catch((err) => {
  console.error(err);
  process.exit(1);
});
