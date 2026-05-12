import type { DependencyType, TaskPriority } from '@taskpulse/contracts';

export function getPriorityVisual(priority: TaskPriority) {
  switch (priority) {
    case 'low':
      return {
        label: 'Low',
        shortLabel: 'L',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        rowAccentClass: 'before:bg-emerald-400',
        ganttAccent: '#10b981',
      };
    case 'high':
      return {
        label: 'High',
        shortLabel: 'H',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        rowAccentClass: 'before:bg-amber-400',
        ganttAccent: '#f59e0b',
      };
    case 'critical':
      return {
        label: 'Critical',
        shortLabel: 'C',
        badgeClass: 'bg-red-50 text-red-700 border-red-200',
        rowAccentClass: 'before:bg-red-500',
        ganttAccent: '#dc2626',
      };
    case 'medium':
    default:
      return {
        label: 'Medium',
        shortLabel: 'M',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        rowAccentClass: 'before:bg-slate-400',
        ganttAccent: '#64748b',
      };
  }
}

export function getDependencyLineStyle(input: {
  isCritical: boolean;
  isSelected: boolean;
  type: DependencyType;
}) {
  if (input.isCritical) {
    return { strokeStyle: '#dc2626', lineWidth: 2.75, alpha: 1, lineDash: [] as number[] };
  }

  if (input.isSelected) {
    return { strokeStyle: '#4f46e5', lineWidth: 2.5, alpha: 0.95, lineDash: [] as number[] };
  }

  const lineDashByType: Record<DependencyType, number[]> = {
    FS: [7, 4],
    SS: [3, 3],
    FF: [10, 4, 2, 4],
    SF: [2, 4],
  };

  return {
    strokeStyle: '#475569',
    lineWidth: 1.75,
    alpha: 0.72,
    lineDash: lineDashByType[input.type],
  };
}
