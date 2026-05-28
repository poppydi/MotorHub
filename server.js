
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const multer = require('multer');
const session = require('express-session');
const methodOverride = require('method-override');

const { initDb, getDb } = require('./db');
const {
  getCategories, getProducts, getProductById, getFaq,
  getUsers, getUserById, getUserByEmail, getOrdersByUserId, getOrderWithItems, getAllOrders,
  getAdminProducts, getAdminUsers, getAdminOrders,
  createUser, updateUser, updateUserPassword, updateUserRole, deleteUser,
  insertProduct, updateProduct, deleteProduct,
  createOrder, createOrderItem, fulfillOrder, updateOrderStatus, deleteOrder,
  formatPrice,
} = require('./db/queries');
const { hashPassword, comparePassword, requireAuth, requireRole, requireStaff } = require('./lib/auth');
const { LIMITS, clampStr, clampInt, normalizePhone, isValidPhone } = require('./lib/validation');
const { paginateCatalog, CATALOG_PER_PAGE } = require('./lib/catalog');

initDb();

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + (file.originalname || 'img').replace(/[^a-zA-Z0-9.-]/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const app = express();
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const ORDER_STATUS_LABELS = {
  new: 'Новый',
  confirmed: 'Сборка',
  shipped: 'Готов к выдаче',
  delivered: 'Выдан',
  cancelled: 'Отменён'
};

const isProduction = process.env.NODE_ENV === 'production';

function redirectAfterAuth(req, res, user) {
  let target = clampStr(req.body.redirect || req.query.redirect || '', 256);
  if (!target || !target.startsWith('/')) {
    const role = user.role || getDb().prepare('SELECT role FROM users WHERE id = ?').get(user.id)?.role;
    target = (role === 'admin' || role === 'manager') ? '/admin' : '/account';
  }
  req.session.save((err) => {
    if (err) {
      return res.render('login', { error: 'Ошибка сессии, попробуйте снова', success: null, categories: getCategories(), redirect: target });
    }
    res.redirect(target);
  });
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'autonix-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use((req, res, next) => {
  if (!req.session.cart) req.session.cart = [];
  res.locals.cartCount = req.session.cart.reduce((s, i) => s + (i.quantity || 0), 0);
  res.locals.userId = req.session?.userId;
  res.locals.userName = req.session?.userName;
  if (req.session?.userId) {
    const u = getDb().prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
    res.locals.userRole = u?.role || 'customer';
    res.locals.isStaff = u && (u.role === 'admin' || u.role === 'manager');
  } else {
    res.locals.userRole = null;
    res.locals.isStaff = false;
  }
  res.locals.orderStatusLabel = function orderStatusLabel(status) {
    return ORDER_STATUS_LABELS[status] || status || 'Неизвестно';
  };
  res.locals.orderStatusStep = function orderStatusStep(status) {
    if (status === 'new') return 1;
    if (status === 'confirmed') return 2;
    if (status === 'shipped') return 3;
    if (status === 'delivered') return 4;
    return 0;
  };
  next();
});

function getCartWithProducts(req) {
  const cart = req.session.cart || [];
  const db = getDb();
  const items = [];
  let subtotalCents = 0;
  for (const c of cart) {
    const p = db.prepare('SELECT id, name, article_number, price_cents, stock, image_url FROM products WHERE id = ?').get(parseInt(c.productId, 10));
    if (p) {
      const qty = Math.min(clampInt(c.quantity, 1, LIMITS.quantity.max), p.stock);
      const sum = qty * p.price_cents;
      subtotalCents += sum;
      items.push({ productId: p.id, name: p.name, articleNumber: p.article_number, priceCents: p.price_cents, price: formatPrice(p.price_cents), quantity: qty, sumCents: sum, sum: formatPrice(sum), stock: p.stock, imageUrl: p.image_url || '' });
    }
  }
  return { items, subtotalCents, subtotal: formatPrice(subtotalCents) };
}

app.get('/', (req, res) => {
  const categories = getCategories();
  const products = getProducts({ sort: 'name' }).slice(0, 8);
  res.render('index', { categories, products });
});

