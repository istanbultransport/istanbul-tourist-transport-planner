import fs from 'node:fs';
import vm from 'node:vm';

const fail = [];
const pass = [];
const check = (name, condition, detail = '') => {
  (condition ? pass : fail).push(condition ? name : `${name}${detail ? `: ${detail}` : ''}`);
};
const read = path => fs.readFileSync(path, 'utf8');

const html = read('index.html');
const sw = read('sw.js');
const manifestText = read('manifest.json');
const qa = read('qa.html');

const scripts = [...html.matchAll(/<script\\b[^>]*>([\\s\\S]*?)<\\/script>/gi)].map(m => m[1]);
check('index.html contains inline scripts', scripts.length > 0);
scripts.forEach((source, index) => {
  try { new vm.Script(source, { filename: `index.html:inline-${index + 1}` }); }
  catch (error) { fail.push(`inline script ${index + 1} syntax: ${error.message}`); }
});
try { new vm.Script(sw, { filename: 'sw.js' }); pass.push('sw.js syntax'); }
catch (error) { fail.push(`sw.js syntax: ${error.message}`); }
try { JSON.parse(manifestText); pass.push('manifest.json valid JSON'); }
catch (error) { fail.push(`manifest.json: ${error.message}`); }

const ids = [...html.matchAll(/\\bid=["']([^"'$]+)["']/g)].map(m => m[1]);
const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
check('no duplicate static HTML IDs', duplicates.length === 0, duplicates.join(', '));
const idSet = new Set(ids);
const refs = [...html.matchAll(/getElementById\\(['"]([^'"]+)['"]\\)/g)].map(m => m[1]);
const missing = [...new Set(refs.filter(id => !idSet.has(id)))];
check('getElementById references resolve', missing.length === 0, missing.join(', '));

const required = [
  ['async GPS callback', 'getCurrentPosition(async pos=>{'],
  ['card renderer', 'function render()'],
  ['fallback card renderer', 'function safeCards()'],
  ['place search', 'uiRecoveryPlaceSearch'],
  ['Europe filter', 'data-filter="Avrupa Yakası"'],
  ['Anatolia filter', 'data-filter="Anadolu Yakası"'],
  ['city discovery tab', 'cityTab.onclick=function'],
  ['ticket help tab', 'ticketTab.onclick=function'],
  ['transport map', 'function openTransportMap'],
  ['GPS live station registry', 'GetStations'],
  ['last-mile bus registry', 'lastMileBusRegistry'],
];
for (const [name, needle] of required) check(name, html.includes(needle));

try {
  const inline = [...qa.matchAll(/<script\\b[^>]*>([\\s\\S]*?)<\\/script>/gi)].map(m => m[1]);
  inline.forEach((source, index) => new vm.Script(source, { filename: `qa.html:inline-${index + 1}` }));
  pass.push('qa.html inline script syntax');
} catch (error) { fail.push(`qa.html syntax: ${error.message}`); }

check('QA harness checks initial place cards', qa.includes('Başlangıç konum kartları ilk açılışta çiziliyor'));
check('QA harness checks search input', qa.includes('Semt/turistik yer arama alanı görünür DOM içinde mevcut'));
check('service worker cache is versioned', /CACHE_NAME='itp-v230\\.12\\.\\d+-core'/.test(sw));

console.log(`Static QA: ${pass.length} passed, ${fail.length} failed`);
for (const name of pass) console.log(`PASS  ${name}`);
for (const name of fail) console.error(`FAIL  ${name}`);
if (fail.length) process.exitCode = 1;
