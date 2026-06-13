const { PRODUCT_IMAGE_FIXES } = require('../lib/product-image-fixes');

/** При каждом запуске сервера — безопасные правки FAQ и битых фото. */
function applyContentPatches(db) {
  const r1 = db.prepare(`
    UPDATE faq
    SET answer = 'Разные производители используют свои каталожные номера. Сверяйте по артикулу, модели авто и кросс-номерам.'
    WHERE section = 'parts'
      AND question = 'Почему один и тот же узел может иметь разные артикулы?'
      AND answer LIKE '%VIN%'
  `).run();

  const r2 = db.prepare(`
    UPDATE faq
    SET question = 'Как понять, что деталь подойдёт к моему автомобилю?',
        answer = 'Сверьте артикул и описание с вашей модификацией. Если сомневаетесь — уточните у менеджера при оформлении заказа.'
    WHERE section = 'parts'
      AND question = 'Как подобрать запчасть по VIN-коду?'
  `).run();

  const genUrl = PRODUCT_IMAGE_FIXES['PART-2110-GEN'];
  let r3 = { changes: 0 };
  if (genUrl) {
    r3 = db.prepare(`
      UPDATE products
      SET image_url = ?
      WHERE article_number = 'PART-2110-GEN'
        AND (image_url LIKE '%grantauto.ru%' OR image_url = '' OR image_url IS NULL)
    `).run(genUrl);
  }

  if (r1.changes || r2.changes || r3.changes) {
    console.log(`MotorHub patches: FAQ=${r1.changes + r2.changes}, generator=${r3.changes}`);
  }

  return { faq: r1.changes + r2.changes, generator: r3.changes };
}

module.exports = { applyContentPatches };
