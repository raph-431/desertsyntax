// GET /api/print/status?s=<stripe session id>  → where the order is (no address or personal data returned)
import { getOrder } from '../../lib/orders.js';

const LABEL = { paid: 'Payment received', rendering: 'Setting your edition for print', rendered: 'Print files ready',
  placed: 'Sent to the printer', shipped: 'Shipped', failed: 'Held: we are looking into it' };

export async function GET(request) {
  const s = new URL(request.url).searchParams.get('s') || '';
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(s)) return Response.json({ error: 'bad id' }, { status: 400 });
  const o = await getOrder(s);
  if (!o) return Response.json({ status: 'pending', label: 'Waiting for payment confirmation' }, { headers: { 'cache-control': 'no-store' } });
  return Response.json({ status: o.status, label: LABEL[o.status] || o.status, tokenId: o.tokenId || null, variant: o.variant,
    luluStatus: o.luluStatus || null, tracking: o.tracking || [] }, { headers: { 'cache-control': 'no-store' } });
}
