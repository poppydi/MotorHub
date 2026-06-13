/**
 * Скачивает внешние URL картинок товаров, сжимает и сохраняет в public/uploads/.
 * Запуск: node db/cache-external-images.js
 */
const fs = require('fs');
const path = require('path');
const { initDb, getDb } = require('./index');
const { optimizeUploadedImage, isExternalImageUrl } = require('../lib/images');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
const TIMEOUT_MS = 20000;

async function downloadToTemp(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'MotorHub-ImageCache/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error('File too small');
  const ext = (res.headers.get('content-type') || '').includes('png') ? '.png' : '.jpg';
  const tempPath = path.join(uploadDir, `tmp-${Date.now()}${ext}`);
  fs.writeFileSync(tempPath, buf);
  return tempPath;
}

async function cacheExternalImages() {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  initDb();
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, name, image_url FROM products
    WHERE image_url != '' AND (image_url LIKE 'http://%' OR image_url LIKE 'https://%')
  `).all();

  console.log(`Найдено товаров с внешними фото: ${rows.length}`);
  let ok = 0;
  let fail = 0;

  for (const row of rows) {
    process.stdout.write(`[${row.id}] ${row.name.slice(0, 40)}… `);
    try {
      const tempPath = await downloadToTemp(row.image_url);
      const filename = await optimizeUploadedImage(tempPath);
      const imageUrl = '/uploads/' + filename;
      db.prepare('UPDATE products SET image_url = ? WHERE id = ?').run(imageUrl, row.id);
      console.log('OK →', imageUrl);
      ok++;
    } catch (err) {
      console.log('FAIL:', err.message);
      fail++;
    }
  }

  console.log(`\nГотово: ${ok} успешно, ${fail} ошибок`);
}

cacheExternalImages().catch((err) => {
  console.error(err);
  process.exit(1);
});
