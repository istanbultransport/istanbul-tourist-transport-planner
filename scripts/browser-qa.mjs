import { chromium } from 'playwright';
import fs from 'node:fs';

const failures = [];
const passed = [];
const record = (name, ok, detail = '') => (ok ? passed : failures).push(ok ? name : `${name}: ${detail}`);
const read = p => fs.readFileSync(p, 'utf8');
const cases = JSON.parse(read('qa/location-regression-cases.json'));
const appHtml = read('index.html');
const htmlBuild = (appHtml.match(/<meta name="build-id" content="([^"]+)"/) || [])[1] || '';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.route('**/sw.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* service worker disabled in deterministic test */' }));
  await page.goto('http://127.0.0.1:4173/index.html?qa=ci', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#list .place[data-id]', { timeout: 15000 });
  record('mobile viewport renders place cards', await page.locator('#list .place[data-id]').count() > 0);
  record('build marker present in browser', await page.locator('meta[name="build-id"]').getAttribute('content') === htmlBuild);

  for (const id of ['four_seasons_sultanahmet','karakoy_lokantasi','ciya_sofrasi']) {
    const count = await page.locator('#list .place[data-id="'+id+'"]').count();
    record('catalogue renders '+id, count === 1, 'count='+count);
  }
  record('Faros unverified business excluded', await page.locator('#list .place[data-id="faros_karakoy"]').count() === 0);

  const filter = page.locator('.filter[data-filter="Anadolu Yakası"]');
  await filter.click();
  let sides = await page.locator('#list .place[data-id]').evaluateAll(nodes => nodes.map(n => n.querySelector('small')?.textContent || ''));
  record('Anatolia filter updates rendered cards', sides.length > 0 && sides.every(s => s.includes('Anadolu Yakası')));
  await page.locator('.filter[data-filter="Avrupa Yakası"]').click();
  sides = await page.locator('#list .place[data-id]').evaluateAll(nodes => nodes.map(n => n.querySelector('small')?.textContent || ''));
  record('Europe filter updates rendered cards', sides.length > 0 && sides.every(s => s.includes('Avrupa Yakası')));
  await page.locator('.filter[data-filter="Tümü"]').click();

  const search = page.locator('#startPlaceSearch');
  await search.fill('Karaköy Lokantası');
  const searchCount = await page.locator('#list .place[data-id]').count();
  record('business search filters by exact name', searchCount === 1 && await page.locator('#list .place[data-id]').getAttribute('data-id') === 'karakoy_lokantasi');
  await page.locator('#startPlaceSearch').fill('');

  // Select canonical origin/target through the UI and assert the JS state retained IDs/coordinates.
  await page.locator('#list .place[data-id="kadikoy_carsi"]').click();
  await page.locator('#list .place[data-id="ciya_sofrasi"]').click();
  const selected = await page.evaluate(() => ({
    start: { id: window.start?.id, lat: window.start?.lat, lng: window.start?.lng },
    target: { id: window.selectedTarget?.id, lat: window.selectedTarget?.lat, lng: window.selectedTarget?.lng },
    routeVisible: getComputedStyle(document.getElementById('route')).display !== 'none'
  }));
  record('origin ID and coordinates preserved through UI selection', selected.start.id === 'kadikoy_carsi' && Number.isFinite(selected.start.lat) && Number.isFinite(selected.start.lng), JSON.stringify(selected.start));
  record('target ID and coordinates preserved through UI selection', selected.target.id === 'ciya_sofrasi' && Number.isFinite(selected.target.lat) && Number.isFinite(selected.target.lng), JSON.stringify(selected.target));
  record('route output shown after destination click', selected.routeVisible);
  await page.screenshot({ path: 'browser-qa-mobile.png', fullPage: true });
  record('no uncaught browser console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));

  // Route-engine fixture regression, run against the actual in-page data/graph.
  for (const item of cases.routeCases) {
    const result = await page.evaluate(({ from, to }) => {
      const hasId = id => Array.isArray(window.places) && window.places.some(p => p.id === id);
      if (!hasId(from) || !hasId(to)) return { ok:false,reason:'endpoint missing' };
      let path = window.route(from,to);
      if (!path) path = window.minimumRailRoute(from,to,4,null,null);
      if (!path) {
        const candidates = window.generateRouteCandidates(from,to);
        path = window.selectBestRoute(candidates)?.path || candidates?.[0]?.path || null;
      }
      if (!Array.isArray(path) || !path.length) return { ok:false,reason:'route missing' };
      const validation = window.validateRoute(path);
      return { ok:validation.ok,reason:validation.reason,steps:path.length,modes:path.map(s=>s[2]),finalMile:path.some(s=>s[2]==='Son ulaşım'),walk:path.some(s=>s[2]==='Yürüyüş') };
    }, item);
    record('route fixture '+item.id, result.ok === true, result.reason || JSON.stringify(result));
  }
  record('40 route fixtures loaded', cases.routeCases.length === 40, 'count='+cases.routeCases.length);

  // Panels/tabs should remain clickable on a narrow viewport.
  for (const [id,panelId,label] of [
    ['cityExploreTab','cityExplorePanel','city exploration panel'],
    ['ticketHelpTab','ticketHelpPanel','ticket help panel']
  ]) {
    const button = page.locator('#'+id), panel = page.locator('#'+panelId);
    await button.click();
    const opened = await panel.evaluate(el => el.classList.contains('open'));
    await button.click();
    record(label+' opens from mobile UI', opened);
  }

  // Service-worker/cache syntax and configuration can be checked here; offline fetch behavior is validated in a separate SW browser context.
  const sw = read('sw.js');
  record('versioned PWA cache includes QA fixtures', /itp-v230\\.12\\.18-core/.test(sw) && sw.includes('./qa/location-regression-cases.json') && sw.includes('./qa.html'));
} finally {
  await browser.close();
}
console.log(`Browser QA: ${passed.length} passed, ${failures.length} failed`);
for (const name of passed) console.log('PASS '+name);
for (const name of failures) console.error('FAIL '+name);
if (failures.length) process.exit(1);
