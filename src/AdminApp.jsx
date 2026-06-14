import { useEffect, useState } from 'react';
import { api, formatPrice } from './api';
import { useTelegram } from './hooks/useTelegram';
import { LoadingScreen } from './components/LoadingScreen';
import './styles.css';
import './admin.css';

const STATUS_COLORS = {
  new: '#3B82F6',
  confirmed: '#8B5CF6',
  preparing: '#F59E0B',
  delivering: '#10B981',
  completed: '#6B7280',
  cancelled: '#EF4444',
};

const ORDER_STATUS_ORDER = [
  'new',
  'confirmed',
  'preparing',
  'delivering',
  'completed',
  'cancelled',
];

function OrdersTab({ orders, statuses, onStatusChange, orderSort, onSortChange }) {
  if (orders.length === 0) {
    return <p className="empty-state">Замовлень поки немає</p>;
  }

  const sortedOrders = [...orders].sort((a, b) => {
    if (orderSort === 'status') {
      const statusIndexA = ORDER_STATUS_ORDER.indexOf(a.status);
      const statusIndexB = ORDER_STATUS_ORDER.indexOf(b.status);
      if (statusIndexA !== statusIndexB) {
        return statusIndexA - statusIndexB;
      }
      return new Date(b.created_at) - new Date(a.created_at);
    }

    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <>
      <div className="order-sorting">
        <label>
          Сортувати:
          <select value={orderSort} onChange={(e) => onSortChange(e.target.value)}>
            <option value="created_at">За датою</option>
            <option value="status">За статусом</option>
          </select>
        </label>
      </div>
      <div className="orders-list">
        {sortedOrders.map((order) => (
          <article key={order.id} className="order-card">
            <div className="order-card-header">
              <div>
                <h3>№{order.id}</h3>
                <p className="order-customer">
                  {order.last_name} {order.first_name}
                </p>
                <p className="order-meta">{order.phone}</p>
                <p className="order-meta">{order.address}</p>
                <p className="order-date">
                  {new Date(order.created_at).toLocaleString('uk-UA')}
                </p>
              </div>
              <div className="order-total-badge">{formatPrice(order.total)}</div>
            </div>

            <ul className="order-items-list">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.product_name} — {item.grams} г ({formatPrice(item.subtotal)})
                </li>
              ))}
            </ul>

            <label className="status-select">
              <span>Статус</span>
              <select
                value={order.status}
                onChange={(e) => onStatusChange(order.id, e.target.value)}
                style={{ borderColor: STATUS_COLORS[order.status] }}
              >
                {Object.entries(statuses).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </article>
        ))}
      </div>
    </>
  );
}

function ProductsTab({ products, onAdd, onUpdate, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    category: '',
    price_per_100g: '',
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    await onAdd({
      name: newProduct.name,
      description: newProduct.description,
      category: newProduct.category,
      price_per_100g: parseFloat(newProduct.price_per_100g),
    });
    setNewProduct({ name: '', description: '', category: '', price_per_100g: '' });
    setShowForm(false);
  };

  return (
    <div className="products-admin">
      <button type="button" className="btn-primary" onClick={() => setShowForm(!showForm)}>
        {showForm ? 'Скасувати' : '+ Додати позицію'}
      </button>

      {showForm && (
        <form className="product-form" onSubmit={handleAdd}>
          <input
            placeholder="Назва"
            value={newProduct.name}
            onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <input
            placeholder="Опис"
            value={newProduct.description}
            onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
          />
          <input
            placeholder="Категорія"
            value={newProduct.category}
            onChange={(e) => setNewProduct((p) => ({ ...p, category: e.target.value }))}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Ціна за 100 г"
            value={newProduct.price_per_100g}
            onChange={(e) => setNewProduct((p) => ({ ...p, price_per_100g: e.target.value }))}
            required
          />
          <button type="submit" className="btn-secondary">Зберегти</button>
        </form>
      )}

      <div className="admin-product-list">
        {products.map((product) => (
          <article
            key={product.id}
            className={`admin-product-card ${product.is_stop_listed ? 'stopped' : ''} ${!product.is_active ? 'inactive' : ''}`}
          >
            <div className="admin-product-main">
              <h3>{product.name}</h3>
              {product.description && <p>{product.description}</p>}
              {product.category && <p className="product-category">{product.category}</p>}
              <div className="price-edit">
                <label>
                  Категорія:
                  <input
                    type="text"
                    defaultValue={product.category || ''}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value !== product.category) {
                        onUpdate(product.id, { category: value });
                      }
                    }}
                  />
                </label>
                <label>
                  Ціна/100г:
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={product.price_per_100g}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (val !== product.price_per_100g && val > 0) {
                        onUpdate(product.id, { price_per_100g: val });
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="admin-product-actions">
              <button
                type="button"
                className={`toggle-btn ${product.is_stop_listed ? 'active' : ''}`}
                onClick={() => onUpdate(product.id, { is_stop_listed: !product.is_stop_listed })}
              >
                {product.is_stop_listed ? '✓ Стоп-лист' : 'Стоп-лист'}
              </button>
              <button
                type="button"
                className="toggle-btn"
                onClick={() => onUpdate(product.id, { is_active: !product.is_active })}
              >
                {product.is_active ? 'Активна' : 'Неактивна'}
              </button>
              <button
                type="button"
                className="delete-btn"
                onClick={() => {
                  if (confirm(`Видалити «${product.name}»?`)) onDelete(product.id);
                }}
              >
                Видалити
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function AdminApp() {
  const { ready } = useTelegram();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [orderSort, setOrderSort] = useState('created_at');

  const loadData = async () => {
    try {
      const [ordersData, productsData, statusesData] = await Promise.all([
        api.admin.getOrders(),
        api.admin.getProducts(),
        api.admin.getStatuses(),
      ]);
      setOrders(ordersData);
      setProducts(productsData);
      setStatuses(statusesData);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready) loadData();
  }, [ready]);

  const handleStatusChange = async (id, status) => {
    try {
      const updated = await api.admin.updateOrderStatus(id, status);
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddProduct = async (data) => {
    const created = await api.admin.createProduct(data);
    setProducts((prev) => [...prev, created]);
  };

  const handleUpdateProduct = async (id, data) => {
    const updated = await api.admin.updateProduct(id, data);
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
  };

  const handleDeleteProduct = async (id) => {
    await api.admin.deleteProduct(id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  if (!ready || loading) return <LoadingScreen />;

  return (
    <div className="app admin-app">
      <header className="header admin-header">
        <img src="/logo.svg" alt="" className="header-logo small" />
        <h1>Адмін-панель</h1>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <nav className="admin-tabs">
        <button
          type="button"
          className={tab === 'orders' ? 'active' : ''}
          onClick={() => setTab('orders')}
        >
          Замовлення ({orders.length})
        </button>
        <button
          type="button"
          className={tab === 'products' ? 'active' : ''}
          onClick={() => setTab('products')}
        >
          Меню ({products.length})
        </button>
      </nav>

      <main className="admin-main">
        {tab === 'orders' && (
          <OrdersTab
            orders={orders}
            statuses={statuses}
            onStatusChange={handleStatusChange}
            orderSort={orderSort}
            onSortChange={setOrderSort}
          />
        )}
        {tab === 'products' && (
          <ProductsTab
            products={products}
            onAdd={handleAddProduct}
            onUpdate={handleUpdateProduct}
            onDelete={handleDeleteProduct}
          />
        )}
      </main>
    </div>
  );
}
