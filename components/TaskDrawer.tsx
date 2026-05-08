'use client';

import React from 'react';
import { useStore } from '@/store/useStore';
import { X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const TaskDrawer: React.FC = () => {
  const { selectedTaskId, setSelectedTask, tasks, updateTask, deleteTask } = useStore();
  const task = tasks.find(t => t.id === selectedTaskId);

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
              <h2 className="font-bold text-slate-800 text-sm">Task Details</h2>
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
                  value={task.title}
                  onChange={(e) => updateTask(task.id, { title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
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
                  <span className="text-indigo-600">{task.progress}%</span>
                </label>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={task.progress}
                  onChange={(e) => updateTask(task.id, { progress: parseInt(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer mt-2"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Dependencies</label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {tasks.filter(t => t.id !== task.id).map(t => {
                    const existingDep = task.dependencies?.find(d => d.taskId === t.id);
                    const isChecked = !!existingDep;
                    return (
                    <div key={t.id} className="flex flex-col gap-1 p-1.5 hover:bg-slate-50 rounded">
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const deps = task.dependencies || [];
                            if (checked) {
                              updateTask(task.id, { dependencies: [...deps, { taskId: t.id, type: 'FS', lag: 0 }] });
                            } else {
                              updateTask(task.id, { dependencies: deps.filter(d => d.taskId !== t.id) });
                            }
                          }}
                          className="accent-indigo-600 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="truncate">{t.title}</span>
                      </label>
                      {isChecked && existingDep && (
                        <div className="flex items-center gap-2 pl-6 mt-1">
                          <select 
                            value={existingDep.type}
                            onChange={(e) => {
                               const newType = e.target.value as 'FS' | 'FF' | 'SS' | 'SF';
                               const deps = task.dependencies?.map(d => d.taskId === t.id ? { ...d, type: newType } : d) || [];
                               updateTask(task.id, { dependencies: deps });
                            }}
                            className="text-xs border border-slate-300 rounded p-1 bg-white outline-none"
                          >
                            <option value="FS">FS</option>
                            <option value="FF">FF</option>
                            <option value="SS">SS</option>
                            <option value="SF">SF</option>
                          </select>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">Lag:</span>
                            <input 
                               type="number" 
                               value={existingDep.lag} 
                               onChange={(e) => {
                                  let newLag = parseInt(e.target.value);
                                  if (isNaN(newLag)) newLag = 0;
                                  const deps = task.dependencies?.map(d => d.taskId === t.id ? { ...d, lag: newLag } : d) || [];
                                  updateTask(task.id, { dependencies: deps });
                               }}
                               className="w-16 text-xs border border-slate-300 rounded p-1 outline-none"
                            />
                            <span className="text-[10px] text-slate-400">days</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )})}
                  {tasks.filter(t => t.id !== task.id).length === 0 && (
                    <span className="text-xs text-slate-400">No other tasks available</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 bg-slate-50">
              <button 
                onClick={() => setSelectedTask(null)}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