function renderCatalogPage(req, res, { categorySlug, template, faqSection }) {
  const categories = getCategories();
  const search = clampStr(req.query.search, LIMITS.search.max);
  const sort = ['name', 'price_asc', 'price_desc', 'newest'].includes(req.query.sort) ? req.query.sort : 'newest';
  const sortKey = sort === 'newest' ? 'id_desc' : sort;
  const allProducts = getProducts({ categorySlug, search, sort: sortKey });
  const paginated = paginateCatalog(allProducts, req.query.page);
  const products = paginated.items.slice(0, CATALOG_PER_PAGE);
  const { page, totalPages, total } = paginated;
  const faq = getFaq(faqSection);
  const qs = [];
  if (search) qs.push('search=' + encodeURIComponent(search));
  if (sort && sort !== 'newest') qs.push('sort=' + encodeURIComponent(sort));
  const queryPrefix = qs.length ? qs.join('&') + '&' : '';
  res.render(template, {
    categories,
    products,
    allProducts,
    faq,
    search,
    sort,
    page,
    totalPages,
    total,
    basePath: categorySlug === 'parts' ? '/parts' : '/oils',
    queryPrefix,
  });
}

app.get('/parts', (req, res) => {
  renderCatalogPage(req, res, { categorySlug: 'parts', template: 'parts', faqSection: 'parts' });
});

app.get('/oils', (req, res) => {
  renderCatalogPage(req, res, { categorySlug: 'oils', template: 'oils', faqSection: 'oils' });
});

app.get('/cart', (req, res) => {
  const { items, subtotalCents, subtotal } = getCartWithProducts(req);
  const deliveryCents = subtotalCents >= 500000 ? 0 : 50000;
  const totalCents = subtotalCents + deliveryCents;
  const categories = getCategories();
  const user = req.session?.userId ? getUserById(req.session.userId) : null;
  res.render('cart', {
    items, subtotal, subtotalCents, delivery: formatPrice(deliveryCents), deliveryCents, total: formatPrice(totalCents), totalCents, categories,
    user,
    lastOrderId: clampInt(req.query.order, 0, 999999999),
    lastOrderAt: req.query.at ? String(req.query.at) : '',
    cartError: req.query.error === 'stock'
      ? 'Недостаточно товара на складе. Обновите корзину.'
      : req.query.error === 'phone_required'
        ? 'Введите номер телефона для подтверждения заказа.'
        : req.query.error === 'phone_invalid'
          ? 'Введите корректный номер телефона.'
          : null,
  });
});

app.get('/login', (req, res) => {
  if (req.session?.userId) {
    const u = getDb().prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
    const dest = (u && (u.role === 'admin' || u.role === 'manager')) ? '/admin' : '/account';
    return res.redirect(dest);
  }
  const categories = getCategories();
  res.render('login', { error: null, success: null, redirect: req.query.redirect || '', categories });
});

app.get('/about', (req, res) => {
  const categories = getCategories();
  res.render('about', { categories });
});

app.get('/register', (req, res) => {
  if (req.session?.userId) return res.redirect('/account');
  res.redirect('/login');
});

app.post('/login', (req, res) => {
  const email = clampStr(req.body.email, LIMITS.email.max).toLowerCase();
  const password = req.body.password || '';
  const redirect = clampStr(req.body.redirect || req.query.redirect || '', 256);
  if (!email || password.length < LIMITS.password.min) {
    return res.render('login', { error: 'Неверный email или пароль', success: null, categories: getCategories(), redirect });
  }
  const user = getUserByEmail(email);
  if (!user || !comparePassword(password, user.password_hash)) {
    return res.render('login', { error: 'Неверный email или пароль', success: null, categories: getCategories(), redirect });
  }
  req.session.userId = user.id;
  req.session.userName = user.name;
  redirectAfterAuth(req, res, user);
});

