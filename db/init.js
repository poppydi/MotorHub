const bcrypt = require('bcryptjs');
const { initDb, getDb } = require('./index');

const db = initDb();

const adminHash = bcrypt.hashSync('admin123', 10);
const managerHash = bcrypt.hashSync('manager1', 10);
const customerHash = bcrypt.hashSync('customer1', 10);

db.prepare(`INSERT OR IGNORE INTO users (id, email, password_hash, name, surname, role) VALUES (1, 'admin@autonix.local', ?, 'Администратор', '', 'admin')`).run(adminHash);
db.prepare(`INSERT OR IGNORE INTO users (id, email, password_hash, name, surname, role) VALUES (2, 'manager@autonix.local', ?, 'Менеджер', '', 'manager')`).run(managerHash);
db.prepare(`INSERT OR IGNORE INTO users (id, email, password_hash, name, surname, phone, car, delivery_address, role) VALUES (3, 'darya@mail.ru', ?, 'Дарья', 'Брынцева', '+7 (912) 345-67-89', 'Lada Granta', 'г. Оренбург, ул. Чкалова д. 45', 'customer')`).run(customerHash);

if (db.prepare('SELECT COUNT(*) AS n FROM categories').get().n === 0) {
  db.prepare(`INSERT INTO categories (name, slug, sort_order) VALUES ('Автозапчасти', 'parts', 1), ('Моторные масла', 'oils', 2)`).run();
}

if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n === 0) {
  const catParts = db.prepare('SELECT id FROM categories WHERE slug = ?').get('parts').id;
  const catOils = db.prepare('SELECT id FROM categories WHERE slug = ?').get('oils').id;
  db.prepare(`
    INSERT INTO products (category_id, name, description, article_number, price_cents, stock, is_new) VALUES
    (?, 'Лукойл Genesis Claritech 5W-30', 'Синтетическое моторное масло 5л.', '2513213984', 350000, 50, 1),
    (?, 'Тормозные колодки (передние) для Lada Granta', 'Комплект передних тормозных колодок.', '53459358345', 80000, 30, 0),
    (?, 'Аккумуляторная батарея 60 Ач', 'Свинцово-кислотная АКБ 60 Ач.', '63632324', 800000, 15, 0),
    (?, 'Аккумуляторная батарея 80 Ач', 'Свинцово-кислотная АКБ 80 Ач.', '63632325', 950000, 12, 0),
    (?, 'Castrol Edge 5W-40', 'Синтетическое масло премиум-класса. 4л.', 'CAST-EDGE-5W40', 420000, 40, 1),
    (?, 'Mobil 1 ESP 5W-30', 'Полностью синтетическое моторное масло. 5л.', 'MOB1-ESP-5W30', 550000, 25, 0),
    (?, 'Свечи зажигания NGK (комплект 4 шт.)', 'Иридиевые свечи для бензиновых двигателей.', 'NGK-ILZKR7B-11', 320000, 80, 0),
    (?, 'Масляный фильтр Mann', 'Сменный масляный фильтр.', 'MANN-W712-83', 45000, 100, 0)
  `).run(catOils, catParts, catParts, catParts, catOils, catOils, catParts, catParts);
}

if (db.prepare('SELECT COUNT(*) AS n FROM faq').get().n === 0) {
  db.prepare(`
    INSERT INTO faq (section, question, answer, sort_order) VALUES
    ('parts', 'Как понять, что деталь оригинальная?', 'Оригинальные запчасти поставляются в фирменной упаковке с серийным номером, QR-кодом и маркировкой OEM.', 1),
    ('parts', 'Почему один и тот же узел может иметь разные артикулы?', 'Разные производители используют свои каталожные номера. Подбирайте по VIN или по кросс-номерам.', 2),
    ('parts', 'Можно ли ставить б/у запчасти вместо новых?', 'Б/у допустимы для некритичных узлов. Для тормозов, подвески, ГРМ рекомендуются только новые детали.', 3),
    ('parts', 'Как подобрать запчасть по VIN-коду?', 'Введите VIN в поле поиска на сайте или обратитесь к менеджеру.', 4),
    ('oils', 'Чем синтетическое масло отличается от полусинтетического?', 'Синтетика имеет стабильную структуру и дольше сохраняет свойства. Полусинтетика дешевле, подходит при регулярной замене.', 1),
    ('oils', 'Можно ли смешивать масла разных брендов?', 'В крайнем случае можно долить до уровня, но не рекомендуется: разные пакеты присадок могут снизить эффективность защиты.', 2),
    ('oils', 'Как часто нужно менять моторное масло?', 'Ориентируйтесь на пробег (10–15 тыс. км для синтетики) и на срок (не реже раза в год).', 3),
    ('oils', 'Нужно ли промывать двигатель при переходе на другое масло?', 'При переходе внутри одного типа промывка не обязательна. При смене типа может быть полезна.', 4)
  `).run();
}

console.log('МоторХаб DB initialized. Admin: admin@autonix.local / admin123, Customer: darya@mail.ru / customer1');
