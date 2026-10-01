const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGraphReturn, RETURN_IDLE_MS } = require('/tmp/pnet-graph-test/graphReturn.js');
function fixture() {
  let now = 0, next = 0, calls = 0;
  const tasks = new Map();
  const clock = {
    now: () => now,
    set: (callback, delay) => { const id = ++next; tasks.set(id, { callback, due: now + delay }); return id; },
    clear: id => tasks.delete(id),
  };
  const scheduler = createGraphReturn(() => calls++, clock);
  return { scheduler, calls: () => calls, advance(ms) {
    now += ms;
    for (const [id, task] of [...tasks]) if (task.due <= now) { tasks.delete(id); task.callback(); }
  } };
}
test('returns once at 3000ms after the last movement', () => {
  assert.equal(RETURN_IDLE_MS, 3000);
  const f = fixture(); f.scheduler.moved(); f.advance(2999); assert.equal(f.calls(), 0);
  f.advance(1); assert.equal(f.calls(), 1); f.advance(10000); assert.equal(f.calls(), 1);
});
test('held or hovered contact stays put past deadline, leaving then returns', () => {
  const f = fixture(); f.scheduler.hold(true); f.scheduler.moved();
  f.advance(5000); assert.equal(f.calls(), 0);
  f.scheduler.hold(false); f.advance(0); assert.equal(f.calls(), 1);
});
test('leaving before deadline waits only the remaining time', () => {
  const f = fixture(); f.scheduler.hold(true); f.scheduler.moved(); f.advance(1000);
  f.scheduler.hold(false); f.advance(1999); assert.equal(f.calls(), 0);
  f.advance(1); assert.equal(f.calls(), 1);
});
test('hover cancels a pending timer without resetting the movement deadline', () => {
  const f = fixture(); f.scheduler.moved(); f.advance(2000); f.scheduler.hold(true);
  f.advance(3000); assert.equal(f.calls(), 0);
  f.scheduler.hold(false); f.advance(0); assert.equal(f.calls(), 1);
});
test('another movement restarts the deadline; cancel and dispose prevent callbacks', () => {
  const f = fixture(); f.scheduler.moved(); f.advance(2500); f.scheduler.moved();
  f.advance(1000); assert.equal(f.calls(), 0); f.scheduler.cancel(); f.advance(5000);
  assert.equal(f.calls(), 0); f.scheduler.moved(); f.scheduler.dispose(); f.advance(5000);
  assert.equal(f.calls(), 0);
});
