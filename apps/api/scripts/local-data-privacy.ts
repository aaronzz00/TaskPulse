import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const REQUIRED_LOCAL_DATA_GITIGNORE_PATTERNS = [
  '.local-backups/',
  'apps/api/prisma/dev.db',
  'apps/api/prisma/dev.db-*',
  'Whisper_Schedule_*.xlsx',
] as const;

const SKIPPED_DIRECTORIES = new Set([
  '.git',
  '.local-backups',
  '.next',
  '.turbo',
  'coverage',
  'dist',
  'node_modules',
]);

const FORBIDDEN_SCHEDULE_FILE = /^Whisper_Schedule_.*\.xlsx$/i;

export interface LocalDataPrivacyResult {
  ok: boolean;
  missingGitignorePatterns: string[];
  forbiddenScheduleFiles: string[];
}

export function findMissingGitignorePatterns(gitignoreText: string): string[] {
  const configuredPatterns = new Set(
    gitignoreText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#')),
  );

  return REQUIRED_LOCAL_DATA_GITIGNORE_PATTERNS.filter((pattern) => !configuredPatterns.has(pattern));
}

export function findForbiddenScheduleFiles(rootDir: string): string[] {
  const matches: string[] = [];

  walk(rootDir, '', matches);

  return matches.sort();
}

export function verifyLocalDataPrivacy(rootDir = resolve(__dirname, '../../..')): LocalDataPrivacyResult {
  const gitignorePath = resolve(rootDir, '.gitignore');
  const gitignoreText = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : '';
  const missingGitignorePatterns = findMissingGitignorePatterns(gitignoreText);
  const forbiddenScheduleFiles = findForbiddenScheduleFiles(rootDir);

  return {
    ok: missingGitignorePatterns.length === 0 && forbiddenScheduleFiles.length === 0,
    missingGitignorePatterns,
    forbiddenScheduleFiles,
  };
}

function walk(rootDir: string, relativeDir: string, matches: string[]): void {
  const absoluteDir = resolve(rootDir, relativeDir);

  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        walk(rootDir, relativePath, matches);
      }
      continue;
    }

    if (entry.isFile() && FORBIDDEN_SCHEDULE_FILE.test(entry.name)) {
      matches.push(relativePath);
    }
  }
}

if (require.main === module) {
  const result = verifyLocalDataPrivacy();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}
