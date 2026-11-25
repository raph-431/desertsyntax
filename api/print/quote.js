// GET /api/print/quote?seed=0x…  or  ?token=12   &variant=cream&country=US
// → the seed and, per shipping level, what the buyer pays. Any edition can be printed, minted or not.
import { VARIANTS, COUNTRIES, LEVELS, PRICING } from '../../lib/config.js';
import { resolveSeed } from '../../lib/chain.js';
import { quote } from '../../lib/lulu.js';
import { priceFor } from '../../lib/price.js';

const json = (o, s = 200) => Response.json(o, { status: s, headers: { 'cache-control': 'no-store' } });

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const variant = q.get('variant') || 'cream', country = (q.get('country') || 'US').toUpperCase();
  const v = VARIANTS[variant]; if (!v) return json({ error: 'unknown paper' }, 400);
  if (!COUNTRIES[country]) return json({ error: 'country not offered' }, 400);
  try {
    const { seed, tokenId } = await resolveSeed({ seed: q.get('seed'), token: q.get('token') });
    const levels = {};
    for (const level of Object.keys(LEVELS)) {
      const lq = await quote({ sku: v.sku, pages: PRICING.quotePages, country, level });
      if (lq) levels[level] = { label: LEVELS[level], ...priceFor(lq) };
    }
    if (!Object.keys(levels).length) return json({ error: 'Lulu does not ship this book there' }, 422);
    return json({ seed, tokenId, variant, country, currency: 'usd', levels,
      variants: Object.fromEntries(Object.entries(VARIANTS).map(([k, x]) => [k, x.label])),
      countries: Object.fromEntries(Object.entries(COUNTRIES).map(([k, x]) => [k, x.name])) });
  } catch (e) {
    if (e.status === 400 || e.status === 404) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'could not price the book right now' + (/localhost/.test(process.env.SITE_URL || '') ? ` (${e.message})` : '') }, 502);
  }
}
