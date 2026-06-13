#!/usr/bin/env node
/** Проверка: новый код на сервере или старый. Запуск: node scripts/check-deploy.js [url] */
const base = process.argv[2] || 'https://motor-hub.ru';

async function main() {
  console.log('Проверяю', base, '...\n');

  try {
    const health = await fetch(base + '/api/health').then((r) => r.json());
    if (health.build === '2026-06-14') {
      console.log('✓ Новый код на сервере (build 2026-06-14)');
    } else {
      console.log('✗ Старый код — endpoint /api/health не найден или другая версия');
      console.log('  Нужно загрузить файлы на VPS и перезапустить pm2');
    }
    console.log('  hasVinQuestion:', health.hasVinQuestion);
    console.log('  FAQ:', health.faqParts);
  } catch {
    console.log('✗ /api/health недоступен — на сервере СТАРЫЙ server.js');
  }

  const faq = await fetch(base + '/api/faq/parts').then((r) => r.json());
  const vin = faq.find((f) => /VIN/i.test(f.question));
  if (vin) {
    console.log('\n✗ Вопрос про VIN всё ещё в базе:', vin.question);
    console.log('  Загрузите db/content-patches.js, db/index.js, server.js и выполните: pm2 restart all');
  } else {
    console.log('\n✓ VIN-вопрос убран из FAQ');
  }

  const products = await fetch(base + '/api/products?category=parts').then((r) => r.json());
  const gen = products.find((p) => p.articleNumber === 'PART-2110-GEN');
  const external = products.filter((p) => p.imageUrl && p.imageUrl.startsWith('http')).length;
  console.log('\nГенератор:', gen && gen.imageUrl);
  console.log('Внешних фото (медленные):', external);
  if (external > 0) {
    console.log('  Выполните на VPS: npm run apply-site-fixes');
  }
}

main().catch(console.error);
