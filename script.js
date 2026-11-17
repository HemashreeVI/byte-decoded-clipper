// Builds a 60-second Short script from an article.
// 1) Chrome's built-in on-device AI (Prompt API), when this computer supports it: free and private.
// 2) Otherwise a local key-sentence method: no AI, no network, still free.

export const CHANNEL = 'Byte Decoded';
const STOP = new Set(('a an the and or but if then so of to in on at by for with from as is are was were be been being it its this that these those ' +
  'you your we our they their he she his her i me my can will would could should may might must do does did done have has had not no yes ' +
  'more most less very just also than too into over about after before up down out off what which who whom when where why how all any ' +
  'each other some such only own same new one two first get got make made use used using like there here while because through').split(' '));

const words = s => s.toLowerCase().match(/[a-z][a-z0-9+#.-]*[a-z0-9+#]|[a-z]/g) || [];
const sentencesOf = t => t.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) || [];
const trimTo = (s, n) => { const w = s.split(/\s+/); if (w.length <= n) return s.replace(/[;:,]$/, '');
  let cut = w.slice(0, n).join(' '); const c = Math.max(cut.lastIndexOf(','), cut.lastIndexOf(';'), cut.lastIndexOf(' — '));
  if (c > cut.length * .55) cut = cut.slice(0, c); return cut.replace(/[,;:\s]+$/, '') + '.'; };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export function keywords(article, n = 8) {
  const f = new Map(), add = (w, k) => { if (w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)) f.set(w, (f.get(w) || 0) + k); };
  words(article.title).forEach(w => add(w, 4));
  article.blocks.forEach(b => words(b.h || '').forEach(w => add(w, 2)));
  article.blocks.forEach(b => words(b.p || '').forEach(w => add(w, 1)));
  return [...f.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}

function properNouns(article) {
  const f = new Map();
  for (const b of article.blocks) for (const sent of sentencesOf(b.p || '')) {
    sent.split(/\s+/).slice(1).forEach(w => {
      const m = w.match(/^([A-Z][A-Za-z0-9+#.]*[A-Za-z0-9+#])/);
      if (m && !STOP.has(m[1].toLowerCase()) && m[1].length > 2) f.set(m[1], (f.get(m[1]) || 0) + 1);
    });
  }
  (article.title.match(/\b[A-Z][A-Za-z0-9+#]+/g) || []).slice(1).forEach(w => f.set(w, (f.get(w) || 0) + 2));
  return [...f.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w);
}

export function localScript(article, variant = 0) {
  const kw = keywords(article, 30), weight = new Map(kw.map((w, i) => [w, 30 - i]));
  const sents = [];
  article.blocks.forEach((b, bi) => b.p && sentencesOf(b.p).forEach((s, si, all) => {
    const ws = words(s); if (ws.length < 7 || ws.length > 60) return;
    const next = all[si + 1];
    let score = ws.reduce((a, w) => a + (weight.get(w) || 0), 0) / Math.pow(ws.length, .5);
    if (/\d/.test(s)) score *= 1.25;                     // numbers make good Shorts
    if (/\b(you|your)\b/i.test(s)) score *= 1.1;
    if (/^(but|and|so|this|that|it|they)\b/i.test(s)) score *= .7;   // needs context, weak on its own
    sents.push({ s, next, score, pos: bi / Math.max(1, article.blocks.length) });
  }));
  if (!sents.length) return null;
  // one point from each third of the article, so the Short covers the whole story
  const points = [];
  for (const [lo, hi] of [[0, .34], [.34, .67], [.67, 1.01]]) {
    const pick = sents.filter(x => x.pos >= lo && x.pos < hi && !points.includes(x)).sort((a, b) => b.score - a.score)[variant % 2];
    if (pick) points.push(pick);
  }
  for (const x of [...sents].sort((a, b) => b.score - a.score)) if (points.length < 3 && !points.includes(x)) points.push(x);
  points.sort((a, b) => a.pos - b.pos);

  const nouns = properNouns(article);
  const topic = nouns[0] ? nouns[0] + (kw.find(w => w !== nouns[0].toLowerCase()) ? ' ' + kw.find(w => w !== nouns[0].toLowerCase()) : '') : kw.slice(0, 2).join(' ');
  // a point is its key sentence, plus the next one when the pair still fits ~38 words
  const say = p => { const one = trimTo(p.s, 30); return p.next && (one + ' ' + p.next).split(/\s+/).length <= 40 ? one + ' ' + p.next : one; };
  const caption = p => { const ws = [...new Set(words(p.s))].filter(w => weight.has(w)).sort((a, b) => weight.get(b) - weight.get(a));
    const named = nouns.filter(n => p.s.includes(n)).slice(0, 2);
    return (named.length >= 2 ? named : [...named, ...ws.filter(w => !named.some(n => n.toLowerCase() === w)).slice(0, 2 - named.length).map(cap)]).join(' + '); };
  const stat = sents.filter(x => /\d/.test(x.s)).sort((a, b) => b.score - a.score)[0];
  const t = article.title.replace(/[.!]$/, '');
  const hooks = [
    /\?$/.test(t) ? t : `${t}. Here's what that actually means, in 60 seconds.`,
    stat ? trimTo(stat.s, 18) + ' Let me explain.' : `Everyone's talking about ${topic}. Here's what you need to know.`,
    `Most people get ${topic} wrong. Here's what's really going on.`,
  ];
  return {
    hook: hooks[variant % hooks.length],
    points: points.slice(0, 3).map(say),
    cta: `Follow ${CHANNEL} for more tech, decoded in 60 seconds.`,
    onScreen: [cap(topic), ...points.slice(0, 3).map(caption)],
    hashtags: [...new Map([...nouns.slice(0, 3), ...kw.filter(w => !/(ing|ed|ly)$/.test(w)).slice(0, 3)]
      .map(w => '#' + w.replace(/[^A-Za-z0-9]/g, '')).map(t => [t.toLowerCase(), t])).values()]
      .slice(0, 4).concat(['#ByteDecoded', '#shorts', '#tech']),
    engine: 'local',
  };
}

// ---------------------------------------------------------------- on-device AI (Chrome's Prompt API)
export async function aiStatus() {
  try { return 'LanguageModel' in self ? await LanguageModel.availability() : 'unavailable'; } catch { return 'unavailable'; }
}

export async function aiScript(article, variant = 0) {
  const text = article.blocks.map(b => b.h ? `## ${b.h}` : b.p).join('\n').slice(0, 9000);
  const styles = ['curious and clear', 'high-energy', 'myth-busting'];
  const session = await LanguageModel.create({
    initialPrompts: [{ role: 'system', content: `You write 60-second YouTube Shorts scripts for "${CHANNEL}", a tech channel for students and developers. Simple words, short sentences, no jargon without explaining it. Stick to facts in the article.` }],
  });
  const schema = { type: 'object', required: ['hook', 'points', 'cta', 'onScreen', 'hashtags'], properties: {
    hook: { type: 'string' }, points: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
    cta: { type: 'string' }, onScreen: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
    hashtags: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 7 } } };
  const out = await session.prompt(
    `Write a ${styles[variant % 3]} Short about this article.\n- hook: one line, under 15 words, makes people stay\n- points: exactly 3, each under 25 words\n` +
    `- cta: ask them to follow ${CHANNEL}\n- onScreen: 4 captions of 2-4 words (hook + one per point)\n- hashtags: 5-7, include #ByteDecoded and #shorts\n\n` +
    `TITLE: ${article.title}\n\nARTICLE:\n${text}`, { responseConstraint: schema });
  session.destroy();
  return { ...JSON.parse(out), engine: 'ai' };
}

export function toText(s, article) {
  const seg = ['0:00–0:05  HOOK', '0:05–0:20  POINT 1', '0:20–0:35  POINT 2', '0:35–0:50  POINT 3', '0:50–1:00  CALL TO ACTION'];
  const lines = [s.hook, ...s.points, s.cta];
  return lines.map((l, i) => `${seg[i]}\n${l}${s.onScreen?.[i] ? `\n  [on screen: ${s.onScreen[i]}]` : ''}`).join('\n\n') +
    `\n\n${s.hashtags.join(' ')}\n\nSource: ${article.title} (${article.site}) ${article.url}`;
}

export const spokenWords = s => [s.hook, ...s.points, s.cta].join(' ').split(/\s+/).filter(Boolean).length;
