const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getInitData() {
  return window.Telegram?.WebApp?.initData || '';
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': getInitData(),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Помилка запиту');
  }
  return data;
}

export const api = {
  getMenu: () => request('/menu'),
  createOrder: (body) => request('/orders', { method: 'POST', body: JSON.stringify(body) }),

  admin: {
    getProducts: () => request('/admin/products'),
    createProduct: (body) =>
      request('/admin/products', { method: 'POST', body: JSON.stringify(body) }),
    updateProduct: (id, body) =>
      request(`/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteProduct: (id) => request(`/admin/products/${id}`, { method: 'DELETE' }),
    getOrders: () => request('/admin/orders'),
    getStatuses: () => request('/admin/orders/statuses'),
    updateOrderStatus: (id, status) =>
      request(`/admin/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },
};

export function calcSubtotal(pricePer100g, grams) {
  return (pricePer100g * grams) / 100;
}

export function formatPrice(value) {
  return `${value.toFixed(2)} грн`;
}
