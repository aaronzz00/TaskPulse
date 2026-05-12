'use client';

import React from 'react';
import { useStore } from '@/store/useStore';
import { Search, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getDependencyCandidateTasks, getTaskPathLabel } from '@/lib/dependencyDisplay';
import { getTaskDisplayId } from '@/lib/taskDisplay';

export const TaskDrawer: React.FC = () => {
  const {
    selectedTaskId,
    setSelectedTask,
    tasks,
    updateTask,
    deleteTask,
    createDependency,
    updateDependency,
    deleteDependency,
  } = useStore();
  const task = tasks.find(t => t.id === selectedTaskId);
  const [titleDraft, setTitleDraft] = React.useState('');
  const [notesDraft, setNotesDraft] = React.useState('');
  const [progressDraft, setProgressDraft] = React.useState(0);
  const [dependencySearch, setDependencySearch] = React.useState('');
  const lastTitleCommitRef = React.useRef('');
  const lastNotesCommitRef = React.useRef('');
  const lastProgressCommitRef = React.useRef(0);

  React.useEffect(() => {
    setTitleDraft(task?.title ?? '');
    setNotesDraft(task?.description ?? '');
    setProgressDraft(task?.progress ?? 0);
    lastTitleCommitRef.current = task?.title ?? '';
    lastNotesCommitRef.current = task?.description ?? '';
    lastProgressCommitRef.current = task?.progress ?? 0;
    setDependencySearch('');
  }, [task?.id, task?.title, task?.description, task?.progress]);

  const commitTitle = React.useCallback(() => {
    if (!task || titleDraft === task.title || titleDraft === lastTitleCommitRef.current) return;
    lastTitleCommitRef.current = titleDraft;
    updateTask(task.id, { title: titleDraft });
  }, [task, titleDraft, updateTask]);

  const commitNotes = React.useCallback(() => {
    if (!task || notesDraft === (task.description ?? '') || notesDraft === lastNotesCommitRef.current) return;
    lastNotesCommitRef.current = notesDraft;
    updateTask(task.id, { description: notesDraft });
  }, [notesDraft, task, updateTask]);

  const commitProgress = React.useCallback((value: number) => {
    if (!task || value === task.progress || value === lastProgressCommitRef.current) return;
    lastProgressCommitRef.current = value;
    setProgressDraft(value);
    updateTask(task.id, { progress: value });
  }, [task, updateTask]);

  const dependencyCandidates = React.useMemo(() => {
    if (!task) return [];
    return getDependencyCandidateTasks(task, tasks, dependencySearch).slice(0, 12);
  }, [dependencySearch, task, tasks]);

  return (
    <AnimatePresence>
      {selectedTaskId && task && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedTask(null)}
            className="fixed inset-0 bg-slate-900/20 z-40"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 w-[400px] h-full bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200"
          >
            <div className="h-14 flex items-center justify-between px-6 border-b border-slate-200 shrink-0 bg-slate-50">
              <div>
                <h2 className="font-bold text-slate-800 text-sm">Task Details</h2>
                <div className="text-[11px] text-slate-500 font-mono">{getTaskDisplayId(task)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    deleteTask(task.id);
                    setSelectedTask(null);
                  }}
                  className="text-red-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                  title="Delete Task"
                >
                  <Trash2 size={16} />
                </button>
                <button 
                  onClick={() => setSelectedTask(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Title</label>
                <input 
                  type="text" 
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitTitle();
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Notes</label>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  onBlur={commitNotes}
                  rows={5}
                  placeholder="Add task notes, assumptions, risks, or handoff context"
                  className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Status</label>
                  <select 
                    value={task.status}
                    onChange={(e) => updateTask(task.id, { status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Priority</label>
                  <select 
                    value={task.priority}
                    onChange={(e) => updateTask(task.id, { priority: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Planned Start</label>
                  <input 
                    type="date"
                    value={task.plannedStart}
                    onChange={(e) => updateTask(task.id, { plannedStart: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Planned End</label>
                  <input 
                    type="date"
                    value={task.plannedEnd}
                    onChange={(e) => updateTask(task.id, { plannedEnd: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex justify-between">
                  <span>Progress</span>
                  <span className="text-indigo-600">{progressDraft}%</span>
                </label>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={progressDraft}
                  onChange={(e) => setProgressDraft(parseInt(e.target.value))}
                  onPointerUp={(e) => commitProgress(parseInt(e.currentTarget.value))}
                  onKeyUp={(e) => commitProgress(parseInt(e.currentTarget.value))}
                  onBlur={(e) => commitProgress(parseInt(e.currentTarget.value))}
                  className="w-full accent-indigo-600 cursor-pointer mt-2"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Dependencies</label>
                <div className="space-y-3">
                  <div className="space-y-2">
                    {(task.dependencies || []).length === 0 && (
                      <div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg p-3">
                        No dependencies
                      </div>
                    )}
                    {(task.dependencies || []).map((dependency) => {
                      const sourceTask = tasks.find(candidate => candidate.id === dependency.taskId);
                      if (!sourceTask) return null;

                      return (
                        <div key={dependency.id ?? dependency.taskId} className="border border-slate-200 rounded-lg p-3 bg-slate-50/70">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs font-mono text-indigo-600">{getTaskDisplayId(sourceTask)}</div>
                              <div className="text-sm font-medium text-slate-800 truncate">{sourceTask.title}</div>
                              <div className="text-[11px] text-slate-400">{sourceTask.plannedStart} {'->'} {sourceTask.plannedEnd}</div>
                            </div>
                            <button
                              onClick={() => dependency.id && deleteDependency(task.id, dependency.id)}
                              disabled={!dependency.id}
                              className="text-slate-400 hover:text-red-600 p-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Remove dependency"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <select
                              value={dependency.type}
                              disabled={!dependency.id}
                              onChange={(e) => {
                                const newType = e.target.value as 'FS' | 'FF' | 'SS' | 'SF';
                                if (dependency.id) {
                                  updateDependency(task.id, dependency.id, { type: newType });
                                }
                              }}
                              className="text-xs border border-slate-300 rounded p-1 bg-white outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="FS">FS</option>
                              <option value="FF">FF</option>
                              <option value="SS">SS</option>
                              <option value="SF">SF</option>
                            </select>
                            <span className="text-xs text-slate-500">Lag</span>
                            <input
                              type="number"
                              value={dependency.lag}
                              disabled={!dependency.id}
                              onChange={(e) => {
                                let newLag = parseInt(e.target.value);
                                if (isNaN(newLag)) newLag = 0;
                                if (dependency.id) {
                                  updateDependency(task.id, dependency.id, { lag: newLag });
                                }
                              }}
                              className="w-16 text-xs border border-slate-300 rounded p-1 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <span className="text-[10px] text-slate-400">days</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border border-slate-200 rounded-lg bg-white">
                    <div className="relative border-b border-slate-100">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={dependencySearch}
                        onChange={(e) => setDependencySearch(e.target.value)}
                        placeholder="Add dependency by ID, title, status, or date"
                        className="w-full pl-9 pr-3 py-2 text-sm outline-none rounded-t-lg"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {dependencyCandidates.map((candidate) => (
                        <button
                          key={candidate.id}
                          onClick={() => {
                            createDependency(candidate.id, task.id);
                            setDependencySearch('');
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-indigo-50 border-b border-slate-50 last:border-b-0"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs font-mono text-indigo-600">{getTaskDisplayId(candidate)}</div>
                              <div className="text-sm text-slate-800 truncate">{candidate.title}</div>
                              <div className="text-[11px] text-slate-400 truncate">{getTaskPathLabel(candidate, tasks)}</div>
                            </div>
                            <div className="text-[11px] text-slate-400 shrink-0">{candidate.plannedStart}</div>
                          </div>
                        </button>
                      ))}
                      {dependencyCandidates.length === 0 && (
                        <div className="px-3 py-3 text-xs text-slate-400">
                          No matching dependency candidates
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 bg-slate-50">
              <button 
                onClick={() => setSelectedTask(null)}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
