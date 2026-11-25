// Register (once per Lulu environment) the URL Lulu calls when a print job changes status.
//   LULU_KEY=… LULU_SECRET=… [LULU_ENV=production] node scripts/lulu-webhook.mjs https://desertsyntax.com/api/lulu-webhook
//   … node scripts/lulu-webhook.mjs --list
import { lulu } from '../lib/lulu.js';
const arg = process.argv[2];
if (!arg || arg === '--list') console.log(JSON.stringify(await lulu('GET', '/webhooks/'), null, 1));
else console.log(JSON.stringify(await lulu('POST', '/webhooks/', { topics: ['PRINT_JOB_STATUS_CHANGED'], url: arg }), null, 1));
