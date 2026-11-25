// GET /api/print/message?token=12&address=0x…&issued=ISO  → the exact text the wallet signs (built by the server, so both sides agree)
import { orderMessage } from '../../lib/chain.js';
export function GET(request) {
  const q = new URL(request.url).searchParams;
  try { return Response.json({ message: orderMessage(q.get('token'), q.get('address'), q.get('issued')) }); }
  catch { return Response.json({ error: 'bad address' }, { status: 400 }); }
}
