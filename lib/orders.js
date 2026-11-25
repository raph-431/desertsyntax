// Order records and print files, kept in Vercel Blob (BLOB_READ_WRITE_TOKEN is added when a Blob store is linked to the project).
// orders/<stripe session id>.json  – one record per paid order, written at each step
// lulu/<job id>.json               – points a Lulu job back to its order
// prints/<seed>/<variant>-<renderer version>/…  – the PDFs Lulu downloads
import { put, head } from '@vercel/blob';

const opts = { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true };
// Order JSON holds the shipping address: stored under an unguessable path (the session id) and never listed publicly.

export async function getJSON(path) {
  try { const h = await head(path); const r = await fetch(h.url + '?t=' + Date.now(), { cache: 'no-store' }); return r.ok ? r.json() : null; }
  catch { return null; }
}
export async function putJSON(path, obj) { await put(path, JSON.stringify(obj, null, 1), opts); return obj; }

export const getOrder = id => getJSON(`orders/${id}.json`);
export async function saveOrder(id, patch) {
  const cur = (await getOrder(id)) || { id, created: new Date().toISOString(), log: [] };
  const next = { ...cur, ...patch, updated: new Date().toISOString(), log: [...(cur.log || []), { at: new Date().toISOString(), status: patch.status || cur.status }] };
  return putJSON(`orders/${id}.json`, next);
}

export async function putPDF(path, bytes) {
  const b = await put(path, bytes, { access: 'public', contentType: 'application/pdf', addRandomSuffix: true });
  return b.url;
}
