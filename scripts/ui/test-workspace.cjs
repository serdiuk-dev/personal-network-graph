// Run against a local WEB server only. Every API response below is synthetic.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PNET_PLAYWRIGHT || 'playwright');
const base = process.env.PNET_TEST_URL || 'http://127.0.0.1:4173';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local test server required');
const people = ['Alex', 'Robin', 'Sam', 'Taylor', 'Morgan', 'Casey'].map((firstName, i) => ({
  id: `synthetic-${i}`, firstName, lastName: 'Example', label: `${firstName} Example`, nickname: null,
  company: null, position: null, city: null, country: null, email: null, phone: null, notes: null,
  primaryTag: null, importance: i % 5 + 1, networkCircle: ['INNER', 'MIDDLE', 'OUTER'][i % 3],
  categories: [], interests: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
}));
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PNET_CHROMIUM || undefined,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [], requests = [], writes = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__draws = [];
      const fill = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
        window.__draws.push({ text, font: this.font, color: this.fillStyle });
        if (window.__draws.length > 400) window.__draws.shift();
        return fill.call(this, text, ...args);
      };
    });
    if (process.env.PNET_TEST_DIST) {
      const fs = require('node:fs/promises'), path = require('node:path');
      const root = path.resolve(process.env.PNET_TEST_DIST);
      await page.route(`${base}/**`, async route => {
        const pathname = new URL(route.request().url()).pathname;
        const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        assert(file.startsWith(root + path.sep));
        try { return await route.fulfill({ body: await fs.readFile(file), contentType:
          file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' }); }
        catch { return route.fulfill({ status: 404, body: '' }); }
      });
    }
    await page.route('**/api/v1/**', async route => {
      const req = route.request(), path = new URL(req.url()).pathname;
      requests.push(path);
      if (req.method() !== 'GET') writes.push(path);
      let body;
      if (path.endsWith('/auth/session')) body = { csrf: 'a'.repeat(64) };
      else if (path.endsWith('/graph')) body = { nodes: people, edges: [], meta: { nodeCount: people.length, edgeCount: 0 } };
      else if (path.endsWith('/analytics/network')) body = { nodes: [], meta: { nodeCount: 6, edgeCount: 0, density: 0, communityCount: 0, modularity: 0 }, rankings: { connectors: [], strongestNetworks: [], bridges: [] } };
      else if (path.endsWith('/graph-styles')) body = {};
      else if (path.endsWith('/people')) body = people;
      else if (/\/(categories|interests|relationships)$/.test(path)) body = [];
      else return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(base);
    await page.waitForFunction(() => window.__draws.some(d => d.text.includes('Example')));
    assert.equal(await page.locator('.pnet-header input').count(), 0);
    assert.equal(await page.locator('.pnet-header').getByText('Personal Network', { exact: true }).count(), 0);
    async function panel(group, name) {
      await page.getByRole('button', { name: new RegExp(`^${group}`) }).first().click();
      await page.getByRole('button', { name, exact: true }).click();
      await page.getByRole('heading', { name, exact: true }).waitFor();
    }
    // Layout stays one row and never overflows on desktop/tablet widths.
    for (const width of [1440, 1024, 800, 761]) {
      await page.setViewportSize({ width, height: 900 });
      const rects = await page.locator('.pnet-header').evaluate(el => ({
        nav: el.querySelector('nav').getBoundingClientRect().toJSON(),
        actions: el.querySelector('.pnet-header-actions').getBoundingClientRect().toJSON(),
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      assert(Math.abs(rects.nav.y + rects.nav.height / 2 - rects.actions.y - rects.actions.height / 2) < 2);
      assert(rects.nav.right <= rects.actions.x, `Header overlap at ${width}`);
      assert(!rects.overflow, `Page overflow at ${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const fetches = requests.filter(p => p.endsWith('/graph')).length;
    await page.evaluate(() => { window.__originalCanvas = document.querySelector('.pnet-graph-canvas canvas'); window.__draws = []; });
    await page.getByLabel('Main labels', { exact: true }).fill('#123456');
    await page.getByRole('slider').fill('20');
    await page.waitForFunction(() => window.__draws.some(d => d.text.includes('Example') && d.color === '#123456' && d.font.includes('20px')));
    await page.getByRole('button', { name: 'Dark theme', exact: true }).click();
    assert.equal(await page.getByLabel('Main labels', { exact: true }).inputValue(), '#eee4f2');
    await page.getByRole('button', { name: 'Light theme', exact: true }).click();
    assert.equal(await page.getByRole('slider').inputValue(), '20');
    await page.getByRole('button', { name: 'Hide right panel', exact: true }).click();
    await page.getByRole('button', { name: 'Show right panel', exact: true }).click();
    assert(await page.evaluate(() => window.__originalCanvas === document.querySelector('.pnet-graph-canvas canvas')));
    assert.equal(requests.filter(p => p.endsWith('/graph')).length, fetches);
    // Graph styles update rings before any save request and revert when discarded.
    await panel('View', 'Circles & connections');
    await page.locator('.pnet-panel-scroll input[type=color]').first().fill('#ee3311');
    await page.waitForFunction(() => [...document.querySelectorAll('.pnet-graph-canvas div')].some(el => el.style.border.includes('238, 51, 17')));
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '+ Contact', exact: true }).click();
    await page.getByPlaceholder('First name *', { exact: true }).fill('DraftOnly');
    await page.waitForFunction(() => window.__draws.some(d => d.text.includes('DraftOnly')));
    assert.equal(writes.length, 0, 'Preview must not write to the API');
    assert(!requests.some(p => p.includes('__pnet_contact_draft__')), 'Draft must not request private media');
    assert(!(await page.evaluate(() => Object.values(localStorage).join(' '))).includes('DraftOnly'));
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    assert.equal(await page.getByPlaceholder('First name *', { exact: true }).inputValue(), 'DraftOnly');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    assert.equal(await page.locator('.pnet-draft-badge').count(), 0);
    assert.equal(await page.locator('.pnet-graph-controls').count(), 1);
    await panel('View', 'Graph appearance');
    await page.getByRole('button', { name: 'Dark theme', exact: true }).click();
    await page.screenshot({ path: '/tmp/pnet-v044-dark.png' });
    await page.getByRole('button', { name: 'Light theme', exact: true }).click();
    await page.screenshot({ path: '/tmp/pnet-v044-light.png' });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
        console.log(await page.evaluate(() => [...document.querySelectorAll('.pnet-header *')].map(el => ({ tag: el.tagName, text: el.textContent, rect: el.getBoundingClientRect().toJSON() })).filter(item => item.rect.right > innerWidth)));
        await page.screenshot({ path: '/tmp/pnet-mobile-overflow.png' });
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Mobile overflow at ${width}`);
      const graph = await page.locator('.pnet-graph-canvas').boundingBox();
      assert(graph.height > 300);
      await page.getByRole('button', { name: 'Close right panel', exact: true }).click();
      await page.getByRole('button', { name: 'Filters', exact: true }).click();
      assert(await page.locator('.pnet-graph-controls').isVisible());
    }
    await page.screenshot({ path: '/tmp/pnet-v044-mobile.png' });
    // Theme preferences survive reload; malformed browser preferences fall back safely.
    await page.reload();
    await page.getByRole('slider').waitFor();
    assert.equal(await page.getByRole('slider').inputValue(), '20');
    await page.evaluate(() => localStorage.setItem('pnet-appearance-v1-light', '{invalid'));
    await page.reload();
    await page.getByRole('slider').waitFor();
    assert.equal(await page.getByRole('slider').inputValue(), '14');
    assert.deepEqual(errors, []);
    console.log('WORKSPACE_OK: responsive header, themes, live canvas styling, draft privacy, discard guard, panel lifecycle');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
