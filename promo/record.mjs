// Records the promo shots from the live playdead site as timestamped JPEG frames.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const BASE = 'https://playdead.turbo-gateway.com/';
// Optional: SPKI hash of an extra CA to trust (e.g. a TLS-intercepting proxy). See README.
const SPKI_FILE = path.join(ROOT, 'spki.txt');
const SPKI = fs.existsSync(SPKI_FILE) ? fs.readFileSync(SPKI_FILE, 'utf8').trim() : '';
const BARTON = 'rY5Qx1pAsMdlnQiGBWf2HdNK-RDL3LGyICud7dT1W1A';
const CAPITOL = 'vAy8PUNw98wf5Zb9ZaWzYx-KqYIyLe9R-FpEfkKX6EI';
const CAPITOL_REEL = 'CbO66XUUjRNQpYpcOsS1KhnOusXeu46VlVHoRevnYg4';
const GOOSE = 'HzOQdtO0M0qUpvTJx4uBP86JZQIvDiWnmwEdxUuX6UY';
const BED_START = Number(process.env.BED_START || 110); // seconds into Scarlet Begonias
const only = process.argv.slice(2);

const browser = await chromium.launch({
  channel: 'chromium',
  args: [...(SPKI ? [`--ignore-certificate-errors-spki-list=${SPKI}`] : []), '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'],
});
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
page.on('pageerror', e => console.log('pageerror', e.message));

// Title/end cards are served from the live origin so ./assets/ resolves to the real app assets.
await page.route('**/__promo/card.html*', r => r.fulfill({ path: path.join(ROOT, 'card.html'), contentType: 'text/html' }));
await page.route('**/__promo/assets/**', r => r.continue({ url: r.request().url().replace('/__promo/', '/') }));
// Headless Chromium has no H.264, so serve a VP9 transcode of the same reel.
await page.route(`**/${CAPITOL_REEL}*`, r => r.fulfill({ path: path.join(ROOT, 'clip1976.webm'), contentType: 'video/webm' }));

const cdp = await context.newCDPSession(page);
let seg = null;
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  if (!seg) return;
  const f = `${String(seg.frames.length).padStart(5, '0')}.jpg`;
  fs.writeFileSync(path.join(seg.dir, f), Buffer.from(data, 'base64'));
  seg.frames.push({ f, t: metadata.timestamp });
});
const startCast = () => cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
const restartCast = async () => { await cdp.send('Page.stopScreencast').catch(() => {}); await startCast(); };

async function begin(name) {
  const dir = path.join(ROOT, 'seg', name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  seg = { name, dir, frames: [], start: Date.now() / 1000, marks: {} };
  await startCast();
}
async function end() {
  await page.waitForTimeout(100);
  await cdp.send('Page.stopScreencast');
  seg.end = Date.now() / 1000;
  fs.writeFileSync(path.join(seg.dir, 'frames.json'), JSON.stringify(seg, null, 1));
  console.log(seg.name, seg.frames.length, 'frames', (seg.end - seg.start).toFixed(2), 's', JSON.stringify(seg.marks));
  seg = null;
}
const mark = k => { seg.marks[k] = Date.now() / 1000 - seg.start; };

async function caption(text) {
  await page.evaluate(t => {
    let c = document.getElementById('promo-cap');
    if (!c) {
      c = document.createElement('div');
      c.id = 'promo-cap';
      c.style.cssText = 'position:fixed;left:50%;bottom:7%;transform:translate(-50%,20px);z-index:99999;opacity:0;' +
        'transition:opacity .45s,transform .45s;font:bold 54px Arial,sans-serif;color:#fff;text-shadow:3px 3px 0 #000;' +
        'background:rgba(0,0,0,.6);padding:16px 40px;border-radius:14px;border:3px solid #ff4500;white-space:nowrap;pointer-events:none';
      document.body.appendChild(c);
    }
    c.style.opacity = 0; c.style.transform = 'translate(-50%,20px)';
    setTimeout(() => { c.textContent = t; c.style.opacity = 1; c.style.transform = 'translate(-50%,0)'; }, t ? 60 : 0);
  }, text);
}
async function waitImages() {
  await page.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 60000 }).catch(() => console.log('images timeout'));
}
async function smoothScroll(to, ms) {
  await page.evaluate(([to, ms]) => new Promise(res => {
    const from = scrollY, t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      scrollTo(0, from + (to - from) * e);
      k < 1 ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  }), [to, ms]);
}
const want = n => !only.length || only.includes(n);

