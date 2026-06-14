import { useEffect, useMemo, useState } from 'react';
import { api, calcSubtotal, formatPrice } from './api';
import { useTelegram } from './hooks/useTelegram';
import { LoadingScreen } from './components/LoadingScreen';
import { ProductCard } from './components/ProductCard';
import { CheckoutForm } from './components/CheckoutForm';
import './styles.css';

export default function App() {
  const { tg, user, ready, isTelegram } = useTelegram();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('menu');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [orderResult, setOrderResult] = useState(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    if (!ready) return;

    if (user) {
      setForm((prev) => ({
        ...prev,
        first_name: prev.first_name || user.first_name || '',
        last_name: prev.last_name || user.last_name || '',
      }));
    }

    api
      .getMenu()
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error('Невірний формат меню від API');
        }
        setProducts(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [ready, user]);

  const normalizedProducts = Array.isArray(products) ? products : [];

  const groupedProducts = normalizedProducts.reduce((groups, product) => {
    const category = product.category || 'Інші';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(product);
    return groups;
  }, {});

  const groupedEntries = Object.entries(groupedProducts);

  const cartItems = useMemo(() => {
    return normalizedProducts
      .filter((p) => cart[p.id] > 0)
      .map((p) => ({
        product_id: p.id,
        name: p.name,
        grams: cart[p.id],
        price_per_100g: p.price_per_100g,
        subtotal: calcSubtotal(p.price_per_100g, cart[p.id]),
      }));
  }, [normalizedProducts, cart]);

  const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

  const handleGramsChange = (productId, grams) => {
    setCart((prev) => {
      const next = { ...prev };
      if (grams <= 0) delete next[productId];
      else next[productId] = grams;
      return next;
    });
  };

  const handleFormChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) return;

    setSubmitting(true);
    setError('');

    try {
      const order = await api.createOrder({
        ...form,
        items: cartItems.map(({ product_id, grams }) => ({ product_id, grams })),
      });
      setOrderResult(order);
      setStep('success');
      tg?.HapticFeedback?.notificationOccurred('success');
    } catch (err) {
      setError(err.message);
      tg?.HapticFeedback?.notificationOccurred('error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready || loading) return <LoadingScreen />;

  if (!isTelegram && import.meta.env.DEV) {
    // Dev mode notice - still allow testing with mock init data header missing
  }

  if (step === 'success' && orderResult) {
    return (
      <div className="app">
        <header className="header">
          <img src="/logo.svg" alt="" className="header-logo" />
        </header>
        <main className="success-screen">
          <div className="success-icon">✓</div>
          <h1>Замовлення прийнято!</h1>
          <p className="success-subtitle">№{orderResult.id}</p>

          <div className="order-details">
            {orderResult.items.map((item, i) => (
              <div key={i} className="order-line">
                <span>{item.product_name}</span>
                <span>
                  {item.grams} г — {formatPrice(item.subtotal)}
                </span>
              </div>
            ))}
            <div className="order-total">
              <span>Разом</span>
              <strong>{formatPrice(orderResult.total)}</strong>
            </div>
          </div>

          <p className="success-note">
            Підтвердження надіслано вам у Telegram
          </p>
          <button type="button" className="btn-secondary" onClick={() => tg?.close()}>
            Закрити
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <img src="/logo.svg" alt="Копчені Смаколики" className="header-logo" />
        <p className="header-tagline">преміум якість</p>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {step === 'menu' && (
        <main className="menu-screen">
          <h2>Меню</h2>
          <p className="menu-hint">Вкажіть кількість у грамах (мін. 50 г)</p>

          {groupedEntries.map(([category, items]) => (
            <section key={category} className="product-group">
              <h3 className="group-title">{category}</h3>
              <div className="product-list">
                {items.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    grams={cart[product.id] || 0}
                    onGramsChange={(g) => handleGramsChange(product.id, g)}
                  />
                ))}
              </div>
            </section>
          ))}

          {products.length === 0 && (
            <p className="empty-state">Наразі немає доступних позицій</p>
          )}

          {cartItems.length > 0 && (
            <div className="cart-bar">
              <div>
                <span>{cartItems.length} поз.</span>
                <strong>{formatPrice(total)}</strong>
              </div>
              <button type="button" className="btn-primary" onClick={() => setStep('checkout')}>
                Оформити
              </button>
            </div>
          )}
        </main>
      )}

      {step === 'checkout' && (
        <main className="checkout-screen">
          <button type="button" className="back-btn" onClick={() => setStep('menu')}>
            ← Назад до меню
          </button>

          <div className="checkout-items">
            {cartItems.map((item) => (
              <div key={item.product_id} className="checkout-item">
                <span>{item.name} — {item.grams} г</span>
                <span>{formatPrice(item.subtotal)}</span>
              </div>
            ))}
          </div>

          <CheckoutForm
            form={form}
            onChange={handleFormChange}
            onSubmit={handleSubmit}
            loading={submitting}
            total={total}
            itemCount={cartItems.length}
          />
        </main>
      )}
    </div>
  );
}
