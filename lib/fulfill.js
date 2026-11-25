// After payment: render the edition, store the PDFs, create the Lulu job, record each step on the order.
import { VARIANTS } from './config.js';
import { coverSize, createJob } from './lulu.js';
import { render } from './render.js';
import { saveOrder, putPDF, putJSON } from './orders.js';

export const RENDERER_VERSION = 'v1'; // bump when the print layout changes, so old and new files never mix

export async function fulfill(session) {
  const id = session.id, m = session.metadata || {};
  const v = VARIANTS[m.variant]; if (!v) throw new Error('unknown variant ' + m.variant);
  const ship = session.collected_information?.shipping_details || session.shipping_details;
  const cust = session.customer_details || {};
  if (!ship?.address) throw new Error('no shipping address on the session');
  try {
    // the seed was fixed at checkout (read from chain then, for a minted edition)
    const seed = m.seed; if (!/^0x[0-9a-f]{64}$/.test(seed || '')) throw new Error('no seed on the session');
    await saveOrder(id, { status: 'rendering', tokenId: m.tokenId, variant: m.variant, level: m.level, seed });

    const out = await render({ seed, mode: v.mode, coverPt: pages => coverSize({ sku: v.sku, pages }) });
    const base = `prints/${seed}/${m.variant}-${RENDERER_VERSION}`;
    const interiorUrl = await putPDF(`${base}/interior.pdf`, out.interior);
    const coverUrl = await putPDF(`${base}/cover.pdf`, out.cover);
    await saveOrder(id, { status: 'rendered', pages: out.pages, interiorUrl, coverUrl });

    const a = ship.address;
    const job = await createJob({
      externalId: `ds-${out.editionId}-${id.slice(-10)}`,
      title: m.tokenId ? `Desert Syntax — edition #${m.tokenId} (${out.editionId})` : `Desert Syntax — edition ${out.editionId}`,
      sku: v.sku, interiorUrl, coverUrl, level: m.level, email: cust.email,
      address: { name: ship.name || cust.name, street1: a.line1, street2: a.line2 || '', city: a.city, state_code: a.state || '',
                 postcode: a.postal_code, country_code: a.country, phone_number: cust.phone || '', email: cust.email },
    });
    await putJSON(`lulu/${job.id}.json`, { session: id });
    return saveOrder(id, { status: 'placed', luluJobId: job.id, luluStatus: job.status?.name || 'CREATED' });
  } catch (e) {
    await saveOrder(id, { status: 'failed', error: String(e.message || e).slice(0, 500) });
    throw e;
  }
}
