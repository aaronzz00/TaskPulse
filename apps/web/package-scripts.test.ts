import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  scripts: Record<string, string>;
};

test('web direct local scripts build shared contracts before using the workspace package', () => {
  for (const scriptName of ['dev', 'build', 'test']) {
    assert.match(
      packageJson.scripts[scriptName] ?? '',
      /tsc -p \.\.\/\.\.\/packages\/contracts\/tsconfig\.json/,
      `${scriptName} should build @taskpulse/contracts first`,
    );
    assert.doesNotMatch(
      packageJson.scripts[scriptName] ?? '',
      /pnpm --filter/,
      `${scriptName} should not recursively invoke pnpm from a Turbo child task`,
    );
  }
});
