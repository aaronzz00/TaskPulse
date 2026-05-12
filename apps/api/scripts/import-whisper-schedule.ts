import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const DEFAULT_SHEET = 'Whisper_WIP';
const PROJECT_ID = 'whisper-20260508';
const PROJECT_NAME = 'Whisper';
const REPORT_PATH = resolve(__dirname, '../../../.local-backups/whisper-import-report.json');
const DAY_MS = 24 * 60 * 60 * 1000;

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface ParsedPredecessor {
  sourceRowNumber: number;
  type: DependencyType;
  lag: number;
}

export interface ParsedScheduleRow {
  id: string;
  rowNumber: number;
  title: string;
  indent: number;
  startIso: string | null;
  endIso: string | null;
  predecessorText: string;
  predecessors: ParsedPredecessor[];
  parentId?: string | null;
}

export interface MissingDateFix {
  rowNumber: number;
  taskId: string;
  title: string;
  startIso: string;
  endIso: string;
  rule: string;
}

interface WhisperXmlParts {
  sharedStringsXml: string;
  stylesXml: string;
  sheetXml: string;
}

interface DbTaskDateRow {
  id: string;
  parentId: string | null;
  plannedStart: string | number | Date;
  plannedStartType: string;
  plannedEnd: string | number | Date;
  plannedEndType: string;
}

interface DbDependencyRow {
  sourceTaskId: string;
  targetTaskId: string;
  type: DependencyType;
  lag: number;
}

interface XlsxCell {
  ref: string;
  col: string;
  type: string | null;
  style: number | null;
  value: string | null;
}

interface XlsxRow {
  rowNumber: number;
  cells: Map<string, XlsxCell>;
}

export function parsePredecessors(value: string | number | null | undefined): ParsedPredecessor[] {
  if (value === null || value === undefined || String(value).trim() === '') {
    return [];
  }

  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(\d+)\s*(FS|SS|FF|SF)?\s*(?:\+(\d+)\s*([dw]))?$/i);
      if (!match) {
        throw new Error(`Unsupported predecessor expression: ${part}`);
      }

      const amount = match[3] ? Number(match[3]) : 0;
      const unit = (match[4] || 'd').toLowerCase();

      return {
        sourceRowNumber: Number(match[1]),
        type: ((match[2] || 'FS').toUpperCase()) as DependencyType,
        lag: unit === 'w' ? amount * 7 : amount,
      };
    });
}

export function assignParentsFromIndents<T extends { id: string; indent: number }>(
  rows: T[],
): Array<{ id: string; parentId: string | null }> {
  const latestAtIndent: Array<T | undefined> = [];

  return rows.map((row) => {
    const parent = row.indent > 0 ? latestAtIndent[row.indent - 1] : undefined;
    latestAtIndent[row.indent] = row;
    latestAtIndent.length = row.indent + 1;

    return {
      id: row.id,
      parentId: parent?.id ?? null,
    };
  });
}