app.post('/register', (req, res) => {
  const email = clampStr(req.body.email, LIMITS.email.max).toLowerCase();
  const password = req.body.password || '';
  const name = clampStr(req.body.name, LIMITS.name.max);
  const surname = clampStr(req.body.surname, LIMITS.surname.max);
  const categories = getCategories();
  const redirect = clampStr(req.body.redirect || req.query.redirect || '', 256);
  if (!email || email.length < LIMITS.email.min) {
    return res.render('login', { error: 'Введите корректный email', success: null, categories, redirect });
  }
  if (password.length < LIMITS.password.min) {
    return res.render('login', { error: 'Пароль должен быть не менее 6 символов', success: null, categories, redirect });
  }
  if (!name) {
    return res.render('login', { error: 'Введите имя', success: null, categories, redirect });
  }
  if (getUserByEmail(email)) {
    return res.render('login', { error: 'Email уже зарегистрирован', success: null, categories, redirect });
  }
  createUser({ email, passwordHash: hashPassword(password), name, surname, role: 'customer' });
  return res.render('login', {
    error: null,
    success: 'Регистрация успешна. Теперь войдите в аккаунт.',
    categories,
    redirect: ''
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/account', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  const orders = getOrdersByUserId(req.session.userId);
  const categories = getCategories();
  const orderId = clampInt(req.query.order, 0, 999999999);
  const selectedOrder = orderId ? getOrderWithItems(orderId, req.session.userId) : null;
  if (selectedOrder) {
    selectedOrder.subtotal = formatPrice(selectedOrder.subtotalCents);
    selectedOrder.delivery = formatPrice(selectedOrder.deliveryCents);
    selectedOrder.total = formatPrice(selectedOrder.totalCents);
  }
  res.render('account', { user, orders, categories, success: req.query.success, error: req.query.error, selectedOrder });
});

app.post('/account', requireAuth, (req, res) => {
  const name = clampStr(req.body.name, LIMITS.name.max);
  const surname = clampStr(req.body.surname, LIMITS.surname.max);
  const phone = normalizePhone(clampStr(req.body.phone, LIMITS.phone.max));
  const car = clampStr(req.body.car, LIMITS.car.max);
  if (!name) return res.redirect('/account?error=name');
  if (phone && !isValidPhone(phone)) return res.redirect('/account?error=Введите%20корректный%20номер%20телефона');
  const existingUser = getUserById(req.session.userId);
  updateUser(req.session.userId, {
    name,
    surname,
    phone,
    car,
    deliveryAddress: existingUser?.deliveryAddress || ''
  });
  res.redirect('/account?success=1');
});

app.post('/cart/add', (req, res) => {
  const productId = parseInt(req.body.productId, 10);
  const quantity = clampInt(req.body.quantity || 1, 1, LIMITS.quantity.max);
  if (!productId || isNaN(productId)) return res.status(400).json({ error: 'Неверный товар' });
  const p = getProductById(productId);
  if (!p || p.stock < 1) return res.status(400).json({ error: 'Товар недоступен' });
  const cart = req.session.cart || [];
  const idx = cart.findIndex(i => i.productId === productId);
  const qty = idx >= 0 ? Math.min(cart[idx].quantity + quantity, p.stock, LIMITS.quantity.max) : Math.min(quantity, p.stock);
  if (idx >= 0) cart[idx].quantity = qty;
  else cart.push({ productId, quantity: qty });
  req.session.cart = cart;
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.json({ ok: true, cartCount: cart.reduce((s, i) => s + i.quantity, 0) });
  }
  res.redirect(req.headers.referer || '/cart');
});

app.post('/cart/update', (req, res) => {
  const productId = parseInt(req.body.productId, 10);
  const quantity = clampInt(req.body.quantity || 0, 0, LIMITS.quantity.max);
  if (!productId || isNaN(productId)) return res.redirect('/cart');
  const cart = req.session.cart || [];
  const idx = cart.findIndex(i => i.productId === productId);
  if (idx >= 0) {
    if (quantity <= 0) cart.splice(idx, 1);
    else cart[idx].quantity = quantity;
  }
  req.session.cart = cart;
  res.redirect('/cart');
});

app.post('/cart/remove', (req, res) => {
  const productId = parseInt(req.body.productId, 10);
  if (!productId || isNaN(productId)) return res.redirect('/cart');
  req.session.cart = (req.session.cart || []).filter(i => i.productId !== productId);
  res.redirect('/cart');
});

app.post('/cart/checkout', requireAuth, (req, res) => {
  const { items, subtotalCents } = getCartWithProducts(req);
  if (items.length === 0) return res.redirect('/cart');
  const user = getUserById(req.session.userId);
  const recipientName = clampStr(req.body.recipient_name || user?.name || '', LIMITS.name.max);
  const phone = normalizePhone(clampStr(req.body.phone || user?.phone || '', LIMITS.phone.max));
  if (!phone) return res.redirect('/cart?error=phone_required');
  if (!isValidPhone(phone)) return res.redirect('/cart?error=phone_invalid');
  if (recipientName || phone) {
    updateUser(req.session.userId, {
      name: recipientName || user?.name || '',
      surname: user?.surname || '',
      phone: phone || user?.phone || '',
      car: user?.car || '',
      deliveryAddress: user?.deliveryAddress || ''
    });
  }
  const deliveryCents = subtotalCents >= 500000 ? 0 : 50000;
  const totalCents = subtotalCents + deliveryCents;
  let orderId;
  try {
    orderId = fulfillOrder({
      userId: req.session.userId,
      status: 'new',
      subtotalCents,
      deliveryCents,
      totalCents,
      deliveryAddress: user.deliveryAddress || '',
    }, items.map((it) => ({ productId: it.productId, quantity: it.quantity, priceCents: it.priceCents })));
  } catch (err) {
    if (err.code === 'STOCK') return res.redirect('/cart?error=stock');
    throw err;
  }
  req.session.cart = [];
  res.redirect('/cart?order=' + orderId + '&at=' + encodeURIComponent(new Date().toLocaleString('ru-RU')));
});

app.get('/api/categories', (req, res) => {
  res.json(getCategories());
});

app.get('/api/products', (req, res) => {
  const categorySlug = clampStr(req.query.category, 64);
  const search = clampStr(req.query.search, LIMITS.search.max);
  const sort = ['name', 'price_asc', 'price_desc'].includes(req.query.sort) ? req.query.sort : 'name';
  const products = getProducts({ categorySlug: categorySlug || undefined, search: search || undefined, sort });
  res.json(products);
});

app.get('/api/faq/:section', (req, res) => {
  const section = ['parts', 'oils'].includes(req.params.section) ? req.params.section : 'parts';
  res.json(getFaq(section));
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  const { password_hash, ...safe } = user;
  res.json(safe);
});

app.put('/api/me', requireAuth, (req, res) => {
  const name = clampStr(req.body.name, LIMITS.name.max);
  const surname = clampStr(req.body.surname, LIMITS.surname.max);
  const phone = normalizePhone(clampStr(req.body.phone, LIMITS.phone.max));
  const car = clampStr(req.body.car, LIMITS.car.max);
  const deliveryAddress = clampStr(req.body.delivery_address, LIMITS.deliveryAddress.max);
  if (!name) return res.status(400).json({ error: 'Имя обязательно' });
  if (phone && !isValidPhone(phone)) return res.status(400).json({ error: 'Введите корректный номер телефона' });
  updateUser(req.session.userId, { name, surname, phone, car, deliveryAddress });
  res.json({ ok: true });
});

app.get('/api/orders', requireAuth, (req, res) => {
  res.json(getOrdersByUserId(req.session.userId));
});

app.get('/admin', requireAuth, requireStaff, (req, res) => {
  const users = getAdminUsers();
  const products = getAdminProducts();
  const orders = getAdminOrders();
  const categories = getCategories();
  let flash = null;
  if (req.query.success === 'password') flash = 'Пароль пользователя обновлён';
  if (req.query.success === 'product') flash = 'Товар добавлен';
  if (req.query.success === 'order_deleted') flash = 'Заказ удалён';
  res.render('admin', { users, products, orders, categories, flash, adminError: req.query.error || null });
});

app.post('/admin/users', requireAuth, requireRole('admin'), (req, res) => {
  const email = clampStr(req.body.email, LIMITS.email.max).toLowerCase();
  const password = req.body.password || '';
  const name = clampStr(req.body.name, LIMITS.name.max);
  const surname = clampStr(req.body.surname, LIMITS.surname.max);
  const role = ['admin', 'manager', 'customer'].includes(req.body.role) ? req.body.role : 'customer';
  if (!email || !name || password.length < LIMITS.password.min) {
    return res.redirect('/admin?error=user');
  }
  if (getUserByEmail(email)) return res.redirect('/admin?error=email');
  createUser({ email, passwordHash: hashPassword(password), name, surname, role });
  res.redirect('/admin');
});

app.post('/admin/users/:id/role', requireAuth, requireRole('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const role = ['admin', 'manager', 'customer'].includes(req.body.role) ? req.body.role : 'customer';
  if (id && getUserById(id)) updateUserRole(id, role);
  res.redirect('/admin');
});

app.post('/admin/users/:id/delete', requireAuth, requireRole('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id && id !== req.session.userId) deleteUser(id);
  res.redirect('/admin');
});

app.post('/admin/users/:id/password', requireAuth, requireRole('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const password = req.body.password || '';
  if (!id || !getUserById(id)) return res.redirect('/admin?error=user');
  if (password.length < LIMITS.password.min) return res.redirect('/admin?error=password');
  updateUserPassword(id, hashPassword(password));
  res.redirect('/admin?success=password');
});

app.post('/admin/products', requireAuth, requireStaff, upload.single('image'), (req, res) => {
  const categoryId = parseInt(req.body.category_id, 10);
  const name = clampStr(req.body.name, LIMITS.productName.max);
  const description = clampStr(req.body.description || '', LIMITS.productDescription.max);
  const articleNumber = clampStr(req.body.article_number || '', LIMITS.articleNumber.max);
  let priceCents = parseInt(req.body.price, 10);
  if (isNaN(priceCents) || priceCents < 0) priceCents = 0;
  else priceCents = Math.round(priceCents * 100);
  const stock = parseInt(req.body.stock, 10) || 0;
  const isNew = !!req.body.is_new;
  let imageUrl = clampStr(req.body.image_url || '', LIMITS.imageUrl.max);
  if (req.file) imageUrl = '/uploads/' + req.file.filename;
  if (!categoryId || !name || priceCents < 0) return res.redirect('/admin?error=product');
  insertProduct({ categoryId, name, description, articleNumber, priceCents, stock, imageUrl, isNew });
  res.redirect('/admin?success=product#products');
});

app.post('/admin/orders/:id/status', requireAuth, requireStaff, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const status = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(req.body.status) ? req.body.status : 'new';
  if (id && getOrderWithItems(id)) updateOrderStatus(id, status);
  res.redirect('/admin#orders');
});

