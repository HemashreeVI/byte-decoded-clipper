import { extractArticle } from './extract.js';
import { localScript, aiScript, aiStatus, toText, spokenWords } from './script.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SEGS = [['HOOK', '0:00–0:05'], ['POINT 1', '0:05–0:20'], ['POINT 2', '0:20–0:35'], ['POINT 3', '0:35–0:50'], ['CALL TO ACTION', '0:50–1:00']];
let article, script, variant = 0, status = 'unavailable';

async function build() {
  $('again').disabled = true;
  try {
    script = status === 'available' ? await aiScript(article, variant).catch(() => localScript(article, variant)) : localScript(article, variant);
  } finally { $('again').disabled = false; }
  if (!script) { fail('Not enough article text on this page to make a script. Try it on a blog post or news article.'); return; }
  render();
}

function render() {
  const lines = [script.hook, ...script.points, script.cta];
  $('segments').innerHTML = lines.map((l, i) => `<div class="seg"><div class="lab">${SEGS[i][0]}<span>${SEGS[i][1]}</span></div>
    <div contenteditable="true" data-i="${i}">${esc(l)}</div>${script.onScreen?.[i] ? `<div class="os">on screen: <b>${esc(script.onScreen[i])}</b></div>` : ''}</div>`).join('');
  $('tags').textContent = script.hashtags.join(' ');
  $('engine').textContent = script.engine === 'ai' ? 'on-device AI' : 'key-sentence mode';
  $('engine').className = 'badge' + (script.engine === 'ai' ? ' ai' : '');
  timing();
}
function timing() {
  const w = spokenWords(script), secs = Math.round(w / 2.5);      // ~150 spoken words a minute
  $('timing').textContent = `${w} words · ~${secs}s`;
  $('timing').className = 'badge' + (secs > 62 ? ' over' : '');
}
$('segments').addEventListener('input', e => {
  const i = +e.target.dataset.i, v = e.target.innerText.trim();
  if (i === 0) script.hook = v; else if (i === 4) script.cta = v; else script.points[i - 1] = v;
  timing();
});
$('again').onclick = () => { variant++; build(); };
$('copy').onclick = async () => { await navigator.clipboard.writeText(toText(script, article)); $('copy').textContent = 'Copied ✓'; setTimeout(() => ($('copy').textContent = 'Copy script'), 1400); };
$('dl').onclick = () => {
  const name = article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) + '-short.txt';
  Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([toText(script, article)], { type: 'text/plain' })), download: name }).click();
};
function fail(msg) { $('main').hidden = true; $('err').hidden = false; $('err').textContent = msg; }

(async () => {
  const forced = Number(new URLSearchParams(location.search).get('tab'));      // used by tests
  const [tab] = forced ? [{ id: forced }] : await chrome.tabs.query({ active: true, currentWindow: true });
  try { [{ result: article }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractArticle }); }
  catch { return fail("Chrome doesn't let extensions read this page. Open an article and try again."); }
  $('src').textContent = `${article.site} · ${article.title}`;
  status = await aiStatus();
  if (status === 'downloadable' || status === 'downloading') {
    $('ai').innerHTML = `This computer can run Chrome's free on-device AI for better scripts. <button class="ghost" id="getai">Download AI model (one time)</button>`;
    $('getai').onclick = async () => {
      $('ai').textContent = 'Downloading the model… you can keep using key-sentence mode meanwhile.';
      try { await LanguageModel.create({ monitor(m) { m.addEventListener('downloadprogress', e => ($('ai').textContent = `Downloading the AI model… ${Math.round(e.loaded * 100)}%`)); } });
        status = 'available'; $('ai').textContent = 'On-device AI ready ✓'; build(); } catch { $('ai').textContent = 'Couldn\'t download the model here. Key-sentence mode still works.'; }
    };
  } else if (status === 'unavailable') {
    $('ai').textContent = 'Using key-sentence mode (this Chrome/computer has no built-in AI). Edit any line before copying.';
  }
  $('main').hidden = false;
  build();
})();
