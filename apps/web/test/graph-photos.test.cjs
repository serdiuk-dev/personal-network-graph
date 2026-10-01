const { test } = require('node:test');
const assert = require('node:assert/strict');
global.BroadcastChannel = undefined;
const { createGraphPhotos, drawGraphPhotos } = require('/tmp/pnet-graph-photo-test/graph/graphPhotos.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const bitmap = () => ({ width: 128, height: 64, closed: 0, close() { this.closed++; } });
test('deduplicates requests, limits concurrency and retains ordinary nodes on 404', async () => {
  const pending = [], calls = [];
  const cache = createGraphPhotos(() => {}, {
    fetch: path => { calls.push(path); return new Promise(resolve => pending.push(resolve)); },
    decode: async () => bitmap(), onExpired: () => () => {},
  });
  cache.request(['a', 'b', 'c', 'd', 'e', 'a']);
  assert.equal(calls.length, 4);
  pending.shift()(new Response('', { status: 404 })); await tick();
  assert.equal(calls.length, 5);
  while (pending.length) pending.shift()(new Response('photo'));
  await tick(); assert.equal(cache.images.size, 4);
  cache.request(['a', 'b']); assert.equal(calls.length, 5);
  const loaded = [...cache.images.values()]; cache.dispose();
  assert.ok(loaded.every(image => image.closed === 1));
});
test('logout aborts requests and closes cached and late images', async () => {
  let expire, signal, finishDecode;
  let calls = 0, unsubscribed = 0;
  const early = bitmap(), late = bitmap();
  const cache = createGraphPhotos(() => {}, {
    fetch: async (path, init) => { calls++; signal = init.signal; return new Response('image'); },
    decode: async () => calls === 1 ? early : new Promise(resolve => { finishDecode = resolve; }),
    onExpired: callback => { expire = callback; return () => unsubscribed++; },
  });
  cache.request(['one']); await tick(); assert.equal(cache.images.size, 1);
  cache.request(['two']); await tick(); expire();
  assert.ok(signal.aborted); assert.equal(early.closed, 1);
  finishDecode(late); await tick();
  assert.equal(late.closed, 1); assert.equal(cache.images.size, 0);
  cache.request(['three']); assert.equal(calls, 2);
  cache.dispose(); assert.equal(unsubscribed, 1);
});
test('decoding failure leaves the node usable and advances the queue', async () => {
  let calls = 0;
  const cache = createGraphPhotos(() => {}, {
    fetch: async () => { calls++; return new Response('bad'); },
    decode: async () => { throw new Error('unsupported'); }, onExpired: () => () => {},
  });
  cache.request(['1', '2', '3', '4', '5']); await tick();
  assert.equal(calls, 5); assert.equal(cache.images.size, 0); cache.dispose();
});
test('photo disks respect depth, circular clipping, central crop and selection fading', () => {
  const events = [], image = bitmap();
  const context = {
    save() {}, restore() {}, beginPath() {},
    arc(...args) { events.push(['arc', ...args]); },
    fill() { events.push(['fill', this.fillStyle]); },
    clip() { events.push(['clip']); },
    drawImage(...args) { events.push(['image', this.globalAlpha, ...args.slice(1)]); },
  };
  const nodes = [
    { id: 'near', x: 20, y: 20, radius: 10, data: { zIndex: 2, color: 'blue', label: 'Near' } },
    { id: 'far', x: 15, y: 15, radius: 10, data: { zIndex: 1, color: 'red', label: 'Far' } },
  ];
  drawGraphPhotos(context, nodes, new Map([['far', image]]));
  assert.deepEqual(events.filter(e => e[0] === 'fill'), [['fill', 'red'], ['fill', 'blue']]);
  const drawn = events.find(e => e[0] === 'image');
  assert.deepEqual(drawn, ['image', 1, 32, 0, 64, 64, 6.5, 6.5, 17, 17]);
  assert.ok(events.findIndex(e => e[0] === 'clip') < events.indexOf(drawn));
  assert.ok(events.indexOf(drawn) < events.findIndex(e => e[1] === 'blue'));
  nodes[1].data.label = ''; events.length = 0;
  drawGraphPhotos(context, nodes, new Map([['far', image]]));
  assert.equal(events.find(e => e[0] === 'image')[1], 0.18);
});
