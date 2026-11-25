// POST /api/lulu-webhook  (registered once with: node scripts/lulu-webhook.mjs — topic PRINT_JOB_STATUS_CHANGED)
// Keeps each order's Lulu status and tracking links up to date.
import { luluSignatureOk } from '../lib/lulu.js';
import { getJSON, saveOrder } from '../lib/orders.js';

export async function POST(request) {
  const raw = await request.text();
  if (!luluSignatureOk(raw, request.headers.get('lulu-hmac-sha256'))) return new Response('bad signature', { status: 401 });
  const msg = JSON.parse(raw), job = msg.data || {};
  const ext = job.external_id || job.line_items?.[0]?.external_id || '';
  // external ids look like ds-<token>-<last 10 chars of the Stripe session id>; the full id is kept in lulu/<job>.json
  const link = await getJSON(`lulu/${job.id}.json`);
  const status = job.status?.name, tracking = (job.line_items || []).flatMap(l => l.tracking_urls || []);
  if (link?.session) await saveOrder(link.session, { luluStatus: status, tracking, ...(status === 'SHIPPED' ? { status: 'shipped' } : {}) });
  else console.warn('lulu webhook for unknown job', job.id, ext);
  return new Response('ok');
}

