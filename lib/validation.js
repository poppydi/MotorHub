
const LIMITS = {
  email: { min: 5, max: 128 },
  password: { min: 6, max: 72 },
  name: { max: 100 },
  surname: { max: 100 },
  phone: { max: 32 },
  phoneDigits: { min: 10, max: 15 },
  car: { max: 200 },
  deliveryAddress: { max: 500 },
  search: { max: 200 },
  quantity: { min: 1, max: 99 },
  productName: { max: 255 },
  productDescription: { max: 2000 },
  articleNumber: { max: 64 },
  imageUrl: { max: 512 },
  faqQuestion: { max: 500 },
  faqAnswer: { max: 2000 },
  orderStatus: { max: 32 },
  role: { max: 32 },
};

function normalizePhone(phone) {
  const raw = String(phone || '');
  return raw.replace(/[^\d+]/g, '');
}

function isValidPhone(phone) {
  const normalized = normalizePhone(phone);
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= LIMITS.phoneDigits.min && digits.length <= LIMITS.phoneDigits.max;
}

function clampStr(str, max) {
  if (str == null || typeof str !== 'string') return '';
  const s = String(str).trim();
  return s.length > max ? s.slice(0, max) : s;
}

function clampInt(val, min, max) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

module.exports = { LIMITS, clampStr, clampInt, normalizePhone, isValidPhone };
