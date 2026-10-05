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

    await page.getByRole('button', { name: '+ Contact', exact: true }).click();
    await page.locator('.pnet-contact-card').first().waitFor();
    for (const width of [1440, 800, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ['Light theme', 'Dark theme']) {
        await page.getByRole('button', { name: theme, exact: true }).click();
        assert.equal(await page.locator('.pnet-contact-card').count(), 6);
        assert.equal(await page.locator('.pnet-contact-card').first().getByRole('button').count(), 6);
        const geometry = await page.locator('.pnet-contact-card').first().evaluate(el => {
          el.querySelector('h3').textContent = 'SyntheticLongName'.repeat(12);
          el.querySelector('dd').textContent = 'SyntheticLongCompany'.repeat(12);
          const name = el.querySelector('h3').getBoundingClientRect();
          const actions = el.querySelector('.pnet-contact-actions').getBoundingClientRect();
          const pane = el.closest('.pnet-panel-scroll');
          return { fits: pane.scrollWidth <= pane.clientWidth, below: actions.top >= name.bottom,
            buttons: [...el.querySelectorAll('button')].every(b => b.getBoundingClientRect().right <= pane.getBoundingClientRect().right) };
        });
        assert(geometry.fits && geometry.below && geometry.buttons, JSON.stringify({width,theme,geometry}));
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const first = page.locator('.pnet-contact-card').first();
    await first.getByRole('button', { name: 'Edit', exact: true }).click();
    assert.equal(await page.getByPlaceholder('First name *', { exact: true }).inputValue(), 'Alex');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await first.scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/tmp/pnet-contact-cards.png' });
    assert.deepEqual(errors, []);
    assert.equal(writes.length, 0);
    console.log('CONTACT_CARDS_OK: no horizontal scroll, six actions below name, long text wraps, edit works, light/dark at 1440/800/390/320');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
