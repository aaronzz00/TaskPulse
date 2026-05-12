import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const dirnamePath = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dirnamePath, 'TaskDrawer.tsx'), 'utf8');

test('drawer footer closes immediately persisted edits instead of promising save semantics', () => {
  assert.doesNotMatch(source, /Save Changes/);
  assert.match(source, />\s*Close\s*</);
});

test('title edits are buffered locally and committed explicitly', () => {
  assert.match(source, /titleDraft/);
  assert.match(source, /setTitleDraft\(e\.target\.value\)/);
  assert.match(source, /commitTitle/);
  assert.match(source, /onBlur=\{commitTitle\}/);
  assert.match(source, /e\.key === 'Enter'/);
  assert.doesNotMatch(source, /onChange=\{\(e\) => updateTask\(task\.id, \{ title: e\.target\.value \}\)\}/);
});

test('progress edits are buffered locally and committed on release or blur', () => {
  assert.match(source, /progressDraft/);
  assert.match(source, /setProgressDraft\(parseInt\(e\.target\.value\)/);
  assert.match(source, /commitProgress/);
  assert.match(source, /commitProgress\(parseInt\(e\.currentTarget\.value\)\)/);
  assert.match(source, /onPointerUp=\{\(e\) => commitProgress\(parseInt\(e\.currentTarget\.value\)\)\}/);
  assert.match(source, /onKeyUp=\{\(e\) => commitProgress\(parseInt\(e\.currentTarget\.value\)\)\}/);
  assert.match(source, /onBlur=\{\(e\) => commitProgress\(parseInt\(e\.currentTarget\.value\)\)\}/);
  assert.doesNotMatch(source, /onChange=\{\(e\) => updateTask\(task\.id, \{ progress: parseInt\(e\.target\.value\) \}\)\}/);
});

test('notes edits are buffered locally and committed on blur', () => {
  assert.match(source, /notesDraft/);
  assert.match(source, /setNotesDraft\(e\.target\.value\)/);
  assert.match(source, /commitNotes/);
  assert.match(source, /onBlur=\{commitNotes\}/);
  assert.match(source, /description: notesDraft/);
});

test('error banner renders store error and dismiss action', () => {
  const errorBannerSource = readFileSync(resolve(dirnamePath, 'ErrorBanner.tsx'), 'utf8');

  assert.match(errorBannerSource, /const \{ error, clearError \} = useStore\(\)/);
  assert.match(errorBannerSource, /role="alert"/);
  assert.match(errorBannerSource, /\{error\}/);
  assert.match(errorBannerSource, /onClick=\{clearError\}/);
  assert.match(errorBannerSource, /aria-label="Dismiss error"/);
});