app.post('/admin/delete-order/:id', requireAuth, requireStaff, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id) {
    try {
      deleteOrder(id);
    } catch (e) {
      console.error('deleteOrder', e);
    }
  }
  res.redirect('/admin?success=order_deleted');
});

app.post('/admin/products/:id', requireAuth, requireStaff, upload.single('image'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const categoryId = parseInt(req.body.category_id, 10);
  const name = clampStr(req.body.name, LIMITS.productName.max);
  const description = clampStr(req.body.description || '', LIMITS.productDescription.max);
  const articleNumber = clampStr(req.body.article_number || '', LIMITS.articleNumber.max);
  let priceCents = parseInt(req.body.price, 10);
  if (isNaN(priceCents) || priceCents < 0) priceCents = 0;
  else priceCents = Math.round(priceCents * 100);
  const stock = parseInt(req.body.stock, 10) || 0;
  const isNew = !!req.body.is_new;
  let imageUrl = clampStr(req.body.image_url || '', LIMITS.imageUrl.max);
  if (req.file) imageUrl = '/uploads/' + req.file.filename;
  if (!id || !categoryId || !name || priceCents < 0) return res.redirect('/admin');
  const product = getProductById(id);
  if (product) {
    const data = { categoryId, name, description, articleNumber, priceCents, stock, imageUrl: imageUrl || product.imageUrl || '', isNew };
    updateProduct(id, data);
  }
  res.redirect('/admin');
});

app.get('/admin/products/edit/:id', requireAuth, requireStaff, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const product = id ? getProductById(id) : null;
  const categories = getCategories();
  res.render('admin-product-edit', { product, categories });
});

app.post('/admin/products/:id/delete', requireAuth, requireStaff, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id) deleteProduct(id);
  res.redirect('/admin');
});

app.use((req, res) => res.status(404).render('404', { message: 'Страница не найдена' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`МоторХаб: сервер запущен на http://localhost:${PORT}`);
});
