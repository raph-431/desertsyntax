// GET /api/print/preview?seed=0x… | token=N  &variant=cream|color  &part=interior|cover  &key=<ADMIN_TOKEN>
// The exact PDF the print flow would send to Lulu, without paying. For checking print against the screen edition.
// Open on localhost without a key; on the deployed site the key is required.
import { VARIANTS, SITE } from '../../lib/config.js';
import { resolveSeed } from '../../lib/chain.js';
import { coverSize } from '../../lib/lulu.js';
import { render } from '../../lib/render.js';

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const local = /localhost|127\.0\.0\.1/.test(SITE);
  if (!local && (!process.env.ADMIN_TOKEN || q.get('key') !== process.env.ADMIN_TOKEN)) return new Response('no', { status: 401 });
  const v = VARIANTS[q.get('variant') || 'cream']; if (!v) return new Response('unknown variant', { status: 400 });
  const part = q.get('part') === 'cover' ? 'cover' : 'interior';
  try {
    const { seed, tokenId } = await resolveSeed({ seed: q.get('seed'), token: q.get('token') });
    const out = await render({ seed, mode: v.mode, coverPt: async pages => {
      try { return await coverSize({ sku: v.sku, pages }); }                 // Lulu's size for this page count
      catch { return { w: (8.75 + pages / 444 + 0.06) * 72, h: 7.125 * 72 }; } // offline: the standard formula
    } });
    const name = `desert-syntax-${tokenId != null ? '#' + tokenId + '-' : ''}${out.editionId}-${q.get('variant') || 'cream'}-${part}.pdf`;
    return new Response(out[part], { headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${name}"`,
      'x-pages': String(out.pages), 'cache-control': 'no-store' } });
  } catch (e) { return new Response(e.message, { status: e.status || 500 }); }
}
