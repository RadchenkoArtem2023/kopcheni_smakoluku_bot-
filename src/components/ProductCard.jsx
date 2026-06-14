import { calcSubtotal, formatPrice } from '../api';

const STEP = 50;
const MIN_GRAMS = 50;

export function ProductCard({ product, grams, onGramsChange }) {
  const subtotal = grams > 0 ? calcSubtotal(product.price_per_100g, grams) : 0;

  const adjust = (delta) => {
    const next = Math.max(0, grams + delta);
    onGramsChange(next === 0 ? 0 : Math.max(MIN_GRAMS, next));
  };

  const handleInput = (e) => {
    const value = parseInt(e.target.value, 10);
    if (Number.isNaN(value) || value <= 0) {
      onGramsChange(0);
    } else {
      onGramsChange(Math.max(MIN_GRAMS, value));
    }
  };

  const pricePerKg = product.price_per_100g * 10;

  return (
    <article className="product-card">
      <div className="product-info">
        <h3>{product.name}</h3>
        {product.description && <p className="product-desc">{product.description}</p>}
        <p className="product-price">{formatPrice(pricePerKg)} / кг</p>
      </div>

      <div className="quantity-control">
        <button type="button" className="qty-btn" onClick={() => adjust(-STEP)} disabled={grams <= MIN_GRAMS}>
          −
        </button>
        <input
          type="number"
          className="qty-input"
          value={grams || ''}
          placeholder="0"
          min={MIN_GRAMS}
          step={STEP}
          onChange={handleInput}
        />
        <span className="qty-unit">г</span>
        <button type="button" className="qty-btn" onClick={() => adjust(grams === 0 ? MIN_GRAMS : STEP)}>
          +
        </button>
      </div>

      {grams > 0 && <p className="product-subtotal">= {formatPrice(subtotal)}</p>}
    </article>
  );
}
