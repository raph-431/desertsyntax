// Lulu Print API: token, quotes, cover size, print jobs. Keys only ever live on the server (LULU_KEY, LULU_SECRET).
import crypto from 'node:crypto';
import { LULU_HOST, COUNTRIES, PRODUCTION_DELAY_MIN } from './config.js';

let cached = null;
async function token() {
  if (cached && cached.exp > Date.now() + 60e3) return cached.tok;
  const { LULU_KEY, LULU_SECRET } = process.env;
  if (!LULU_KEY || !LULU_SECRET) throw new Error('LULU_KEY / LULU_SECRET are not set');
  const r = await fetch(`https://${LULU_HOST}/auth/realms/glasstree/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(`${LULU_KEY}:${LULU_SECRET}`).toString('base64') },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) throw new Error(`Lulu auth ${r.status}`);
  const j = await r.json();
  cached = { tok: j.access_token, exp: Date.now() + (j.expires_in || 300) * 1000 };
  return cached.tok;
}

export async function lulu(method, path, body) {
  const r = await fetch(`https://${LULU_HOST}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: body && JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(`Lulu ${method} ${path} → ${r.status} ${JSON.stringify(j).slice(0, 300)}`); e.status = r.status; e.body = j; throw e; }
  return j;
}

// Price of one book to a country's sample address. Returns null when Lulu has no such shipping level there.
export async function quote({ sku, pages, country, level }) {
  const c = COUNTRIES[country]; if (!c) throw new Error('country not offered');
  try {
    const j = await lulu('POST', '/print-job-cost-calculations/', {
      line_items: [{ page_count: pages, pod_package_id: sku, quantity: 1 }],
      shipping_address: { ...c.addr, country_code: country, phone_number: '+1 212 555 0100' },
      shipping_option: level,
    });
    return { total: +j.total_cost_incl_tax, shipping: +j.shipping_cost.total_cost_excl_tax, currency: j.currency };
  } catch (e) { if (e.status === 400) return null; throw e; }
}

export async function coverSize({ sku, pages }) {
  const j = await lulu('POST', '/cover-dimensions/', { pod_package_id: sku, interior_page_count: pages, unit: 'pt' });
  return { w: +j.width, h: +j.height };
}

export async function createJob({ externalId, title, sku, interiorUrl, coverUrl, address, email, level }) {
  return lulu('POST', '/print-jobs/', {
    contact_email: process.env.PRINT_CONTACT_EMAIL || email,
    external_id: externalId,
    production_delay: PRODUCTION_DELAY_MIN,
    shipping_level: level,
    shipping_address: address,
    line_items: [{ external_id: externalId, title, quantity: 1,
      printable_normalization: { pod_package_id: sku, interior: { source_url: interiorUrl }, cover: { source_url: coverUrl } } }],
  });
}

// Lulu signs webhook bodies with HMAC-SHA256 using the API secret (header Lulu-HMAC-SHA256).
export function luluSignatureOk(raw, header) {
  if (!header || !process.env.LULU_SECRET) return false;
  const mac = crypto.createHmac('sha256', process.env.LULU_SECRET).update(raw);
  const hex = mac.copy().digest('hex'), b64 = mac.digest('base64');
  const h = header.trim();
  const eq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  return eq(h, hex) || eq(h, b64);
}
