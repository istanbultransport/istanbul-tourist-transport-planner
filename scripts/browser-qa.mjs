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
    start: { id: typeof start!=='undefined'?start?.id:null, lat: typeof start!=='undefined'?start?.lat:null, lng: typeof start!=='undefined'?start?.lng:null },
    target: { id: typeof selectedTarget!=='undefined'?selectedTarget?.id:null, lat: typeof selectedTarget!=='undefined'?selectedTarget?.lat:null, lng: typeof selectedTarget!=='undefined'?selectedTarget?.lng:null },
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
      const hasId = id => typeof places!=='undefined' && Array.isArray(places) && places.some(p => p.id === id);
      if (!hasId(from) || !hasId(to)) return { ok:false,reason:'endpoint missing' };
      let path = route(from,to);
      if (!path) path = minimumRailRoute(from,to,4,null,null);
      if (!path) {
        const candidates = generateRouteCandidates(from,to);
        path = selectBestRoute(candidates)?.path || candidates?.[0]?.path || null;
      }
      if (!Array.isArray(path) || !path.length) return { ok:false,reason:'route missing' };
      const validation = validateRoute(path);
      return { ok:validation.ok,reason:validation.reason,steps:path.length,modes:path.map(s=>s[2]),path:path.map(s=>[s[0],s[1],s[2]]),finalMile:path.some(s=>s[2]==='Son ulaşım'),walk:path.some(s=>s[2]==='Yürüyüş') };
    }, item);
    record('route fixture '+item.id, result.ok === true, result.reason || JSON.stringify(result));
  }
  record('40 route fixtures loaded', cases.routeCases.length === 40, 'count='+cases.routeCases.length);

  const accessAudit = await page.evaluate(() => {
    const gps = typeof staticGpsStationCoordinates === 'function' ? staticGpsStationCoordinates() : [];
    const exits = Object.values(stationExitRegistry || {}).flatMap(x => x.exits || []);
    const fake = [['pendik','pendik','M4 Metro',''],['pendik','pendik','Marmaray','']];
    const real = [['ayrilik','ayrilik','M4 Metro',''],['ayrilik','ayrilik','Marmaray','']];
    return {
      gpsOk: gps.length >= 10 && gps.every(x => Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lng))) && gps.some(x => x.station === 'pendik' && x.mode === 'M4 Metro'),
      exitsOk: exits.length > 0 && exits.every(x => x.no !== undefined && !!x.name),
      transferGuardOk: hasVerifiedTransitTransfers(fake) === false && hasVerifiedTransitTransfers(real) === true,
      falseWalkGuardOk: !Number.isFinite(Number(touristWalkTime('uskudar','anadolu_hisari'))) && !Number.isFinite(Number(lastMileWalkMinutes.anadolu_hisari))
    };
  });
  record('GPS station coordinates have valid values', accessAudit.gpsOk);
  record('station exit registry entries have names and IDs', accessAudit.exitsOk);
  record('unverified same-node transfer is blocked', accessAudit.transferGuardOk);
  record('unverified short walking link is not invented', accessAudit.falseWalkGuardOk);

  // Exercise browser geolocation permission with a deterministic mock near Pendik M4.
  const gpsContext = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'], geolocation: { latitude: 40.88839, longitude: 29.23817, accuracy: 20 } });
  try {
    const gpsPage = await gpsContext.newPage();
    await gpsPage.route('**/GetStations', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await gpsPage.goto('http://127.0.0.1:4173/index.html?qa=gps', { waitUntil: 'domcontentloaded' });
    await gpsPage.locator('#useCurrentLocationBtn').click();
    await gpsPage.waitForFunction(() => (typeof start !== 'undefined' && start?.isCurrentLocation === true) || (document.getElementById('locationStatus')?.textContent || '').includes('15 dakika yürüme'), { timeout: 12000 });
    const gpsState = await gpsPage.evaluate(() => ({ selected: start?.isCurrentLocation === true, lat: currentLocation?.lat, lng: currentLocation?.lng, station: currentLocationStation?.station, status: document.getElementById('locationStatus')?.textContent || '' }));
    record('GPS permission flow accepts browser geolocation and selects current location', gpsState.selected && Math.abs(gpsState.lat - 40.88839) < 0.001 && Math.abs(gpsState.lng - 29.23817) < 0.001, JSON.stringify(gpsState));
  } catch (error) {
    record('GPS permission flow browser smoke test', false, error.message);
  } finally {
    await gpsContext.close();
  }

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

  // Verify service-worker install, core cache population and offline navigation.
  const sw = read('sw.js');
  record('versioned PWA cache includes QA fixtures', sw.includes("itp-v230.12.19-core") && sw.includes('./qa/location-regression-cases.json') && sw.includes('./qa.html'));
  const offlineContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const offlinePage = await offlineContext.newPage();
    await offlinePage.goto('http://127.0.0.1:4173/index.html?qa=offline', { waitUntil: 'domcontentloaded' });
    await offlinePage.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller && reg.active) {
        await new Promise(resolve => {
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
          setTimeout(resolve, 4000);
        });
      }
    });
    await offlinePage.reload({ waitUntil: 'domcontentloaded' });
    await offlinePage.waitForSelector('#list .place[data-id]', { timeout: 10000 });
    const cacheState = await offlinePage.evaluate(async () => ({
      controlled: !!navigator.serviceWorker.controller,
      cache: (await caches.keys()).some(k => k === 'itp-v230.12.19-core'),
      cachedIndex: !!(await (await caches.open('itp-v230.12.19-core')).match('./index.html'))
    }));
    record('PWA service worker controls page and caches app shell', cacheState.controlled && cacheState.cache && cacheState.cachedIndex, JSON.stringify(cacheState));
    await offlineContext.setOffline(true);
    await offlinePage.reload({ waitUntil: 'domcontentloaded' });
    await offlinePage.waitForSelector('#list .place[data-id]', { timeout: 10000 });
    record('PWA app shell renders offline from cache', await offlinePage.locator('#list .place[data-id]').count() > 0);
  } catch (error) {
    record('PWA offline smoke test', false, error.message);
  } finally {
    await offlineContext.close();
  }
} finally {
  await browser.close();
}
console.log(`Browser QA: ${passed.length} passed, ${failures.length} failed`);
for (const name of passed) console.log('PASS '+name);
for (const name of failures) console.error('FAIL '+name);
if (failures.length) process.exit(1);
