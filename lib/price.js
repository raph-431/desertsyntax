import { PRICING } from './config.js';

// Lulu's cost (incl. tax) → what the buyer pays, split into book and shipping lines, in cents.
export function priceFor(q) {
  const raw = q.total * (1 + PRICING.buffer) + PRICING.margin;
  const total = Math.ceil(((raw + PRICING.stripeFixed) / (1 - PRICING.stripePct)) * 2) / 2; // next $0.50
  const shipping = Math.round(q.shipping * 100);
  const totalCents = Math.round(total * 100);
  return { totalCents, shippingCents: shipping, bookCents: totalCents - shipping };
}
