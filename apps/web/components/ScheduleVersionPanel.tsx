'use client';

import React, { useEffect, useState } from 'react';
import { GitCommit, RotateCcw, Save } from 'lucide-react';
import { api, type ScheduleVersion } from '@/services/api';
import { useStore } from '@/store/useStore';

export function ScheduleVersionPanel() {
  const { currentProjectId, reloadCurrentProject } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [name, setName] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!isOpen || !currentProjectId) return;
    void loadVersions();
  }, [isOpen, currentProjectId]);

  const loadVersions = async () => {
    if (!currentProjectId) return;
    setVersions(await api.fetchScheduleVersions(currentProjectId));
  };

  const saveVersion = async (isBaseline = false) => {
    if (!currentProjectId) return;
    setIsBusy(true);
    try {
      await api.createScheduleVersion(currentProjectId, {
        name: name.trim() || (isBaseline ? 'Baseline' : 'Manual save'),
        type: isBaseline ? 'baseline' : 'manual',
        isBaseline,
      });
      setName('');
      await loadVersions();
    } finally {
      setIsBusy(false);
    }
  };

  const restore = async (version: ScheduleVersion) => {
    if (!currentProjectId) return;
    if (!window.confirm(`Restore "${version.name}"? A rollback version will be saved first.`)) return;
    setIsBusy(true);
    try {
      await api.restoreScheduleVersion(currentProjectId, version.id);
      await reloadCurrentProject();
      await loadVersions();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <GitCommit size={15} /> Versions
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 z-40 w-[360px] rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Version name"
              className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              disabled={isBusy || !currentProjectId}
              onClick={() => saveVersion(false)}
              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1.5 text-xs text-white disabled:opacity-40"
            >
              <Save size={14} /> Save
            </button>
          </div>
          <button
            type="button"
            disabled={isBusy || !currentProjectId}
            onClick={() => saveVersion(true)}
            className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40"
          >
            Save as baseline
          </button>

          <div className="mt-3 max-h-72 overflow-y-auto border-t border-slate-100 pt-2">
            {versions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">No saved versions</div>
            ) : versions.map((version) => (
              <div key={version.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-800">
                    {version.name} {version.isBaseline ? <span className="text-indigo-600">(baseline)</span> : null}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {version.type} · {version.taskCount} tasks · {new Date(version.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => restore(version)}
                  disabled={isBusy}
                  className="rounded-md border border-slate-200 p-1.5 hover:bg-white disabled:opacity-40"
                  title="Restore version"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
