import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('manifest and toolbar reference valid square PNGs at every required size', () => {
  const manifest = JSON.parse(readFileSync('extension/manifest.json', 'utf8'));
  for (const size of [16, 32, 48, 128]) {
    const path = manifest.icons[size];
    assert.equal(manifest.action.default_icon[size], path);
    const png = readFileSync('extension/' + path);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    assert.equal(png[25], 6, 'RGBA transparency');
  }
});
