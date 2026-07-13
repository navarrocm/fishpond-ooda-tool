// ============================================================
// UTILITIES - Shared Functions
// ============================================================

// ---- HTML Escape (Prevents XSS) ----
export function escapeHtml(str) {
  if (!str) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(str).replace(/[&<>"']/g, function(m) { return map[m]; });
}

// ---- Validate Number (Returns null if invalid) ----
export function validateNumber(val, fallback = null) {
  const num = parseFloat(val);
  return isNaN(num) ? fallback : num;
}

// ---- Validate Integer (Returns null if invalid) ----
export function validateInt(val, fallback = null) {
  const num = parseInt(val);
  return isNaN(num) ? fallback : num;
}

// ---- Safe Date (Returns ISO string or null) ----
export function safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

// ---- Format Currency ----
export function formatCurrency(amount, currency = '₱') {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  return currency + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ---- Format Number ----
export function formatNumber(num, decimals = 1) {
  if (num === null || num === undefined || isNaN(num)) return '—';
  return Number(num).toFixed(decimals);
}

// ---- Generate ID ----
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

// ---- Debounce ----
export function debounce(fn, delay = 300) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ---- Deep Clone ----
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}