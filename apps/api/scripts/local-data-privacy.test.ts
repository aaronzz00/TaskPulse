import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  REQUIRED_LOCAL_DATA_GITIGNORE_PATTERNS,
  findForbiddenScheduleFiles,
  findMissingGitignorePatterns,
  verifyLocalDataPrivacy,
} from './local-data-privacy';

test('findMissingGitignorePatterns requires the local database, backup, and Whisper source workbook patterns', () => {
  const gitignore = [
    '.local-backups/',
    'apps/api/prisma/dev.db',
  ].join('\n');

  assert.deepEqual(findMissingGitignorePatterns(gitignore), [
    'apps/api/prisma/dev.db-*',
    'Whisper_Schedule_*.xlsx',
  ]);
  assert.equal(REQUIRED_LOCAL_DATA_GITIGNORE_PATTERNS.includes('Whisper_Schedule_*.xlsx'), true);
});

test('findForbiddenScheduleFiles reports Whisper source workbooks while skipping local backup and build folders', () => {
  const root = mkdtempSync(join(tmpdir(), 'taskpulse-privacy-'));
  try {
    writeFileSync(join(root, 'Whisper_Schedule_20260508.xlsx'), 'private workbook', 'utf8');
    mkdirSync(join(root, '.local-backups'), { recursive: true });
    writeFileSync(join(root, '.local-backups', 'Whisper_Schedule_20260508.xlsx'), 'backup', 'utf8');
    mkdirSync(join(root, 'node_modules'), { recursive: true });
    writeFileSync(join(root, 'node_modules', 'Whisper_Schedule_20260508.xlsx'), 'dependency', 'utf8');

    assert.deepEqual(findForbiddenScheduleFiles(root), ['Whisper_Schedule_20260508.xlsx']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('verifyLocalDataPrivacy combines gitignore and workspace source-file checks', () => {
  const root = mkdtempSync(join(tmpdir(), 'taskpulse-privacy-'));
  try {
    writeFileSync(join(root, '.gitignore'), [
      '.local-backups/',
      'apps/api/prisma/dev.db',
      'apps/api/prisma/dev.db-*',
      'Whisper_Schedule_*.xlsx',
    ].join('\n'), 'utf8');

    assert.deepEqual(verifyLocalDataPrivacy(root), {
      ok: true,
      missingGitignorePatterns: [],
      forbiddenScheduleFiles: [],
    });

    writeFileSync(join(root, 'Whisper_Schedule_20260508.xlsx'), 'private workbook', 'utf8');

    assert.deepEqual(verifyLocalDataPrivacy(root), {
      ok: false,
      missingGitignorePatterns: [],
      forbiddenScheduleFiles: ['Whisper_Schedule_20260508.xlsx'],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
