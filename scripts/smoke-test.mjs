import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const config = readFileSync(new URL('../config.js', import.meta.url), 'utf8');

assert.match(html, /<canvas[^>]+id=["']world["']/i, 'game canvas must exist');
assert.match(html, /id=["']play["']/i, 'start button must exist');
assert.match(html, /id=["']login["']/i, 'login button must exist');
assert.match(config, /SUPABASE_URL:\s*["']https:\/\//, 'Supabase URL must be configured');
assert.match(config, /SUPABASE_ANON_KEY:\s*["'][^"']{20,}["']/, 'public anon key must be configured');

const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]));
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
assert.ok(inlineScripts.length, 'at least one inline application script is required');

for (const [index, match] of inlineScripts.entries()) {
  const source = match[1];
  // Parse only: do not execute browser code in Node.
  new Function(source);
  for (const [, id] of source.matchAll(/\$\(['"]([^'"]+)['"]\)/g)) {
    assert.ok(ids.has(id), `script ${index + 1} references missing DOM id: ${id}`);
  }
}

console.log(`Static smoke checks passed: ${inlineScripts.length} script(s), ${ids.size} DOM ids.`);
