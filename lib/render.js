// Lulu-ready PDFs for one edition, rendered by headless Chromium from the same files as /editions/.
// On Vercel: @sparticuz/chromium. Locally: set CHROME_PATH to a Chrome/Chromium binary.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { PDFDocument } from 'pdf-lib';

const ED = join(process.cwd(), 'editions');
const read = p => readFileSync(join(ED, p), 'utf8');

function pageHTML() {
  const fonts = read('styles/fonts.css').replace(/url\(\.\.\/fonts\/([^)]+)\.woff2\)/g, (_, n) =>
    `url(data:font/woff2;base64,${readFileSync(join(ED, 'fonts', n + '.woff2')).toString('base64')})`);
  const js = ['src/book-data.js', 'src/vignettes.js', 'src/covers.js', 'src/plant2d.js', 'src/book-renderer.js']
    .map(f => `<script>${read(f).replace(/<\/script/gi, '<\\/script')}</script>`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${fonts}\n${read('styles/book.css')}</style></head><body style="margin:0;background:#fff">${js}</body></html>`;
}

async function browser() {
  // pipe: talk to Chrome over a pipe instead of waiting for its WebSocket address on stdout (desktop Chrome on macOS can stall there)
  if (process.env.CHROME_PATH) return puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, pipe: true, timeout: 90000,
    args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-gpu'] });
  const chromium = (await import('@sparticuz/chromium')).default;
  return puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
}

// Chrome rounds page sizes by a fraction of a point; Lulu wants them exact.
async function exactBox(bytes, wIn, hIn) {
  const doc = await PDFDocument.load(bytes), W = wIn * 72, H = hIn * 72;
  for (const p of doc.getPages()) { const top = p.getMediaBox().y + p.getMediaBox().height;
    p.setMediaBox(0, top - H, W, H); p.setCropBox(0, top - H, W, H); p.setTrimBox(0, top - H, W, H); }
  return Buffer.from(await doc.save());
}

/**
 * render({ seed, mode, coverPt }) → { interior, cover, pages }
 * mode: DSBook.printEdition options ({gray}|{white}|{bleed}). coverPt: async (pages) => {w,h} from Lulu's cover-dimensions.
 */
export async function render({ seed, mode, coverPt }) {
  const b = await browser();
  try {
    const p = await b.newPage();
    await p.setContent(pageHTML(), { waitUntil: 'load' });
    await p.evaluate(() => Promise.all([...document.fonts].map(f => f.load())));

    // interior
    const info = await p.evaluate(({ seed, mode }) => {
      const ed = DSBook.printEdition(DSBook.edition(seed, __BOOK), mode);
      const el = document.createElement('div'); document.body.appendChild(el);
      DSBook.renderBook(el, ed, __BOOK, DesertVignettes);
      el.querySelectorAll('.pg').forEach(pg => pg.hidden = false);
      const st = document.createElement('style');
      st.textContent = `@page{size:${ed.fmt.w / 96}in ${ed.fmt.h / 96}in;margin:0}.book{display:block!important}.book .pg{margin:0!important;box-shadow:none!important;break-after:page;break-inside:avoid}.book .pg:last-child{break-after:auto}`;
      document.head.appendChild(st);
      const over = [...el.querySelectorAll('.pg:not(.fm)')].filter(pg => pg.dataset.over === '1').map(pg => pg.id);
      return { pages: el.querySelectorAll('.pg').length, w: ed.fmt.w, h: ed.fmt.h, id: DSBook.edition(seed, __BOOK).id, over };
    }, { seed, mode });
    if (info.over.length) throw new Error(`text overflows on ${info.over.join(', ')}`);
    let interior = await p.pdf({ width: info.w / 96 + 'in', height: info.h / 96 + 'in', printBackground: true, preferCSSPageSize: true });
    interior = await exactBox(interior, info.w / 96, info.h / 96);

    // cover spread, at the size Lulu asks for this page count
    const size = await coverPt(info.pages);
    const CWin = size.w / 72, CHin = size.h / 72;
    await p.evaluate(({ seed, CW, CH }) => {
      const ed0 = DSBook.edition(seed, __BOOK), ed = DSBook.printEdition(ed0, {}), P = ed0.pal;
      const B = 12, W = 408, H = 660, spine = CW - 2 * W - 2 * B;
      document.body.innerHTML = ''; document.head.querySelectorAll('style[data-cover]').forEach(s => s.remove());
      const st = document.createElement('style'); st.dataset.cover = 1;
      st.textContent = `@page{size:${CW / 96}in ${CH / 96}in;margin:0}html,body{margin:0;padding:0;overflow:hidden}`; document.head.appendChild(st);
      const c = document.createElement('div'); c.className = 'book t-' + ed0.type.n;
      c.setAttribute('style', DSBook.bookCSSVars(ed) + `;position:relative;width:${CW}px;height:${CH}px;background:${P.bg};color:${P.ink};overflow:hidden`);
      const front = document.createElement('div');
      front.style.cssText = `position:absolute;top:0;left:${B + W + spine}px;width:${W + B}px;height:${CH}px;overflow:hidden`;
      front.innerHTML = DSBook.coverSVG(ed);
      const svg = front.querySelector('svg'); svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%'); svg.setAttribute('preserveAspectRatio', 'xMidYMid slice'); svg.style.display = 'block';
      const ttl = document.createElement('div');
      ttl.style.cssText = `position:absolute;top:${B + 54}px;left:54px;right:${B + 56}px;display:flex;justify-content:space-between;align-items:baseline;font-family:var(--hf);font-weight:var(--hw);letter-spacing:.14em;text-transform:uppercase;color:${P.ink}`;
      ttl.innerHTML = `<span style="font-size:15px">Desert Syntax</span><span style="font-size:9px;opacity:.75">${ed0.id}</span>`;
      front.appendChild(ttl);
      const back = document.createElement('div');
      back.style.cssText = `position:absolute;top:${B}px;left:${B}px;width:${W}px;height:${H}px;box-sizing:border-box;padding:56px 54px;display:flex;flex-direction:column;gap:14px;font-family:var(--bf);font-size:11px;line-height:1.5`;
      back.innerHTML = `
        <div style="font-family:var(--hf);font-weight:var(--hw);letter-spacing:.14em;text-transform:uppercase;font-size:15px;color:${P.ac}">Desert Syntax</div>
        <div style="font-style:italic">a collaborative performance score</div>
        <div style="margin-top:10px;max-width:270px">Thirty-one chapters, each begun from a single word given by a visitor to the booth and written live, in one afternoon in Marfa, Texas, on October 24, 2026.</div>
        <div style="max-width:270px">This book is one edition among many possible: the text is shared, the rendering is set by a seed.</div>
        <div style="margin-top:8px;font-family:var(--hf);font-size:9px;letter-spacing:.12em;text-transform:uppercase;opacity:.75">Edition ${ed0.id}</div>
        <div style="font-family:'DS Plex',monospace;font-size:8.5px;letter-spacing:.06em;line-height:1.6;opacity:.85">${seed.slice(2).match(/.{16}/g).join('<br>')}</div>
        <div style="margin-top:auto;font-family:var(--hf);font-size:9px;letter-spacing:.12em;text-transform:uppercase;opacity:.75">æther &amp; rapha</div>`;
      c.append(back, front); document.body.appendChild(c);
    }, { seed, CW: CWin * 96, CH: CHin * 96 });
    await p.evaluate(() => document.fonts.ready);
    let cover = await p.pdf({ width: CWin + 'in', height: CHin + 'in', printBackground: true, preferCSSPageSize: true });
    cover = await exactBox(cover, CWin, CHin);
    return { interior, cover, pages: info.pages, editionId: info.id };
  } finally { await b.close(); }
}
