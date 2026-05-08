'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { formatShortDate } from '@/lib/dateLabels';

export const Workspace: React.FC = () => {
  const { tasks, viewMode, setViewMode } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ x: 0, y: 0 });
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());
  const scrollRef = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const interactionState = useRef({
    mode: 'pan' as 'pan' | 'resize_left' | 'resize_right' | 'move',
    task: null as any,
    startX: 0,
    startY: 0,
    initialPlannedStart: '',
    initialPlannedEnd: ''
  });

  const toggleCollapse = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const flatTasks = React.useMemo(() => {
    let result: (typeof tasks[0] & { depth: number; hasChildren: boolean })[] = [];
    const getChildren = (parentId: string | undefined, depth: number, isHidden: boolean) => {
        const children = tasks.filter(t => t.parentId === parentId);
        children.forEach(child => {
            const childHasChildren = tasks.some(t => t.parentId === child.id);
            if (!isHidden) {
              result.push({ ...child, depth, hasChildren: childHasChildren });
            }
            const childHidden = isHidden || collapsedTasks.has(child.id);
            getChildren(child.id, depth + 1, childHidden);
        });
    };
    getChildren(undefined, 0, false);
    const existingIds = new Set(result.map(t => t.id));
    tasks.forEach(t => {
      if (!existingIds.has(t.id) && !t.parentId) { // only process true orphans not handled by getChildren
          const childHasChildren = tasks.some(c => c.parentId === t.id);
          result.push({ ...t, depth: 0, hasChildren: childHasChildren });
          getChildren(t.id, 1, collapsedTasks.has(t.id));
      }
    });
    return result;
  }, [tasks, collapsedTasks]);

  // Sync scrollY from task list to canvas state
  const handleTaskListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const y = e.currentTarget.scrollTop;
    setScroll(s => ({ ...s, y }));
    scrollRef.current.y = y;
  };

  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'inside' | null>(null);

  const canDrop = (draggingId: string, targetId: string) => {
    if (draggingId === targetId) return false;
    let current = tasks.find(t => t.id === targetId);
    while (current) {
      if (current.id === draggingId) return false; // Target is a descendant of dragging item
      if (!current.parentId) break;
      const parentId = current.parentId;
      current = tasks.find(t => t.id === parentId);
    }
    return true;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Helper specific for interaction calculations
    const getHitTask = (clientX: number, clientY: number, currentScroll: {x:number, y:number}) => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left + currentScroll.x;
      const y = clientY - rect.top + currentScroll.y;
      
      const storeState = useStore.getState();
      const { tasks, viewMode } = storeState;
      const dayWidth = viewMode === 'day' ? 100 : viewMode === 'week' ? 20 : 5;
      const rowHeight = 40;
      const headerHeight = 40;
      const timelineStartDate = new Date('2026-05-01T00:00:00'); 
      
      const getXFromD = (dateString: string) => {
        const d = new Date(dateString + 'T00:00:00');
        const diffDays = (d.getTime() - timelineStartDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays * dayWidth;
      };

      // Get hierarchical tasks
      let flatTasks: (typeof tasks[0] & { depth: number })[] = [];
      const getChildren = (parentId: string | undefined, depth: number) => {
          const children = tasks.filter(t => t.parentId === parentId);
          children.forEach(child => {
              flatTasks.push({ ...child, depth });
              getChildren(child.id, depth + 1);
          });
      };
      getChildren(undefined, 0);
      const existingIds = new Set(flatTasks.map(t => t.id));
      tasks.forEach(t => {
        if (!existingIds.has(t.id)) {
            flatTasks.push({ ...t, depth: 0 });
            getChildren(t.id, 1);
        }
      });

      for (let i = 0; i < flatTasks.length; i++) {
        const task = flatTasks[i];
        const taskY = headerHeight + (i * rowHeight) + (rowHeight - 24) / 2;
        const taskX = getXFromD(task.plannedStart);
        const taskEnd = getXFromD(task.plannedEnd);
        const taskW = Math.max(taskEnd - taskX, 20);

        if (y >= taskY && y <= taskY + 24 && x >= taskX - 5 && x <= taskX + taskW + 5) {
          if (Math.abs(x - taskX) < 10) return { task, mode: 'resize_left', flatTasks };
          if (Math.abs(x - (taskX + taskW)) < 10) return { task, mode: 'resize_right', flatTasks };
          return { task, mode: 'move', flatTasks };
        }
      }
      return { task: null, mode: 'pan', flatTasks };
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScroll(s => {
        const newY = Math.max(0, s.y + e.deltaY);
        const newX = Math.max(0, s.x + e.deltaX);
        if (taskListRef.current) taskListRef.current.scrollTop = newY;
        scrollRef.current = { x: newX, y: newY };
        return scrollRef.current;
      });
    };

    const handlePointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      
      // Determine what we hit
      const hit = getHitTask(e.clientX, e.clientY, scrollRef.current);
      interactionState.current = {
        mode: hit.mode as any,
        task: hit.task,
        startX: e.clientX,
        startY: e.clientY,
        initialPlannedStart: hit.task?.plannedStart || '',
        initialPlannedEnd: hit.task?.plannedEnd || '',
      };

      if (hit.mode === 'pan' || !hit.task) {
        isDragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
        useStore.getState().setSelectedTask(null);
      } else {
        isDragging.current = false;
        useStore.getState().setSelectedTask(hit.task.id);
        canvas.style.cursor = hit.mode === 'move' ? 'grabbing' : 'col-resize';
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (interactionState.current.mode === 'pan' && isDragging.current) {
        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;
        
        setScroll(s => {
          const newY = Math.max(0, s.y - dy);
          const newX = Math.max(0, s.x - dx);
          if (taskListRef.current) taskListRef.current.scrollTop = newY;
          scrollRef.current = { x: newX, y: newY };
          return scrollRef.current;
        });
        lastPos.current = { x: e.clientX, y: e.clientY };
      } else if (interactionState.current.mode !== 'pan' && interactionState.current.task) {
        // Dragging a task
        const viewMode = useStore.getState().viewMode;
        const dayWidth = viewMode === 'day' ? 100 : viewMode === 'week' ? 20 : 5;
        const dx = e.clientX - interactionState.current.startX;
        const deltaDays = Math.round(dx / dayWidth);

        if (deltaDays !== 0) {
          const startD = new Date(interactionState.current.initialPlannedStart + 'T00:00:00');
          const endD = new Date(interactionState.current.initialPlannedEnd + 'T00:00:00');

          if (interactionState.current.mode === 'move') {
            startD.setDate(startD.getDate() + deltaDays);
            endD.setDate(endD.getDate() + deltaDays);
          } else if (interactionState.current.mode === 'resize_left') {
            startD.setDate(startD.getDate() + deltaDays);
            if (startD.getTime() > endD.getTime()) startD.setTime(endD.getTime());
          } else if (interactionState.current.mode === 'resize_right') {
            endD.setDate(endD.getDate() + deltaDays);
            if (endD.getTime() < startD.getTime()) endD.setTime(startD.getTime());
          }

          const formatD = (d: Date) => d.toISOString().split('T')[0];
          
          useStore.getState().updateTask(interactionState.current.task.id, {
            plannedStart: formatD(startD),
            plannedEnd: formatD(endD)
          });
        }
      } else {
         // Hover effects (cursor changes)
         const hit = getHitTask(e.clientX, e.clientY, scrollRef.current);
         if (hit.mode === 'pan') canvas.style.cursor = 'grab';
         else if (hit.mode === 'move') canvas.style.cursor = 'grab';
         else canvas.style.cursor = 'col-resize';
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      isDragging.current = false;
      interactionState.current.mode = 'pan';
      interactionState.current.task = null;
      canvas.releasePointerCapture(e.pointerId);
      canvas.style.cursor = 'grab';
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const handleResize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, rect.width, rect.height);
      
      // Save context before translation
      ctx.save();
      // Translate to simulate camera scrolling
      ctx.translate(-scroll.x, -scroll.y);

      // --- dynamic date calculation ---
      const timelineStartDate = new Date('2026-05-01T00:00:00'); 
      const dayWidth = viewMode === 'day' ? 100 : viewMode === 'week' ? 20 : 5;
      const rowHeight = 40;
      const headerHeight = 40;
      
      const getXFromDate = (dateString: string) => {
        const d = new Date(dateString + 'T00:00:00');
        const diffTime = Math.abs(d.getTime() - timelineStartDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays * dayWidth;
      };

      // Grid & Header details
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'center';

      // We draw enough virtual days to over-cover the visible area
      const visibleDays = Math.ceil((rect.width + scroll.x) / dayWidth) + 10;
      const startDayIdx = Math.max(0, Math.floor(scroll.x / dayWidth));

      for (let i = startDayIdx; i < visibleDays; i++) {
        const x = i * dayWidth;
        // Grid line
        ctx.beginPath();
        // Since the header is sticky conceptually, let's draw grid lines full height
        ctx.moveTo(x, headerHeight + scroll.y); 
        ctx.lineTo(x, rect.height + scroll.y);
        ctx.setLineDash([4, 4]);
        
        const d = new Date(timelineStartDate);
        d.setDate(d.getDate() + i);

        if (viewMode === 'day') {
          ctx.strokeStyle = '#e5e7eb';
          ctx.stroke();
          ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, x + (dayWidth/2), 24 + scroll.y);
        } else if (viewMode === 'week') {
          // highlight Monday
          if (d.getDay() === 1) {
             ctx.strokeStyle = '#cbd5e1';
             ctx.stroke();
             ctx.fillText(`Week of ${d.getMonth() + 1}/${d.getDate()}`, x + (dayWidth * 3.5), 24 + scroll.y);
          } else {
             ctx.strokeStyle = '#f1f5f9';
             ctx.stroke();
          }
        } else if (viewMode === 'month') {
          if (d.getDate() === 1) {
            ctx.strokeStyle = '#94a3b8';
            ctx.stroke();
            const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            const monthName = d.toLocaleString('en-US', { month: 'short' });
            ctx.fillText(`${monthName} ${d.getFullYear()}`, x + ((dayWidth * daysInMonth) / 2), 24 + scroll.y);
          } else {
             ctx.strokeStyle = '#f8fafc';
             ctx.stroke();
          }
        }
      }

      ctx.setLineDash([]);

      const drawTaskBar = (task: typeof flatTasks[0], index: number) => {
        const y = headerHeight + (index * rowHeight) + (rowHeight - 24) / 2; // center vertically in row
        const startX = getXFromDate(task.plannedStart);
        const endX = getXFromDate(task.plannedEnd);
        const w = Math.max(endX - startX, 20); // min width

        let bgColor = '#d1d5db';
        let progressColor = 'rgba(0,0,0,0.2)';
        let textColor = '#4b5563';
        let label = `${task.progress}%`;

        if (task.status === 'done') {
          bgColor = '#22c55e';
          textColor = '#ffffff';
          label = '100%';
        } else if (task.status === 'in_progress') {
          bgColor = '#3b82f6';
          progressColor = '#2563eb';
          textColor = '#ffffff';
          label = `${task.progress}%`;
        }

        if (task.priority === 'critical' && task.status !== 'done') {
          ctx.shadowColor = 'rgba(239, 68, 68, 0.6)';
          ctx.shadowBlur = 10;
        }
        
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(startX, y, w, 24, 12);
        ctx.fill();
        
        ctx.shadowBlur = 0;

        if (task.progress < 100 && task.progress > 0 && task.status !== 'done') {
          ctx.fillStyle = progressColor;
          ctx.beginPath();
          ctx.roundRect(startX, y, w * (task.progress / 100), 24, 12);
          ctx.fill();
        }

        ctx.fillStyle = textColor;
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, startX + 12, y + 16);
      };

      // Draw Dependencies
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 2;
      
      flatTasks.forEach((task, index) => {
        if (task.dependencies && task.dependencies.length > 0) {
          task.dependencies.forEach(dep => {
            const depIndex = flatTasks.findIndex(t => t.id === dep.taskId);
            if (depIndex !== -1) {
              const depTask = flatTasks[depIndex];
              
              const depStart = getXFromDate(depTask.plannedStart);
              const depEnd = getXFromDate(depTask.plannedEnd);
              const taskStart = getXFromDate(task.plannedStart);
              const taskEnd = getXFromDate(task.plannedEnd);

              const fromY = headerHeight + (depIndex * rowHeight) + (rowHeight / 2);
              const toY = headerHeight + (index * rowHeight) + (rowHeight / 2);
              
              let fromX = depEnd;
              let toX = taskStart;

              if (dep.type === 'FS') {
                 fromX = depEnd;
                 toX = taskStart;
              } else if (dep.type === 'FF') {
                 fromX = depEnd;
                 toX = taskEnd;
              } else if (dep.type === 'SS') {
                 fromX = depStart;
                 toX = taskStart;
              } else if (dep.type === 'SF') {
                 fromX = depStart;
                 toX = taskEnd;
              }

              ctx.beginPath();
              ctx.moveTo(fromX, fromY);
              
              // Handle control points for bezier depending on relation direction
              const ctrl1X = fromX + (toX >= fromX ? 20 : -20);
              const ctrl2X = toX + (toX >= fromX ? -20 : 20);
              
              ctx.bezierCurveTo(ctrl1X, fromY, ctrl2X, toY, toX, toY);
              ctx.stroke();
            }
          });
        }
      });

      // Draw Tasks
      flatTasks.forEach((task, index) => {
        drawTaskBar(task, index);
      });

      ctx.restore();
      
      // Draw sticky header background over the canvas so grid lines don't bleed through
      ctx.fillStyle = 'rgba(248, 250, 251, 0.9)'; // match bg-slate-50/90
      ctx.fillRect(0, 0, rect.width, headerHeight);
      ctx.strokeStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(0, headerHeight);
      ctx.lineTo(rect.width, headerHeight);
      ctx.stroke();
      
      // Re-draw header text conceptually
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      for (let i = startDayIdx; i < visibleDays; i++) {
        const x = (i * dayWidth) - scroll.x;
        const d = new Date(timelineStartDate);
        d.setDate(d.getDate() + i);

        if (viewMode === 'day') {
          ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, x + (dayWidth/2), 24);
        } else if (viewMode === 'week') {
          if (d.getDay() === 1) {
             ctx.fillText(`Week of ${d.getMonth() + 1}/${d.getDate()}`, x + (dayWidth * 3.5), 24);
          }
        } else if (viewMode === 'month') {
          if (d.getDate() === 1) {
            const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            const monthName = d.toLocaleString('en-US', { month: 'short' });
            ctx.fillText(`${monthName} ${d.getFullYear()}`, x + ((dayWidth * daysInMonth) / 2), 24);
          }
        }
      }

    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);

  }, [flatTasks, viewMode, scroll]);

  return (
    <div className="flex flex-1 overflow-hidden relative">
      <div className="w-[560px] border-r border-slate-200 bg-white flex flex-col shrink-0 z-10">
        <div className="h-10 flex items-center border-b border-slate-100 bg-slate-50/50">
          <div className="w-10 px-4 shrink-0"></div>
          <div className="flex-1 px-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Tasks</div>
          <div className="w-24 px-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Status</div>
          <div className="w-20 px-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Start</div>
          <div className="w-20 px-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">End</div>
        </div>
        <div 
          ref={taskListRef}
          onScroll={handleTaskListScroll}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            const draggingId = e.dataTransfer.getData('taskId');
            if (draggingId) {
              useStore.getState().updateTask(draggingId, { parentId: undefined });
            }
          }}
          className="overflow-y-auto overflow-x-hidden flex-1 scrollbar-hide shrink-0" 
          style={{ paddingBottom: '100px' /* buffer for scroll sync */ }}
        >
          {flatTasks.map((task, index) => {
            let borderColor = 'border-slate-300';
            let fillColor = 'bg-white';
            
            if (task.status === 'done') {
              borderColor = 'border-green-500';
              fillColor = 'bg-green-500';
            } else if (task.status === 'in_progress') {
              borderColor = 'border-indigo-500';
              fillColor = 'bg-indigo-500';
            }
            
            return (
              <div 
                key={task.id} 
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('taskId', task.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverId(task.id);

                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  
                  if (y < rect.height * 0.25) {
                    setDropPosition('before');
                  } else if (y > rect.height * 0.75) {
                    setDropPosition('after');
                  } else {
                    setDropPosition('inside');
                  }
                }}
                onDragLeave={() => {
                  setDragOverId(null);
                  setDropPosition(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const draggingId = e.dataTransfer.getData('taskId');
                  if (draggingId && dragOverId === task.id && dropPosition && canDrop(draggingId, task.id)) {
                    useStore.getState().moveTask(draggingId, task.id, dropPosition);
                  }
                  
                  setDragOverId(null);
                  setDropPosition(null);
                }}
                className={`group h-10 flex items-center border-b border-slate-50 hover:bg-slate-50 cursor-pointer relative ${task.status === 'in_progress' ? 'bg-blue-50/30' : ''} ${dragOverId === task.id && dropPosition === 'inside' ? 'bg-indigo-50' : ''}`}
              >
                {dragOverId === task.id && dropPosition === 'before' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500 z-10" />}
                {dragOverId === task.id && dropPosition === 'after' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 z-10" />}
                <div 
                  className="w-10 px-4 shrink-0 flex justify-center text-slate-300 text-[10px]"
                  onClick={() => useStore.getState().setSelectedTask(task.id)}
                >
                  {index + 1}
                </div>
                <div 
                  className="flex-1 px-2 flex items-center gap-2 overflow-hidden" 
                  style={{ paddingLeft: `${task.depth * 20 + 8}px` }}
                  onClick={() => useStore.getState().setSelectedTask(task.id)}
                >
                  <div 
                    className={`w-4 h-4 flex items-center justify-center shrink-0 ${task.hasChildren ? 'cursor-pointer hover:bg-slate-200 rounded' : 'opacity-0'}`}
                    onClick={(e) => task.hasChildren && toggleCollapse(task.id, e)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={`w-3 h-3 text-slate-500 transition-transform ${collapsedTasks.has(task.id) ? '-rotate-90' : ''}`} strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  <div className={`w-4 h-4 shrink-0 border-2 rounded-full flex items-center justify-center ${borderColor} ${task.status === 'done' ? fillColor : ''}`}>
                    {task.status === 'in_progress' && <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>}
                  </div>
                  <span className={`text-[13px] truncate font-medium ${task.priority === 'critical' ? 'text-slate-900' : 'text-slate-700'}`}>
                    {task.title} {task.priority === 'critical' && <span className="text-red-500 ml-1">🔥</span>}
                  </span>
                </div>
                {/* Add Subtask action */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    useStore.getState().createTask({
                      title: 'New Subtask',
                      status: 'todo',
                      priority: 'medium',
                      plannedStart: task.plannedStart,
                      plannedEnd: task.plannedEnd,
                      progress: 0,
                      parentId: task.id
                    });
                  }}
                  className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Add subtask"
                >
                  +
                </button>
                <div 
                  className="w-20 px-2 shrink-0"
                  onClick={() => useStore.getState().setSelectedTask(task.id)}
                >
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-sm capitalize ${
                    task.status === 'done' ? 'bg-green-100 text-green-700' :
                    task.status === 'in_progress' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
                <div 
                  className="w-20 px-2 shrink-0 text-[11px] text-slate-500 font-mono"
                  onClick={() => useStore.getState().setSelectedTask(task.id)}
                >
                  {formatShortDate(task.plannedStart)}
                </div>
                <div
                  className="w-20 px-2 shrink-0 text-[11px] text-slate-500 font-mono"
                  onClick={() => useStore.getState().setSelectedTask(task.id)}
                >
                  {formatShortDate(task.plannedEnd)}
                </div>
              </div>
            );
          })}
          <div className="p-4">
            <button 
              onClick={() => {
                useStore.getState().createTask({
                  title: 'New Task',
                  status: 'todo',
                  priority: 'medium',
                  plannedStart: '2026-05-15',
                  plannedEnd: '2026-05-20',
                  progress: 0
                });
              }}
              className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-slate-400 text-xs hover:border-slate-400 hover:text-slate-500 transition-colors cursor-pointer"
            >
              + Add Task
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden bg-white">
        <div className="absolute top-2 right-4 z-20 flex bg-white rounded shadow-sm border border-slate-200 p-0.5">
          {['day', 'week', 'month'].map(mode => (
            <button 
              key={mode} 
              onClick={() => setViewMode(mode as any)}
              className={`px-3 py-1 text-[11px] font-bold rounded-sm capitalize cursor-pointer transition-all ${
                viewMode === mode 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        
        <canvas 
          ref={canvasRef} 
          className="w-full h-full cursor-grab outline-none relative z-10 touch-none" 
          tabIndex={0} 
        />
      </div>
    </div>
  );
};
