const { test } = require('node:test');
const assert = require('node:assert/strict');
const { separateDisks, interpolate, intersects, boxHitsDisk, depthForCircle } = require('/tmp/pnet-graph-test/graphGeometry.js');
test('layer order is inner to outer, independent of selection', () => {
  assert.ok(depthForCircle('INNER') < depthForCircle('MIDDLE'));
  assert.ok(depthForCircle('MIDDLE') < depthForCircle('OUTER'));
});
test('overlapping disks separate without moving the fixed ego/drag target', () => {
  const input = [{ id: 'self', x: 0, y: 0, radius: 50, fixed: true },
    { id: 'a', x: 30, y: 0, radius: 16 }, { id: 'b', x: 40, y: 0, radius: 16 }];
  const result = separateDisks(input, 80);
  assert.deepEqual(result[0], input[0]);
  assert.equal(input[1].x, 30);
  for (let i = 0; i < result.length; i++) for (let j = i+1; j<result.length; j++) {
    const a=result[i], b=result[j]; assert.ok(Math.hypot(a.x-b.x,a.y-b.y) >= a.radius+b.radius+8.99);
  }
  assert.deepEqual(separateDisks(input,80),result);
});
test('coincident nodes remain finite, deterministic and separable', () => {
  const input = Array.from({length:12},(_,i)=>({id:String(i),x:0,y:0,radius:10}));
  const result=separateDisks(input,100);
  for (const p of result) assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
  for(let i=0;i<result.length;i++)for(let j=i+1;j<result.length;j++)assert.ok(Math.hypot(result[i].x-result[j].x,result[i].y-result[j].y)>=28.9);
});
test('return interpolation has exact endpoints and cannot overshoot', () => {
  const from={x:-7,y:15},to={x:2,y:3};
  assert.deepEqual(interpolate(from,to,0),from);assert.deepEqual(interpolate(from,to,1),to);
  assert.deepEqual(interpolate(from,to,2),to);
  for(let i=0;i<=20;i++){const p=interpolate(from,to,i/20);assert.ok(p.x>=-7&&p.x<=2&&p.y>=3&&p.y<=15);}
});
test('label geometry detects label/label and label/disk collisions', () => {
  const box={x:10,y:10,width:80,height:22};
  assert.equal(intersects(box,{x:60,y:20,width:40,height:20}),true);
  assert.equal(intersects(box,{x:200,y:20,width:40,height:20}),false);
  assert.equal(boxHitsDisk(box,{id:'a',x:14,y:20,radius:5}),true);
  assert.equal(boxHitsDisk(box,{id:'a',x:200,y:20,radius:5}),false);
});
