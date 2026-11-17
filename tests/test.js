const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const SHOTS = process.argv[2];
const ARTICLE = `<!doctype html><html><head><meta charset="utf-8"><title>Why Kafka is replacing message queues at startups | DevTimes</title>
<meta property="og:title" content="Why Kafka is replacing message queues at startups"><meta property="og:site_name" content="DevTimes"></head><body>
<nav><a>Home</a><a>Sign up for our newsletter</a></nav>
<article>
<h1>Why Kafka is replacing message queues at startups</h1>
<p>Apache Kafka started at LinkedIn in 2011 to move activity data between systems. Today more than 80% of Fortune 100 companies use it, and startups are adopting it earlier than ever.</p>
<p>The big difference is that Kafka is a log, not a queue. Messages are not deleted when they are read, so many services can read the same stream at their own pace and replay it later.</p>
<h2>Why startups care</h2>
<p>Startups use Kafka to decouple services. When a payment succeeds, the payment service writes one event, and email, analytics and fraud checks all react to it without calling each other.</p>
<p>Managed services like Confluent Cloud and Amazon MSK mean a two-person team can run Kafka without hiring an operations engineer.</p>
<h2>The catch</h2>
<p>Kafka is not free to run. A small cluster still needs three brokers for safety, and costs can climb past $500 a month before you have real traffic.</p>
<p>You also have to think about ordering and duplicates: Kafka only guarantees order inside a partition, so your consumers must handle the same event arriving twice.</p>
<p>For many early products, a simple Postgres table or Redis stream is enough, and you can move to Kafka when traffic grows.</p>
<div class="share">Share this article on X and LinkedIn</div>
</article>
<footer>© 2026 DevTimes. All rights reserved. Privacy policy.</footer></body></html>`;

(async () => {
  const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-'));
  fs.cpSync(path.resolve(__dirname, '..'), ext, { recursive: true });
  const m = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'))); m.host_permissions = ['<all_urls>'];
  fs.writeFileSync(path.join(ext, 'manifest.json'), JSON.stringify(m));
  const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, viewport: { width: 400, height: 760 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  await ctx.route('https://devtimes.example/**', r => r.fulfill({ contentType: 'text/html', body: ARTICLE }));
  // find the extension id from its popup page
  const pg = await ctx.newPage(); await pg.goto('https://devtimes.example/kafka-at-startups');
  let id; for (let i = 0; i < 30 && !id; i++) { const b = ctx.backgroundPages()[0] || ctx.serviceWorkers()[0]; if (b) id = b.url().split('/')[2]; else await pg.waitForTimeout(200); }
  if (!id) { const t = await ctx.newPage(); await t.goto('chrome://extensions'); id = await t.evaluate(async () => (await chrome.management.getAll())[0].id).catch(() => null); }
  const errors = [];
  const pop = await ctx.newPage(); pop.on('pageerror', e => errors.push(e.message));
  // tab id: ask the extension page itself
  await pop.goto(`chrome-extension://${id}/popup.html?tab=0`).catch(() => {});
  const tabId = await pop.evaluate(async () => (await chrome.tabs.query({ url: 'https://devtimes.example/*' }))[0].id);
  await pop.goto(`chrome-extension://${id}/popup.html?tab=${tabId}`);
  await pop.waitForSelector('.seg');
  const out = await pop.evaluate(() => ({ engine: engine.textContent, timing: timing.textContent,
    segs: [...document.querySelectorAll('.seg')].map(s => s.innerText.replace(/\n/g, ' | ')), tags: tags.textContent, ai: ai.textContent }));
  console.log(JSON.stringify(out, null, 1));
  await pop.screenshot({ path: `${SHOTS}/bc-popup.png`, fullPage: true });
  await pop.click('#again'); await pop.waitForTimeout(300);
  console.log('another take hook:', await pop.evaluate(() => document.querySelector('.seg [contenteditable]').innerText));
  console.log('errors:', errors.length ? errors : 'none');
  await ctx.close();
})();