// Warm the cache so covers appear promptly while recording.
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await waitImages();

if (want('a_title')) {
  await page.goto(BASE + '__promo/card.html?sub=' + encodeURIComponent('Live music. Preserved forever.'), { waitUntil: 'load' });
  await begin('a_title');
  await page.waitForTimeout(150);
  await page.evaluate(() => document.body.classList.add('go'));
  await page.waitForTimeout(4200);
  await end();
}

if (want('b_home')) {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
  await waitImages();
  await page.evaluate(() => scrollTo(0, 0));
  await page.evaluate(() => { const l = document.getElementById('app-logo'); l.style.animation = 'none'; l.offsetHeight; l.style.animation = ''; });
  await begin('b_home');
  await page.waitForTimeout(900);
  await caption('A permanent home for live recordings');
  await page.waitForTimeout(1200);
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await smoothScroll(max, 4200);
  await page.waitForTimeout(300);
  const card = page.locator(`a.cassette[href*="${BARTON}"]`);
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await page.waitForTimeout(900);
  await end();
}

if (want('c_player')) {
  await page.goto(BASE + 'player.html?album=' + BARTON, { waitUntil: 'networkidle', timeout: 120000 });
  await waitImages();
  await page.waitForSelector('#tracklist-body tr');
  await begin('c_player');
  await page.waitForTimeout(500);
  await page.locator('#tracklist-body tr').nth(11).click();
  await page.waitForFunction(() => { const a = document.getElementById('audio-player'); return a.readyState >= 1; }, null, { timeout: 60000 });
  await page.evaluate(t => { const a = document.getElementById('audio-player'); a.currentTime = t; a.play(); }, BED_START);
  mark('audio');
  await caption('Streams straight from the permaweb');
  await page.waitForTimeout(3200);
  await caption('');
  await page.click('#toggle-visualizer');
  await page.waitForTimeout(400);
  await caption('Built-in laser show');
  await page.waitForTimeout(2400);
  await page.click('#toggle-visualizer');
  await page.waitForTimeout(2800);
  await page.click('#toggle-visualizer');
  await page.waitForTimeout(2800);
  mark('audio_end');
  await end();
  await page.evaluate(() => document.getElementById('audio-player').pause());
}

if (want('d_video')) {
  await page.goto(BASE + 'player.html?album=' + CAPITOL, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForSelector('#tracklist-body tr');
  await begin('d_video');
  await page.click('#play-button');
  await page.waitForFunction(() => { const v = document.querySelector('video'); return v && v.currentTime > 0; }, null, { timeout: 60000 });
  mark('video');
  const t = await page.evaluate(() => document.querySelector('video').currentTime);
  seg.marks.videoTimeAtMark = t;
  await caption('Concert video, too');
  await page.waitForTimeout(4500);
  await end();
  await page.evaluate(() => document.querySelector('video')?.pause());
}

if (want('e_load')) {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
  await waitImages();
  await begin('e_load');
  await page.waitForTimeout(400);
  await caption('Load any tape by its Arweave ID');
  await page.click('#manual-txid');
  await page.keyboard.type(GOOSE, { delay: 35 });
  await page.waitForTimeout(400);
  mark('click');
  await page.click('#load-album-button');
  await page.waitForLoadState('load');
  await restartCast();
  await page.waitForSelector('#tracklist-body tr', { timeout: 60000 });
  await page.waitForFunction(() => { const c = document.getElementById('album-cover'); return c.complete && c.naturalWidth > 0; }, null, { timeout: 60000 });
  await page.waitForTimeout(1100); // let the cover's intro animation finish
  mark('loaded');
  await page.waitForTimeout(2600);
  await end();
}

if (want('f_end')) {
  await page.goto(BASE + '__promo/card.html?sub=' + encodeURIComponent('Free to stream. Stored on Arweave forever.') + '&url=playdead.ar.io', { waitUntil: 'load' });
  await begin('f_end');
  await page.waitForTimeout(150);
  await page.evaluate(() => document.body.classList.add('go'));
  await page.waitForTimeout(4800);
  await end();
}

await browser.close();
