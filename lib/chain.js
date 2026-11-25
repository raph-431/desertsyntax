// Reads from the editions contract with plain JSON-RPC (same calls as editions/index.html), and checks wallet signatures.
import { verifyMessage, getAddress } from 'viem';
import { CHAIN } from './config.js';

const pad = h => h.replace(/^0x/, '').toLowerCase().padStart(64, '0');
const word = (r, i) => '0x' + r.slice(2 + 64 * i, 66 + 64 * i);

async function call(data) {
  const r = await fetch(CHAIN.rpc, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: CHAIN.token, data }, 'latest'] }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || 'rpc error');
  return j.result;
}

// token.tokenParam(uint256 id, bytes32 key) -> (bytes32 value, bool isHash, bool isSet)
export async function seedOf(id) {
  const r = await call('0x6bd39222' + pad(BigInt(id).toString(16)) + pad(CHAIN.seedKey));
  if (!r || r === '0x' || BigInt(word(r, 2)) === 0n) return null;
  return word(r, 0);
}

// ERC-721 ownerOf(uint256)
export async function ownerOf(id) {
  try { const r = await call('0x6352211e' + pad(BigInt(id).toString(16))); return getAddress('0x' + r.slice(-40)); }
  catch { return null; }
}

// A print order names either a seed (any edition, minted or not) or a token (its seed is read on chain).
export async function resolveSeed({ seed, token }) {
  const err = (m, status) => Object.assign(new Error(m), { status });
  if (token != null && token !== '') {
    if (!/^\d+$/.test(String(token))) throw err('bad edition number', 400);
    const s = await seedOf(token); if (!s) throw err(`edition #${token} is not minted`, 404);
    return { seed: s.toLowerCase(), tokenId: Number(token) };
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(seed || '')) throw err('no edition given', 400);
  return { seed: seed.toLowerCase(), tokenId: null };
}

// Kept for a possible holders-only option: the order page would ask the wallet to sign this exact text; the server rebuilds it and checks the signature.
export function orderMessage(tokenId, address, issued) {
  return `Desert Syntax · print order\nEdition #${tokenId}\nWallet ${getAddress(address)}\nIssued ${issued}`;
}

export async function verifyOwner({ tokenId, address, issued, signature }) {
  if (!address || !signature || !issued) throw new Error('missing wallet signature');
  const age = Date.now() - Date.parse(issued);
  if (!(age >= -60e3 && age < 30 * 60e3)) throw new Error('the signature is too old; sign again');
  const ok = await verifyMessage({ address: getAddress(address), message: orderMessage(tokenId, address, issued), signature });
  if (!ok) throw new Error('the signature does not match the wallet');
  const owner = await ownerOf(tokenId);
  if (!owner) throw new Error(`edition #${tokenId} is not minted`);
  if (owner.toLowerCase() !== address.toLowerCase()) throw new Error(`edition #${tokenId} belongs to another wallet`);
  return owner;
}
