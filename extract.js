// Injected into the article tab when you open the popup. Pulls the title and the readable text.
// Self-contained on purpose: chrome.scripting serialises just this function.
export function extractArticle() {
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const meta = n => clean(document.querySelector(`meta[property="${n}"],meta[name="${n}"]`)?.content);
  const JUNK = /(cookie|subscribe|sign up|newsletter|advertis|all rights reserved|©|share this|related articles|read more|log in|privacy policy)/i;
  // the container with the most paragraph text is usually the article body
  const cands = [...document.querySelectorAll('article, main, [role="main"], .post, .article, .content, #content, .entry-content, .post-content')];
  let best = document.body, bestLen = 0;
  for (const c of cands.length ? cands : [document.body]) {
    const len = [...c.querySelectorAll('p')].reduce((a, p) => a + clean(p.innerText).length, 0);
    if (len > bestLen) { best = c; bestLen = len; }
  }
  const blocks = [];
  for (const el of best.querySelectorAll('h2, h3, p, li, blockquote')) {
    if (el.closest('nav, footer, aside, header, form, [class*="comment"], [class*="share"], [class*="related"]')) continue;
    const t = clean(el.innerText);
    if (!t || JUNK.test(t)) continue;
    if (/^H[23]$/.test(el.tagName)) blocks.push({ h: t });
    else if (t.length > 40) blocks.push({ p: t });
  }
  return {
    title: clean(meta('og:title') || document.querySelector('h1')?.innerText || document.title).replace(/\s+[|–—-]\s+[^|–—-]+$/, ''),
    description: meta('og:description') || meta('description'),
    site: meta('og:site_name') || location.hostname.replace(/^www\./, ''),
    url: location.href.split('#')[0],
    blocks: blocks.slice(0, 400),
  };
}
