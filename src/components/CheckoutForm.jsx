import { formatPrice } from '../api';

export function CheckoutForm({ form, onChange, onSubmit, loading, total, itemCount }) {
  const fields = [
    { key: 'last_name', label: 'Прізвище', placeholder: 'Іваненко' },
    { key: 'first_name', label: "Ім'я", placeholder: 'Петро' },
    { key: 'phone', label: 'Телефон', placeholder: '+380 XX XXX XX XX', type: 'tel' },
    { key: 'address', label: 'Адреса доставки', placeholder: 'м. Київ, вул. ...' },
  ];

  return (
    <form className="checkout-form" onSubmit={onSubmit}>
      <h2>Оформлення замовлення</h2>
      <p className="checkout-summary">
        {itemCount} {itemCount === 1 ? 'позиція' : 'позиції'} · <strong>{formatPrice(total)}</strong>
      </p>

      {fields.map(({ key, label, placeholder, type = 'text' }) => (
        <label key={key} className="form-field">
          <span>{label}</span>
          <input
            type={type}
            value={form[key]}
            onChange={(e) => onChange(key, e.target.value)}
            placeholder={placeholder}
            required
          />
        </label>
      ))}

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Надсилання...' : 'Підтвердити замовлення'}
      </button>
    </form>
  );
}