export function toUtcMidnightIso(value: Date | number | string): string {
  if (value instanceof Date) {
    return buildUtcMidnightIso(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === 'number') {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * DAY_MS);
    return buildUtcMidnightIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  return parseDateOnlyText(value);
}

export function fillMissingDates<T extends { id: string; rowNumber: number; title: string; startIso: string | null; endIso: string | null }>(
  rows: T[],
): { rows: T[]; missingDateFixes: MissingDateFix[] } {
  const fixedRows = rows.map((row) => ({ ...row }));
  const missingDateFixes: MissingDateFix[] = [];

  for (let index = 0; index < fixedRows.length; index += 1) {
    const row = fixedRows[index];
    if (row.startIso && row.endIso) {
      continue;
    }

    const previousEnd = fixedRows[index - 1]?.endIso;
    if (!previousEnd) {
      throw new Error(`Cannot fill missing date for ${row.id}: previous task has no end date`);
    }

    const repaired = addDaysIso(previousEnd, 1);
    row.startIso = repaired;
    row.endIso = repaired;
    missingDateFixes.push({
      rowNumber: row.rowNumber,
      taskId: row.id,
      title: row.title,
      startIso: repaired,
      endIso: repaired,
      rule: 'missing start/end -> previous task end + 1 day, end same as start',
    });
  }

  return { rows: fixedRows as T[], missingDateFixes };
}

export function parseWhisperWorkbook(xlsxPath: string, sheetName = DEFAULT_SHEET): {
  rows: ParsedScheduleRow[];
  missingDateFixes: MissingDateFix[];
} {
  const sheetPath = getWorksheetPath(xlsxPath, sheetName);
  return parseWhisperXmlParts({
    sharedStringsXml: readZipEntry(xlsxPath, 'xl/sharedStrings.xml'),
    stylesXml: readZipEntry(xlsxPath, 'xl/styles.xml'),
    sheetXml: readZipEntry(xlsxPath, sheetPath),
  }, sheetName);
}

export function parseWhisperXmlParts(parts: WhisperXmlParts, sheetName = DEFAULT_SHEET): {
  rows: ParsedScheduleRow[];
  missingDateFixes: MissingDateFix[];
} {
  const sharedStrings = parseSharedStrings(parts.sharedStringsXml);
  const styleIndents = parseStyleIndents(parts.stylesXml);
  const sheetRows = parseSheetRows(parts.sheetXml);
  const headerRow = sheetRows.find((row) => row.rowNumber === 1);

  if (!headerRow) {
    throw new Error(`Sheet ${sheetName} has no header row`);
  }

  const headers = new Map<string, string>();
  for (const cell of headerRow.cells.values()) {
    headers.set(getCellDisplayValue(cell, sharedStrings), cell.col);
  }

  const taskCol = headers.get('Task');
  const startCol = headers.get('Start');
  const endCol = headers.get('End');
  const predecessorCol = headers.get('Predecessors');
  if (!taskCol || !startCol || !endCol || !predecessorCol) {
    throw new Error(`Sheet ${sheetName} must include Task, Start, End, and Predecessors columns`);
  }

  const rawRows: ParsedScheduleRow[] = sheetRows
    .filter((row) => row.rowNumber > 1)
    .map((row, index) => {
      const rowNumber = index + 1;
      const taskCell = row.cells.get(taskCol);
      const title = taskCell ? getCellDisplayValue(taskCell, sharedStrings).trim() : '';
      const startCell = row.cells.get(startCol);
      const endCell = row.cells.get(endCol);
      const predecessorCell = row.cells.get(predecessorCol);
      const predecessorText = predecessorCell ? getCellDisplayValue(predecessorCell, sharedStrings).trim() : '';

      return {
        id: `whisper-${String(rowNumber).padStart(3, '0')}`,
        rowNumber,
        title,
        indent: taskCell?.style !== null && taskCell?.style !== undefined ? styleIndents[taskCell.style] ?? 0 : 0,
        startIso: startCell ? getCellDateIso(startCell, sharedStrings) : null,
        endIso: endCell ? getCellDateIso(endCell, sharedStrings) : null,
        predecessorText,
        predecessors: parsePredecessors(predecessorText),
      };
    })
    .filter((row) => row.title);

  const { rows, missingDateFixes } = fillMissingDates(rawRows);
  const parents = new Map(assignParentsFromIndents(rows).map((parent) => [parent.id, parent.parentId]));

  return {
    rows: rows.map((row) => ({ ...row, parentId: parents.get(row.id) ?? null })),
    missingDateFixes,
  };
}

export function parseCliArgs(args: string[]): { xlsxPath: string | null; sheetName: string } {
  const filteredArgs = args.filter((arg) => arg !== '--');
  const sheetArgIndex = filteredArgs.findIndex((arg) => arg === '--sheet');
  const sheetName = sheetArgIndex >= 0 ? filteredArgs[sheetArgIndex + 1] : DEFAULT_SHEET;
  const sheetValueIndex = sheetArgIndex >= 0 ? sheetArgIndex + 1 : -1;
  const xlsxPath = filteredArgs.find((arg, index) => arg !== '--sheet' && index !== sheetValueIndex) ?? null;

  return { xlsxPath, sheetName };
}

export async function importWhisperSchedule(xlsxPath: string, sheetName = DEFAULT_SHEET): Promise<Record<string, unknown>> {
  const { rows, missingDateFixes } = parseWhisperWorkbook(xlsxPath, sheetName);
  const dependencies = buildDependencies(rows);
  const projectStart = minIso(rows.map((row) => row.startIso));
  const projectEnd = maxIso(rows.map((row) => row.endIso));
  const nowIso = new Date().toISOString();
  const prisma = new PrismaClient();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `DELETE FROM Dependency
         WHERE sourceTaskId IN (SELECT id FROM Task WHERE projectId = ?)
            OR targetTaskId IN (SELECT id FROM Task WHERE projectId = ?)`,
        PROJECT_ID,
        PROJECT_ID,
      );
      await tx.task.deleteMany({ where: { projectId: PROJECT_ID } });
      await tx.project.deleteMany({ where: { id: PROJECT_ID } });
      await tx.$executeRawUnsafe(
        `INSERT INTO Project (id, name, description, startDate, endDate, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        PROJECT_ID,
        PROJECT_NAME,
        'Imported Whisper schedule from local Excel workbook',
        projectStart,
        projectEnd,
        'active',
        nowIso,
        nowIso,
      );

      for (const row of rows) {
        await tx.$executeRawUnsafe(
          `INSERT INTO Task (
            id, projectId, parentId, title, description, status, assigneeId,
            plannedStart, plannedEnd, actualStart, actualEnd,
            estimatedHours, actualHours, priority, progress, aiConfidence, aiReasoning,
            createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          row.id,
          PROJECT_ID,
          row.parentId,
          row.title,
          '',
          'todo',
          null,
          row.startIso,
          row.endIso,
          null,
          null,
          0,
          0,
          'medium',
          0,
          null,
          null,
          nowIso,
          nowIso,
        );
      }

      for (const dependency of dependencies) {
        await tx.$executeRawUnsafe(
          `INSERT INTO Dependency (id, sourceTaskId, targetTaskId, type, lag, source, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          dependency.id,
          dependency.sourceTaskId,
          dependency.targetTaskId,
          dependency.type,
          dependency.lag,
          'excel',
          nowIso,
        );
      }
    });

    const report = await buildReport(prisma, xlsxPath, sheetName, rows, dependencies, missingDateFixes);
    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return report;
  } finally {
    await prisma.$disconnect();
  }
}

function buildUtcMidnightIso(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function parseDateOnlyText(value: string): string {
  const trimmed = value.trim();
  let match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    return buildUtcMidnightIso(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    return buildUtcMidnightIso(Number(match[3]), Number(match[1]), Number(match[2]));
  }

  throw new Error(`Unsupported date-only text: ${value}`);
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(iso);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)).toISOString();
}

function minIso(values: Array<string | null>): string {
  const concrete = values.filter((value): value is string => Boolean(value));
  return concrete.sort()[0];
}

function maxIso(values: Array<string | null>): string {
  const concrete = values.filter((value): value is string => Boolean(value));
  return concrete.sort()[concrete.length - 1];
}

function readZipEntry(xlsxPath: string, entry: string): string {
  return execFileSync('unzip', ['-p', xlsxPath, entry], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function parseAttributes(xml: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of xml.matchAll(/([\w:]+)="([^"]*)"/g)) {
    attributes[match[1]] = decodeXml(match[2]);
  }
  return attributes;
}

function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => {
    const textParts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1]));
    return textParts.join('');
  });
}

function parseStyleIndents(xml: string): number[] {
  const cellXfs = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? '';
  return [...cellXfs.matchAll(/<xf\b[\s\S]*?(?:<\/xf>|\/>)/g)].map((match) => {
    const alignment = match[0].match(/<alignment\b([^>]*)\/?>/)?.[1] ?? '';
    const indent = alignment.match(/\bindent="(\d+)"/)?.[1];
    return indent ? Number(indent) : 0;
  });
}

function getWorksheetPath(xlsxPath: string, sheetName: string): string {
  const workbookXml = readZipEntry(xlsxPath, 'xl/workbook.xml');
  const relsXml = readZipEntry(xlsxPath, 'xl/_rels/workbook.xml.rels');
  const sheet = [...workbookXml.matchAll(/<sheet\b[^>]*\/>/g)]
    .map((match) => parseAttributes(match[0]))
    .find((attributes) => attributes.name === sheetName);

  if (!sheet) {
    throw new Error(`Worksheet not found: ${sheetName}`);
  }

  const relationship = [...relsXml.matchAll(/<Relationship\b[^>]*\/>/g)]
    .map((match) => parseAttributes(match[0]))
    .find((attributes) => attributes.Id === sheet['r:id']);

  if (!relationship) {
    throw new Error(`Worksheet relationship not found for ${sheetName}`);
  }

  const target = relationship.Target.replace(/^\/?xl\//, '');
  return `xl/${target}`;
}

function parseSheetRows(xml: string): XlsxRow[] {
  return [...xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const rowNumber = Number(parseAttributes(rowMatch[1]).r);
    const cells = new Map<string, XlsxCell>();

    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = parseAttributes(cellMatch[1]);
      const ref = attributes.r;
      const col = ref.replace(/\d+$/, '');
      const value = cellMatch[2]?.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? null;
      cells.set(col, {
        ref,
        col,
        type: attributes.t ?? null,
        style: attributes.s === undefined ? null : Number(attributes.s),
        value: value === null ? null : decodeXml(value),
      });
    }

    return { rowNumber, cells };
  });
}

function getCellDisplayValue(cell: XlsxCell, sharedStrings: string[]): string {
  if (cell.value === null) {
    return '';
  }

  if (cell.type === 's') {
    return sharedStrings[Number(cell.value)] ?? '';
  }

  return cell.value;
}

function getCellDateIso(cell: XlsxCell, sharedStrings: string[]): string | null {
  const value = getCellDisplayValue(cell, sharedStrings).trim();
  if (!value) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? toUtcMidnightIso(numeric) : toUtcMidnightIso(value);
}

export function buildDependencies(rows: ParsedScheduleRow[]) {
  const byRowNumber = new Map(rows.map((row) => [row.rowNumber, row]));
  const dependencies: Array<{
    id: string;
    sourceTaskId: string;
    targetTaskId: string;
    type: DependencyType;
    lag: number;
  }> = [];

  for (const row of rows) {
    for (const predecessor of row.predecessors) {
      const source = byRowNumber.get(predecessor.sourceRowNumber);
      if (!source) {
        throw new Error(`Task ${row.id} references missing predecessor row ${predecessor.sourceRowNumber}`);
      }

      dependencies.push({
        id: `whisper-dep-${String(dependencies.length + 1).padStart(3, '0')}`,
        sourceTaskId: source.id,
        targetTaskId: row.id,
        type: predecessor.type,
        lag: predecessor.lag,
      });
    }
  }

  return dependencies;
}

async function buildReport(
  prisma: PrismaClient,
  source: string,
  sheetName: string,
  rows: ParsedScheduleRow[],
  dependencies: ReturnType<typeof buildDependencies>,
  missingDateFixes: MissingDateFix[],
) {
  const dbRows = (await prisma.$queryRawUnsafe(
    `SELECT id, parentId, plannedStart, typeof(plannedStart) AS plannedStartType,
            plannedEnd, typeof(plannedEnd) AS plannedEndType
     FROM Task
     WHERE projectId = ?
     ORDER BY id`,
    PROJECT_ID,
  )) as DbTaskDateRow[];
  const dbDependencies = (await prisma.$queryRawUnsafe(
    `SELECT d.sourceTaskId, d.targetTaskId, d.type, d.lag
     FROM Dependency d
     JOIN Task t ON t.id = d.targetTaskId
     WHERE t.projectId = ?
     ORDER BY d.sourceTaskId, d.targetTaskId, d.type, d.lag`,
    PROJECT_ID,
  )) as DbDependencyRow[];

  return createImportReport({
    source,
    sheetName,
    rows,
    dbRows,
    dependencies,
    dbDependencies,
    missingDateFixes,
  });
}

export function createImportReport({
  source,
  sheetName,
  rows,
  dbRows,
  dependencies,
  dbDependencies,
  missingDateFixes,
}: {
  source: string;
  sheetName: string;
  rows: ParsedScheduleRow[];
  dbRows: DbTaskDateRow[];
  dependencies: ReturnType<typeof buildDependencies>;
  dbDependencies: DbDependencyRow[];
  missingDateFixes: MissingDateFix[];
}) {
  const dbById = new Map(dbRows.map((row) => [row.id, row]));
  const expectedDependencyKeys = dependencies.map(dependencyKey).sort();
  const actualDependencyKeys = dbDependencies.map(dependencyKey).sort();
  const storageTypes = summarizeDateStorageTypes(dbRows);

  return {
    source,
    projectId: PROJECT_ID,
    sheet: sheetName,
    tasksImported: dbRows.length,
    dependenciesImported: dbDependencies.length,
    parentLinksImported: dbRows.filter((row) => row.parentId).length,
    rootTasksImported: dbRows.filter((row) => !row.parentId).length,
    missingDateFixes,
    dateMismatchesAfterImport: rows.filter((row) => {
      const dbRow = dbById.get(row.id);
      return !dbRow || normalizeDbDateValue(dbRow.plannedStart) !== row.startIso || normalizeDbDateValue(dbRow.plannedEnd) !== row.endIso;
    }).length,
    hierarchyMismatchesAfterImport: rows.filter((row) => dbById.get(row.id)?.parentId !== (row.parentId ?? null)).length,
    dependencyMismatchesAfterImport: symmetricDifferenceCount(expectedDependencyKeys, actualDependencyKeys),
    dateStorageTypes: storageTypes,
    projectStart: minIso(rows.map((row) => row.startIso)),
    projectEnd: maxIso(rows.map((row) => row.endIso)),
  };
}

function dependencyKey(dependency: { sourceTaskId: string; targetTaskId: string; type: string; lag: number }): string {
  return `${dependency.sourceTaskId}|${dependency.targetTaskId}|${dependency.type}|${dependency.lag}`;
}

function symmetricDifferenceCount(left: string[], right: string[]): number {
  const rightCounts = new Map<string, number>();
  for (const value of right) {
    rightCounts.set(value, (rightCounts.get(value) ?? 0) + 1);
  }

  let mismatches = 0;
  for (const value of left) {
    const count = rightCounts.get(value) ?? 0;
    if (count > 0) {
      rightCounts.set(value, count - 1);
    } else {
      mismatches += 1;
    }
  }

  for (const count of rightCounts.values()) {
    mismatches += count;
  }

  return mismatches;
}

function summarizeDateStorageTypes(
  rows: Array<{ plannedStartType: string; plannedEndType: string; plannedStart: string | number | Date; plannedEnd: string | number | Date }>,
) {
  const summary = {
    plannedStart: {} as Record<string, number>,
    plannedEnd: {} as Record<string, number>,
    nonRfc3339TextRows: [] as number[],
  };

  rows.forEach((row, index) => {
    summary.plannedStart[row.plannedStartType] = (summary.plannedStart[row.plannedStartType] ?? 0) + 1;
    summary.plannedEnd[row.plannedEndType] = (summary.plannedEnd[row.plannedEndType] ?? 0) + 1;

    if (
      row.plannedStartType !== 'text' ||
      row.plannedEndType !== 'text' ||
      !isRfc3339Midnight(normalizeDbDateValue(row.plannedStart)) ||
      !isRfc3339Midnight(normalizeDbDateValue(row.plannedEnd))
    ) {
      summary.nonRfc3339TextRows.push(index + 1);
    }
  });

  return summary;
}

export function normalizeDbDateValue(value: string | number | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function isRfc3339Midnight(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(value);
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

async function main() {
  const { xlsxPath, sheetName } = parseCliArgs(process.argv.slice(2));

  if (!xlsxPath) {
    throw new Error(`Usage: pnpm --filter @taskpulse/api import:whisper -- <xlsx-path> [--sheet ${DEFAULT_SHEET}]`);
  }

  const report = await importWhisperSchedule(xlsxPath, sheetName);
  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${REPORT_PATH}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
