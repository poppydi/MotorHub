const { getDb } = require('./index');

function formatPrice(cents) {
  return new Intl.NumberFormat('ru-RU', { style: 'decimal', maximumFractionDigits: 0 }).format(cents / 100) + ' ₽';
}

function getDefaultProductDescription(categorySlug) {
  if (categorySlug === 'oils') return 'Качественное моторное масло для стабильной работы двигателя.';
  return 'Надежная автозапчасть для ежедневной эксплуатации автомобиля.';
}

function getCategories() {
  return getDb().prepare("SELECT id, name, slug FROM categories WHERE slug IN ('parts', 'oils') ORDER BY sort_order").all();
}

function getProducts(filters = {}) {
  const { categoryId, categorySlug, search, sort = 'name' } = filters;
  let sql = `SELECT p.id, p.category_id, p.name, p.description, p.article_number, p.price_cents, p.stock, p.image_url, p.is_new, c.name AS category_name, c.slug AS category_slug FROM products p JOIN categories c ON p.category_id = c.id WHERE 1=1`;
  const params = [];
  if (categoryId) { sql += ' AND p.category_id = ?'; params.push(categoryId); }
  if (categorySlug) { sql += ' AND c.slug = ?'; params.push(categorySlug); }
  if (search && String(search).trim()) {
    sql += ' AND (p.name LIKE ? OR p.article_number LIKE ? OR p.description LIKE ?)';
    const term = '%' + String(search).trim() + '%';
    params.push(term, term, term);
  }
  sql += ' ORDER BY ' + (sort === 'price_asc' ? 'p.price_cents ASC' : sort === 'price_desc' ? 'p.price_cents DESC' : 'p.name ASC');
  const rows = getDb().prepare(sql).all(...params);
  return rows.map(p => ({
    id: p.id, categoryId: p.category_id, categoryName: p.category_name, categorySlug: p.category_slug,
    name: p.name, description: (p.description || '').trim() || getDefaultProductDescription(p.category_slug), articleNumber: p.article_number || '',
    priceCents: p.price_cents, price: formatPrice(p.price_cents), stock: p.stock,
    imageUrl: p.image_url || '', isNew: !!p.is_new,
  }));
}

function getProductById(id) {
  const p = getDb().prepare('SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p JOIN categories c ON p.category_id = c.id WHERE p.id = ?').get(parseInt(id, 10));
  if (!p) return null;
  return { id: p.id, categoryId: p.category_id, categoryName: p.category_name, categorySlug: p.category_slug, name: p.name, description: (p.description || '').trim() || getDefaultProductDescription(p.category_slug), articleNumber: p.article_number || '', priceCents: p.price_cents, price: formatPrice(p.price_cents), stock: p.stock, imageUrl: p.image_url || '', isNew: !!p.is_new };
}

function getFaq(section) {
  return getDb().prepare('SELECT id, question, answer FROM faq WHERE section = ? ORDER BY sort_order').all(section);
}

function getUsers() {
  return getDb().prepare('SELECT id, email, name, surname, phone, car, delivery_address, role, created_at FROM users ORDER BY id').all();
}

function getUserById(id) {
  const u = getDb().prepare('SELECT * FROM users WHERE id = ?').get(parseInt(id, 10));
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name, surname: u.surname || '', phone: u.phone || '', car: u.car || '', deliveryAddress: u.delivery_address || '', role: u.role, createdAt: u.created_at };
}

function getOrdersByUserId(userId) {
  const rows = getDb().prepare('SELECT o.id, o.status, o.subtotal_cents, o.delivery_cents, o.total_cents, o.created_at FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC').all(userId);
  return rows.map(o => ({ id: o.id, status: o.status, subtotalCents: o.subtotal_cents, deliveryCents: o.delivery_cents, totalCents: o.total_cents, subtotal: formatPrice(o.subtotal_cents), delivery: formatPrice(o.delivery_cents), total: formatPrice(o.total_cents), createdAt: o.created_at }));
}

