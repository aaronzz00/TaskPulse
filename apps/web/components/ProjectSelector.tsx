'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Archive, ChevronDown, Copy, FileSpreadsheet, FolderPlus } from 'lucide-react';
import { useStore } from '@/store/useStore';

export function ProjectSelector() {
  const {
    project,
    projects,
    switchProject,
    createBlankProject,
    duplicateCurrentProject,
    importProjectFromExcel,
    archiveCurrentProject,
  } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentProject = projects.find((candidate) => candidate.id === project?.id);
  const dateRange = useMemo(() => {
    if (!currentProject) return '';
    return `${formatDate(currentProject.startDate)} - ${formatDate(currentProject.endDate)}`;
  }, [currentProject]);

  const handleCreate = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    await createBlankProject(name);
    setNewProjectName('');
    setIsOpen(false);
  };

  const handleDuplicate = async () => {
    if (!project) return;
    await duplicateCurrentProject(`${project.name} Copy`);
    setIsOpen(false);
  };

  const handleArchive = async () => {
    if (!project) return;
    if (!window.confirm(`Archive "${project.name}"?`)) return;
    await archiveCurrentProject();
    setIsOpen(false);
  };

  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await importProjectFromExcel(file);
    setIsOpen(false);
    event.target.value = '';
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex items-center gap-2 hover:bg-slate-50 px-2 py-1 rounded text-left"
      >
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-slate-800">{project?.name || 'No project'}</span>
          <span className="text-[11px] text-slate-500">
            {currentProject ? `${currentProject.status} · ${dateRange}` : 'Create or select a project'}
          </span>
        </div>
        <ChevronDown size={16} className="text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-12 z-40 w-[360px] rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="max-h-56 overflow-y-auto py-2">
            {projects.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={async () => {
                  await switchProject(candidate.id);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left hover:bg-slate-50 ${candidate.id === project?.id ? 'bg-indigo-50' : ''}`}
              >
                <div className="text-sm font-medium text-slate-800">{candidate.name}</div>
                <div className="text-[11px] text-slate-500">
                  {candidate.status} · {formatDate(candidate.startDate)} - {formatDate(candidate.endDate)}
                </div>
              </button>
            ))}
          </div>

          <div className="border-t border-slate-200 p-3 space-y-2">
            <div className="flex gap-2">
              <input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleCreate();
                }}
                placeholder="New blank project"
                className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleCreate}
                className="inline-flex items-center justify-center rounded-md bg-slate-900 px-2 text-white hover:bg-slate-800"
                title="Create blank project"
              >
                <FolderPlus size={16} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={!project}
                className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-40"
              >
                <Copy size={14} /> Copy
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50"
              >
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={!project}
                className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-40"
              >
                <Archive size={14} /> Archive
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleExcelImport}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}
