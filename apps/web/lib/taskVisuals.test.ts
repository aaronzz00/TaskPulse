import assert from 'node:assert/strict';
import test from 'node:test';
import { getDependencyLineStyle, getPriorityVisual } from './taskVisuals';

test('priority visuals cover every task priority', () => {
  for (const priority of ['low', 'medium', 'high', 'critical'] as const) {
    const visual = getPriorityVisual(priority);
    assert.ok(visual.badgeClass);
    assert.ok(visual.ganttAccent);
    assert.ok(visual.label);
    assert.ok(visual.shortLabel);
  }
});

test('dependency line style makes normal dependencies more visible than grid lines', () => {
  const style = getDependencyLineStyle({ isCritical: false, isSelected: false, type: 'FS' });
  assert.equal(style.strokeStyle, '#475569');
  assert.ok(style.lineWidth >= 1.75);
  assert.ok(style.alpha >= 0.7);
});

test('critical dependency style remains strongest', () => {
  const style = getDependencyLineStyle({ isCritical: true, isSelected: false, type: 'FS' });
  assert.equal(style.strokeStyle, '#dc2626');
  assert.equal(style.lineDash.length, 0);
  assert.ok(style.lineWidth >= 2.5);
});

test('dependency types have distinct normal dash patterns', () => {
  const patterns = new Set(
    (['FS', 'SS', 'FF', 'SF'] as const).map((type) =>
      getDependencyLineStyle({ isCritical: false, isSelected: false, type }).lineDash.join(','),
    ),
  );
  assert.equal(patterns.size, 4);
});
