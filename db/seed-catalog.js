/** Дополнительные товары из прайса (добавляются при init-db, если артикула ещё нет). */

const PARTS = [
  { name: 'Колодки тормозные передние 2110 АТС', description: 'Комплект передних колодок для ВАЗ 2110.', article: 'PART-2110-PAD', priceCents: 36300, stock: 24 },
  { name: 'Диски тормозные передние 2108 R13 АТС', description: 'Передние тормозные диски, диаметр R13.', article: 'PART-2108-DISC', priceCents: 190000, stock: 12 },
  { name: 'Амортизатор задний 2108 Гарда', description: 'Задний амортизатор для ВАЗ 2108.', article: 'PART-2108-SHOCK-R', priceCents: 107800, stock: 18 },
  { name: 'Стойки передние 2190 Гарда', description: 'Передние стойки амортизатора Lada 2190.', article: 'PART-2190-STRUT', priceCents: 385220, stock: 8 },
  { name: 'Генератор 2110 Автопартнер', description: 'Генератор для двигателей ВАЗ 2110.', article: 'PART-2110-GEN', priceCents: 485100, stock: 6 },
  { name: 'Стартер 2108 Автопартнер', description: 'Стартер для ВАЗ 2108.', article: 'PART-2108-START', priceCents: 330000, stock: 7 },
  { name: 'Комплект сцепления 2110 Начало', description: 'Диск, корзина, выжимной подшипник.', article: 'PART-2110-CLUTCH', priceCents: 292600, stock: 5 },
  { name: 'Шланг тормозной передний 2110', description: 'Передний тормозной шланг ВАЗ 2110.', article: 'PART-2110-HOSE', priceCents: 42000, stock: 30 },
  { name: 'Шаровые опоры 2110 (комплект)', description: 'Комплект шаровых опор на обе стороны.', article: 'PART-2110-BALL', priceCents: 75000, stock: 16 },
  { name: 'Ремень ГРМ 2190', description: 'Ремень газораспределительного механизма.', article: 'PART-2190-TBELT', priceCents: 290000, stock: 14 },
  { name: 'Свечи зажигания 2108 (комплект)', description: 'Комплект свечей для бензинового двигателя.', article: 'PART-2108-SPARK', priceCents: 80000, stock: 40 },
  { name: 'Мотор стеклоочистителя 2110', description: 'Электродвигатель трапеции дворников.', article: 'PART-2110-WIPER', priceCents: 200000, stock: 9 },
  { name: 'Ролик натяжителя ГРМ', description: 'Натяжной ролик ремня ГРМ.', article: 'PART-GRM-ROLLER', priceCents: 80000, stock: 22 },
  { name: 'Прокладка ГБЦ 2101', description: 'Прокладка головки блока цилиндров.', article: 'PART-2101-GASKET', priceCents: 145000, stock: 11 },
  { name: 'Замок багажника 2108 Лого-Д', description: 'Замок крышки багажника ВАЗ 2108.', article: 'PART-2108-LOCK', priceCents: 52690, stock: 15 },
];

const OILS = [
  { name: 'Лукойл Genesis Universal 5W-40, 4 л', description: 'Моторное масло для бензиновых и дизельных двигателей.', article: 'OIL-LUK-GEN-5W40-4', priceCents: 220000, stock: 35, isNew: 1 },
  { name: 'Лукойл Genesis Armortech 5W-40, 4 л', description: 'Синтетическое масло с усиленной защитой.', article: 'OIL-LUK-ARM-5W40-4', priceCents: 248000, stock: 28 },
  { name: 'Shell Helix HX7 10W-40, 1 л', description: 'Полусинтетическое масло Shell Helix HX7.', article: 'OIL-SHELL-HX7-10W40-1', priceCents: 85000, stock: 50 },
  { name: 'Shell Helix HX7 5W-40, 1 л', description: 'Моторное масло для современных двигателей.', article: 'OIL-SHELL-HX7-5W40-1', priceCents: 92000, stock: 48 },
  { name: 'TOTAL Quartz 9000 5W-40, 1 л', description: 'Синтетическое масло TOTAL Quartz 9000.', article: 'OIL-TOTAL-9000-5W40-1', priceCents: 118000, stock: 32 },
  { name: 'Gazpromneft Super 10W-40, 5 л', description: 'Полусинтетическое масло, канистра 5 л.', article: 'OIL-GPN-SUPER-10W40-5', priceCents: 182000, stock: 26 },
  { name: 'G-Energy Expert L 5W-40, 4 л', description: 'Моторное масло G-Energy Expert L.', article: 'OIL-GEN-EXPERT-5W40-4', priceCents: 215000, stock: 20 },
  { name: 'G-Energy Super Start 5W-30, 1 л', description: 'Синтетическое масло для холодного пуска.', article: 'OIL-GEN-START-5W30-1', priceCents: 96000, stock: 38 },
  { name: 'ELF Evolution 900 NF 5W-40, 1 л', description: 'Моторное масло ELF Evolution 900 NF.', article: 'OIL-ELF-EVO-5W40-1', priceCents: 112000, stock: 30 },
  { name: 'ZIC ATF Dexron III, 1 л', description: 'Трансмиссионное масло для АКПП.', article: 'OIL-ZIC-ATF-1', priceCents: 65000, stock: 25 },
  { name: 'Тосол -40 «Полярник», 10 кг', description: 'Антифриз для системы охлаждения.', article: 'OIL-TOSOL-40-10', priceCents: 89000, stock: 18 },
  { name: 'Felix DOT 4, тормозная жидкость 910 г', description: 'Тормозная жидкость DOT 4.', article: 'OIL-FELIX-DOT4-910', priceCents: 42000, stock: 45 },
];

function seedCatalogProducts(db) {
  const catParts = db.prepare('SELECT id FROM categories WHERE slug = ?').get('parts')?.id;
  const catOils = db.prepare('SELECT id FROM categories WHERE slug = ?').get('oils')?.id;
  if (!catParts || !catOils) return { added: 0 };

  const insert = db.prepare(`
    INSERT INTO products (category_id, name, description, article_number, price_cents, stock, is_new)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const exists = db.prepare('SELECT 1 FROM products WHERE article_number = ?');

  let added = 0;
  for (const p of PARTS) {
    if (exists.get(p.article)) continue;
    insert.run(catParts, p.name, p.description, p.article, p.priceCents, p.stock, 0);
    added++;
  }
  for (const o of OILS) {
    if (exists.get(o.article)) continue;
    insert.run(catOils, o.name, o.description, o.article, o.priceCents, o.stock, o.isNew ? 1 : 0);
    added++;
  }
  return { added };
}

module.exports = { seedCatalogProducts, PARTS, OILS };
