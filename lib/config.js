// Print-on-demand: everything that changes between test and live, or between products, is here.
export const CHAIN = {
  // Same contract as editions/index.html. Switch both together when the editions move to Base mainnet.
  id: 84532, name: 'Base Sepolia',
  rpc: process.env.RPC_URL || 'https://base-sepolia-rpc.publicnode.com',
  token: '0x932E17a326b63CcdEe10DcDcf465544872fCB296',
  seedKey: '0x7365656400000000000000000000000000000000000000000000000000000000', // "seed" as bytes32
};

export const SITE = process.env.SITE_URL || 'http://localhost:3000';

// Lulu: Pocket Book 4.25 x 6.875 in, perfect bound, matte cover. One entry per paper the order page offers.
// mode is passed to DSBook.printEdition (book/src/book-renderer.js).
export const VARIANTS = {
  cream: { label: 'Cream paper, black ink', sku: '0425X0687BWSTDPB060UC444MXX', mode: { gray: true } },
  color: { label: 'White paper, the edition’s colors', sku: '0425X0687FCSTDPB060UW444MXX', mode: { white: true } },
  // tint: { label: 'White paper, the edition’s background printed', sku: '0425X0687FCSTDPB060UW444MXX', mode: { bleed: true } }, // after the proofs
};

// Countries the order page offers, each with a public address used only to price shipping zones.
// Stripe then collects the buyer's real address, restricted to the country that was quoted.
export const COUNTRIES = {
  US: { name: 'United States', addr: { street1: '350 5th Ave', city: 'New York', state_code: 'NY', postcode: '10118' } },
  CA: { name: 'Canada', addr: { street1: '290 Bremner Blvd', city: 'Toronto', state_code: 'ON', postcode: 'M5V 3L9' } },
  GB: { name: 'United Kingdom', addr: { street1: '10 Downing St', city: 'London', postcode: 'SW1A 2AA' } },
  FR: { name: 'France', addr: { street1: '1 Rue de Rivoli', city: 'Paris', postcode: '75001' } },
  DE: { name: 'Germany', addr: { street1: 'Pariser Platz 1', city: 'Berlin', postcode: '10117' } },
  NL: { name: 'Netherlands', addr: { street1: 'Museumstraat 1', city: 'Amsterdam', postcode: '1071 XX' } },
  IT: { name: 'Italy', addr: { street1: 'Piazza del Colosseo 1', city: 'Roma', postcode: '00184' } },
  ES: { name: 'Spain', addr: { street1: 'Calle de Alcalá 1', city: 'Madrid', postcode: '28014' } },
  CH: { name: 'Switzerland', addr: { street1: 'Bahnhofstrasse 1', city: 'Zürich', postcode: '8001' } },
  JP: { name: 'Japan', addr: { street1: '1-1 Chiyoda', city: 'Tokyo', postcode: '100-8111' } },
  AU: { name: 'Australia', addr: { street1: 'Bennelong Point', city: 'Sydney', state_code: 'NSW', postcode: '2000' } },
};
export const LEVELS = { MAIL: 'Mail', EXPEDITED: 'Expedited' }; // Lulu shipping levels offered (when Lulu has them for the country)

// Price = (Lulu total incl. tax) x (1 + BUFFER) + MARGIN, then Stripe's fee on top, rounded up to the next $0.50.
export const PRICING = {
  buffer: +(process.env.PRINT_BUFFER ?? 0.04),   // covers small Lulu price changes and tax differences by state
  margin: +(process.env.PRINT_MARGIN_USD ?? 0),  // what you keep per book, in dollars
  stripePct: 0.029, stripeFixed: 0.30,
  quotePages: 62,                                 // print editions run 44-60 pages (long chapters continue on a second page); quote the longest
};

export const LULU_HOST = process.env.LULU_ENV === 'production' ? 'api.lulu.com' : 'api.sandbox.lulu.com';
export const PRODUCTION_DELAY_MIN = 60;          // a placed job stays cancellable at Lulu for this long
export const MAX_PER_TOKEN = +(process.env.PRINT_MAX_PER_TOKEN ?? 5);
