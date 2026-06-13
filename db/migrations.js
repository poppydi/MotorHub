const { PRODUCT_IMAGE_FIXES } = require('../lib/product-image-fixes');

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY
    );
  `);

  const migrations = [
    {
      name: '2026-06-14-faq-no-vin',
      run(database) {
        database.prepare(`
          UPDATE faq
          SET answer = 'Разные производители используют свои каталожные номера. Сверяйте по артикулу, модели авто и кросс-номерам.'
          WHERE section = 'parts'
            AND question = 'Почему один и тот же узел может иметь разные артикулы?'
        `).run();

        database.prepare(`
          UPDATE faq
          SET question = 'Как понять, что деталь подойдёт к моему автомобилю?',
               answer = 'Сверьте артикул и описание с вашей модификацией. Если сомневаетесь — уточните у менеджера при оформлении заказа.'
          WHERE section = 'parts'
            AND question = 'Как подобрать запчасть по VIN-коду?'
        `).run();
      },
    },
    {
      name: '2026-06-14-fix-generator-image',
      run(database) {
        const url = PRODUCT_IMAGE_FIXES['PART-2110-GEN'];
        if (!url) return;
        database.prepare(`
          UPDATE products
          SET image_url = ?
          WHERE article_number = 'PART-2110-GEN'
            AND (image_url LIKE '%grantauto.ru%' OR image_url = '' OR image_url IS NULL)
        `).run(url);
      },
    },
  ];

  const applied = db.prepare('SELECT name FROM migrations').all().map((r) => r.name);
  const mark = db.prepare('INSERT INTO migrations (name) VALUES (?)');

  for (const migration of migrations) {
    if (applied.includes(migration.name)) continue;
    migration.run(db);
    mark.run(migration.name);
    console.log(`Migration applied: ${migration.name}`);
  }
}

module.exports = { runMigrations };
