import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assignParentsFromIndents,
  fillMissingDates,
  parseCliArgs,
  parseWhisperXmlParts,
  parsePredecessors,
  normalizeDbDateValue,
  createImportReport,
  toUtcMidnightIso,
} from './import-whisper-schedule';

test('parsePredecessors supports comma lists, relation types, day and week lags, and default FS', () => {
  assert.deepEqual(parsePredecessors('93, 97'), [
    { sourceRowNumber: 93, type: 'FS', lag: 0 },
    { sourceRowNumber: 97, type: 'FS', lag: 0 },
  ]);
  assert.deepEqual(parsePredecessors('87SS +1w'), [
    { sourceRowNumber: 87, type: 'SS', lag: 7 },
  ]);
  assert.deepEqual(parsePredecessors('99SS +5d'), [
    { sourceRowNumber: 99, type: 'SS', lag: 5 },
  ]);
  assert.deepEqual(parsePredecessors('42'), [
    { sourceRowNumber: 42, type: 'FS', lag: 0 },
  ]);
});

test('assignParentsFromIndents derives parent ids from row order and indent levels', () => {
  const rows = [
    { id: 'whisper-001', rowNumber: 1, indent: 0 },
    { id: 'whisper-002', rowNumber: 2, indent: 0 },
    { id: 'whisper-003', rowNumber: 3, indent: 1 },
    { id: 'whisper-004', rowNumber: 4, indent: 2 },
    { id: 'whisper-005', rowNumber: 5, indent: 1 },
    { id: 'whisper-006', rowNumber: 6, indent: 0 },
  ];

  assert.deepEqual(assignParentsFromIndents(rows), [
    { id: 'whisper-001', parentId: null },
    { id: 'whisper-002', parentId: null },
    { id: 'whisper-003', parentId: 'whisper-002' },
    { id: 'whisper-004', parentId: 'whisper-003' },
    { id: 'whisper-005', parentId: 'whisper-002' },
    { id: 'whisper-006', parentId: null },
  ]);
});

test('fillMissingDates uses previous task end plus one day and same-day end', () => {
  const rows = fillMissingDates([
    {
      id: 'whisper-001',
      rowNumber: 1,
      title: 'Known date',
      startIso: '2026-05-18T00:00:00.000Z',
      endIso: '2026-05-19T00:00:00.000Z',
    },
    {
      id: 'whisper-002',
      rowNumber: 2,
      title: 'Missing dates',
      startIso: null,
      endIso: null,
    },
  ]);

  assert.equal(rows.rows[1].startIso, '2026-05-20T00:00:00.000Z');
  assert.equal(rows.rows[1].endIso, '2026-05-20T00:00:00.000Z');
  assert.deepEqual(rows.missingDateFixes, [
    {
      rowNumber: 2,
      taskId: 'whisper-002',
      title: 'Missing dates',
      startIso: '2026-05-20T00:00:00.000Z',
      endIso: '2026-05-20T00:00:00.000Z',
      rule: 'missing start/end -> previous task end + 1 day, end same as start',
    },
  ]);
});

test('toUtcMidnightIso preserves Excel calendar dates without timezone shifts', () => {
  assert.equal(toUtcMidnightIso(new Date(2026, 1, 24, 15, 30)), '2026-02-24T00:00:00.000Z');
  assert.equal(toUtcMidnightIso(new Date(2026, 6, 1, 15, 30)), '2026-07-01T00:00:00.000Z');
  assert.equal(toUtcMidnightIso(new Date(2027, 3, 14, 15, 30)), '2027-04-14T00:00:00.000Z');
});

test('toUtcMidnightIso parses date-only text without implicit timezone conversion', () => {
  assert.equal(toUtcMidnightIso('2026/02/24'), '2026-02-24T00:00:00.000Z');
  assert.equal(toUtcMidnightIso('02/24/2026'), '2026-02-24T00:00:00.000Z');
  assert.throws(() => toUtcMidnightIso('Feb 24 2026'), /Unsupported date-only text/);
});

test('parseCliArgs ignores pnpm passthrough separator and keeps default sheet', () => {
  assert.deepEqual(parseCliArgs(['--', '/tmp/Whisper.xlsx']), {
    xlsxPath: '/tmp/Whisper.xlsx',
    sheetName: 'Whisper_WIP',
  });
});

test('normalizeDbDateValue compares Prisma DateTime query results as RFC3339 strings', () => {
  assert.equal(normalizeDbDateValue(new Date('2026-02-24T00:00:00.000Z')), '2026-02-24T00:00:00.000Z');
  assert.equal(normalizeDbDateValue('2026-02-24T00:00:00.000Z'), '2026-02-24T00:00:00.000Z');
});

test('parseWhisperXmlParts handles shared strings, numeric Excel dates, and style indent', () => {
  const sharedStringsXml = `<?xml version="1.0"?>
    <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <si><t>Task</t></si>
      <si><t>Start</t></si>
      <si><t>End</t></si>
      <si><t>Duration</t></si>
      <si><t>Predecessors</t></si>
      <si><t>Parent task</t></si>
      <si><t>Child task</t></si>
      <si><t>1d</t></si>
      <si><t>1</t></si>
    </sst>`;
  const stylesXml = `<?xml version="1.0"?>
    <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <cellXfs count="2">
        <xf/>
        <xf><alignment indent="1"/></xf>
      </cellXfs>
    </styleSheet>`;
  const sheetXml = `<?xml version="1.0"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <sheetData>
        <row r="1">
          <c r="A1" t="s" s="0"><v>0</v></c>
          <c r="B1" t="s" s="0"><v>1</v></c>
          <c r="C1" t="s" s="0"><v>2</v></c>
          <c r="D1" t="s" s="0"><v>3</v></c>
          <c r="E1" t="s" s="0"><v>4</v></c>
        </row>
        <row r="2">
          <c r="A2" t="s" s="0"><v>5</v></c>
          <c r="B2" t="n"><v>46076.0</v></c>
          <c r="C2" t="n"><v>46076.0</v></c>
          <c r="D2" t="s"><v>7</v></c>
          <c r="E2"/>
        </row>
        <row r="3">
          <c r="A3" t="s" s="1"><v>6</v></c>
          <c r="B3" t="n"><v>46077.0</v></c>
          <c r="C3" t="n"><v>46077.0</v></c>
          <c r="D3" t="s"><v>7</v></c>
          <c r="E3" t="s"><v>8</v></c>
        </row>
      </sheetData>
    </worksheet>`;

  const parsed = parseWhisperXmlParts({ sharedStringsXml, stylesXml, sheetXml });

  assert.deepEqual(parsed.rows.map((row) => ({
    id: row.id,
    title: row.title,
    indent: row.indent,
    parentId: row.parentId,
    startIso: row.startIso,
    predecessors: row.predecessors,
  })), [
    {
      id: 'whisper-001',
      title: 'Parent task',
      indent: 0,
      parentId: null,
      startIso: '2026-02-23T00:00:00.000Z',
      predecessors: [],
    },
    {
      id: 'whisper-002',
      title: 'Child task',
      indent: 1,
      parentId: 'whisper-001',
      startIso: '2026-02-24T00:00:00.000Z',
      predecessors: [{ sourceRowNumber: 1, type: 'FS', lag: 0 }],
    },
  ]);
});

test('createImportReport records the actual imported sheet name', () => {
  const report = createImportReport({
    source: '/tmp/custom.xlsx',
    sheetName: 'CustomSheet',
    rows: [],
    dbRows: [],
    dependencies: [],
    dbDependencies: [],
    missingDateFixes: [],
  });

  assert.equal(report.sheet, 'CustomSheet');
});
