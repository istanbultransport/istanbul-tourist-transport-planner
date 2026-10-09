import { chromium } from 'playwright';
import fs from 'node:fs';

const liveUrl = process.env.LIVE_APP_URL || 'https://istanbultransport.github.io/istanbul-tourist-transport-planner/';
const expectedHtml = fs.readFileSync('index.html', 'utf8');
const expectedBuild = (expectedHtml.match(/<meta name="build-id" content="([^"]+)"/) || [])[1] || '';
const expectedCache = (fs.readFileSync('sw.js', 'utf8').match(/const CACHE_NAME='([^']+)'/) || [])[1] || '';
const passed = [];
const failures = [];
const record = (name, ok, detail = '') => (ok ? passed : failures).push(ok ? name : name + ': ' + detail);

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  let response = null;
  let actualBuild = '';
  let lastError = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      response = await page.goto(liveUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#list .place[data-id]', { timeout: 12000 });
      actualBuild = await page.locator('meta[name="build-id"]').getAttribute('content') || '';
      if (response?.ok() && actualBuild === expectedBuild) break;
      lastError = 'HTTP ' + response?.status() + ', build=' + actualBuild + ', expected=' + expectedBuild;
    } catch (error) {
      lastError = error.message;
    }
    if (attempt < 4) {
      await page.waitForTimeout(15000);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    }
  }

  record('live site responds successfully', !!response?.ok(), 'HTTP ' + response?.status() + ' ' + lastError);
  record('live build matches current main build', actualBuild === expectedBuild, 'live=' + actualBuild + ' expected=' + expectedBuild);
  const initialCardCount = await page.locator('#list .place[data-id]').count().catch(() => 0);
  record('live app renders place cards', initialCardCount > 0, 'count=' + initialCardCount);
  console.log('Live smoke URL: ' + liveUrl);
  console.log('Expected build: ' + expectedBuild + '; live build: ' + actualBuild);
  if (!response?.ok() || initialCardCount === 0) {
    console.error('Live site unavailable or did not render cards: HTTP ' + response?.status() + '; ' + lastError);
    throw new Error('Live smoke stopped: deployed app could not be loaded.');
  }
  for (const id of ['four_seasons_sultanahmet','karakoy_lokantasi','ciya_sofrasi']) {
    const count = await page.locator('#list .place[data-id="' + id + '"]').count();
    record('live catalogue includes ' + id, count === 1, 'count=' + count);
  }
  record('live catalogue excludes unverified Faros record', await page.locator('#list .place[data-id="faros_karakoy"]').count() === 0);

  await page.locator('.filter[data-filter="Anadolu Yakası"]').click();
  let sides = await page.locator('#list .place[data-id]').evaluateAll(nodes => nodes.map(n => n.querySelector('small')?.textContent || ''));
  record('live Anatolia filter works', sides.length > 0 && sides.every(s => s.includes('Anadolu Yakası')));
  await page.locator('.filter[data-filter="Avrupa Yakası"]').click();
  sides = await page.locator('#list .place[data-id]').evaluateAll(nodes => nodes.map(n => n.querySelector('small')?.textContent || ''));
  record('live Europe filter works', sides.length > 0 && sides.every(s => s.includes('Avrupa Yakası')));
  await page.locator('.filter[data-filter="Tümü"]').click();

  await page.locator('#startPlaceSearch').fill('Karaköy Lokantası');
  record('live business search works', await page.locator('#list .place[data-id]').count() === 1 &&
    await page.locator('#list .place[data-id]').getAttribute('data-id') === 'karakoy_lokantasi');
  await page.locator('#startPlaceSearch').fill('');

  await page.evaluate(() => newRoute());
  await page.locator('#startPlaceSearch').fill('Kadıköy Çarşı');
  await page.locator('#list .place[data-id="kadikoy_carsi"]').click();
  await page.locator('#targetPlaceSearch').fill('Çiya Sofrası');
  await page.locator('#list .place[data-id="ciya_sofrasi"]').click();
  await page.waitForFunction(() => selectedTarget?.id === 'ciya_sofrasi' &&
    getComputedStyle(document.getElementById('route')).display !== 'none', null, { timeout: 20000 });
  const routeState = await page.evaluate(() => ({
    from: start?.id || null, to: selectedTarget?.id || null,
    routeText: document.getElementById('route')?.innerText?.trim() || ''
  }));
  record('live route selection preserves endpoint IDs and shows route',
    routeState.from === 'kadikoy_carsi' && routeState.to === 'ciya_sofrasi' && routeState.routeText.length > 0,
    JSON.stringify(routeState));

  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false, controlled: false, cacheNames: [] };
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller && reg.active) {
      await new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
        setTimeout(resolve, 5000);
      });
    }
    return { supported: true, controlled: !!navigator.serviceWorker.controller, cacheNames: await caches.keys() };
  });
  record('live service worker controls the app', swState.supported && swState.controlled, JSON.stringify(swState));
  record('live PWA cache version matches main', swState.cacheNames.includes(expectedCache),
    'expected=' + expectedCache + ' actual=' + swState.cacheNames.join(','));

  if (swState.controlled) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('#list .place[data-id]', { timeout: 10000 });
    await context.setOffline(true);
    let offlineOk = false;
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForSelector('#list .place[data-id]', { timeout: 10000 });
      offlineOk = await page.locator('#list .place[data-id]').count() > 0;
    } catch {}
    record('live app shell opens offline from PWA cache', offlineOk);
  } else {
    record('live app shell opens offline from PWA cache', false, 'service worker did not take control');
  }

  record('no uncaught JavaScript errors on live site', pageErrors.length === 0, pageErrors.slice(0, 8).join(' | '));
  record('no JavaScript console errors on live site', consoleErrors.length === 0, consoleErrors.slice(0, 8).join(' | '));
  console.log('Live smoke QA: ' + passed.length + ' passed, ' + failures.length + ' failed');
  for (const name of passed) console.log('PASS ' + name);
  for (const name of failures) console.error('FAIL ' + name);
  await page.screenshot({ path: 'live-smoke-mobile.png', fullPage: true }).catch(() => {});
  await context.close();
} finally {
  await browser.close();
}
if (failures.length) process.exit(1);