function getOrderWithItems(orderId, userId = null) {
  const o = getDb().prepare('SELECT * FROM orders WHERE id = ?' + (userId ? ' AND user_id = ?' : '')).get(userId ? [orderId, userId] : orderId);
  if (!o) return null;
  const items = getDb().prepare('SELECT oi.id, oi.product_id, oi.quantity, oi.price_cents, p.name AS product_name, p.article_number FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?').all(o.id);
  return { id: o.id, userId: o.user_id, status: o.status, subtotalCents: o.subtotal_cents, deliveryCents: o.delivery_cents, totalCents: o.total_cents, deliveryAddress: o.delivery_address, promoCode: o.promo_code, bonusCard: o.bonus_card, createdAt: o.created_at, items: items.map(i => ({ id: i.id, productId: i.product_id, productName: i.product_name, articleNumber: i.article_number, quantity: i.quantity, priceCents: i.price_cents, price: formatPrice(i.price_cents), sumCents: i.quantity * i.price_cents })) };
}

function getAllOrders() {
  const rows = getDb().prepare('SELECT o.id, o.user_id, o.status, o.total_cents, o.created_at, u.name AS user_name, u.email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC').all();
  return rows.map(o => ({ id: o.id, userId: o.user_id, userName: o.user_name, userEmail: o.email, status: o.status, totalCents: o.total_cents, total: formatPrice(o.total_cents), createdAt: o.created_at }));
}

function getUserByEmail(email) {
  return getDb().prepare('SELECT id, email, password_hash, name, surname, phone, car, delivery_address, role FROM users WHERE email = ?').get(email);
}

function createUser(data) {
  const r = getDb().prepare(
    'INSERT INTO users (email, password_hash, name, surname, phone, car, delivery_address, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(data.email, data.passwordHash, data.name, data.surname || '', data.phone || '', data.car || '', data.deliveryAddress || '', data.role || 'customer');
  return r.lastInsertRowid;
}

function updateUser(id, data) {
  getDb().prepare(
    'UPDATE users SET name = ?, surname = ?, phone = ?, car = ?, delivery_address = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).run(data.name, data.surname || '', data.phone || '', data.car || '', data.deliveryAddress || '', id);
}

function updateUserRole(id, role) {
  getDb().prepare('UPDATE users SET role = ?, updated_at = datetime(\'now\') WHERE id = ?').run(role, id);
}

function deleteUser(id) {
  getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
}

function insertProduct(data) {
  const r = getDb().prepare(
    'INSERT INTO products (category_id, name, description, article_number, price_cents, stock, image_url, is_new) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(data.categoryId, data.name, data.description || '', data.articleNumber || '', data.priceCents, data.stock || 0, data.imageUrl || '', data.isNew ? 1 : 0);
  return r.lastInsertRowid;
}

function updateProduct(id, data) {
  getDb().prepare(
    'UPDATE products SET category_id = ?, name = ?, description = ?, article_number = ?, price_cents = ?, stock = ?, image_url = ?, is_new = ? WHERE id = ?'
  ).run(data.categoryId, data.name, data.description || '', data.articleNumber || '', data.priceCents, data.stock || 0, data.imageUrl || '', data.isNew ? 1 : 0, id);
}

function deleteProduct(id) {
  getDb().prepare('DELETE FROM products WHERE id = ?').run(id);
}

function createOrder(data) {
  const r = getDb().prepare(
    'INSERT INTO orders (user_id, status, subtotal_cents, delivery_cents, total_cents, delivery_address, promo_code, bonus_card) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(data.userId, data.status || 'new', data.subtotalCents, data.deliveryCents || 0, data.totalCents, data.deliveryAddress || '', data.promoCode || '', data.bonusCard || '');
  return r.lastInsertRowid;
}

function createOrderItem(orderId, productId, quantity, priceCents) {
  getDb().prepare('INSERT INTO order_items (order_id, product_id, quantity, price_cents) VALUES (?, ?, ?, ?)').run(orderId, productId, quantity, priceCents);
}

function updateOrderStatus(id, status) {
  getDb().prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
}

module.exports = {
  formatPrice, getCategories, getProducts, getProductById, getFaq,
  getUsers, getUserById, getUserByEmail, getOrdersByUserId, getOrderWithItems, getAllOrders,
  createUser, updateUser, updateUserRole, deleteUser,
  insertProduct, updateProduct, deleteProduct,
  createOrder, createOrderItem, updateOrderStatus,
};
