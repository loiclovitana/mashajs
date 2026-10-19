import assert from 'node:assert/strict';
import { test } from 'node:test';
import { animations, frameAt, drawFrame, isBuiltinSprite } from '../dist/lib/sprites.js';

test('every animation starts at zero, advances at its duration, and loops after four frames', () => {
  for (const animation of animations) {
    assert.equal(frameAt(animation.id, -10), 0);
    assert.equal(frameAt(animation.id, 0), 0);
    assert.equal(frameAt(animation.id, animation.duration - 1), 0);
    assert.equal(frameAt(animation.id, animation.duration), 1);
    assert.equal(frameAt(animation.id, animation.duration * 3), 3);
    assert.equal(frameAt(animation.id, animation.duration * 4), 0);
  }
  assert.throws(() => frameAt('unknown', 0), /Unknown animation/);
});

test('drawing crops the requested frame and animation row at the requested output size', () => {
  const calls = [];
  const image = {};
  const context = {
    canvas: { width: 160, height: 160 },
    clearRect: (...args) => calls.push(['clear', ...args]),
    drawImage: (...args) => calls.push(['draw', ...args]),
  };
  drawFrame(context, image, 'sleep', 2);
  assert.deepEqual(calls, [
    ['clear', 0, 0, 160, 160],
    ['draw', image, 384, 1152, 192, 192, 0, 0, 160, 160],
  ]);
});

test('only own sprite keys are accepted as built-in sprites', () => {
  assert.equal(isBuiltinSprite('opale'), true);
  assert.equal(isBuiltinSprite('masha'), true);
  assert.equal(isBuiltinSprite('constructor'), false);
  assert.equal(isBuiltinSprite('toString'), false);
});
