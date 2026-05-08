# AuriPath - 前端改善 Guideline (Post-Integration Frontend Guidelines)

## 1. 架构目标
在前后端成功对接并获得真实业务数据量级后，需要重点解决大数据量下的**渲染性能瓶颈**、进一步完善**复杂操作的 UX 体验**，并为 Phase 2 的架构预留扩展点。

## 2. 性能优化 (Performance Optimization)

### 2.1 长列表与大画布的虚拟化 (Virtualization)
- **现状**：目前左侧的侧边栏任务树和右侧 Canvas 画布均是全量渲染。
- **改善点**：一旦单一项目的任务突破上千条（包含深层级的子任务），DOM 压力和 Canvas 重绘压力会造成拖拽与平移卡顿。
  - **DOM**：推荐使用 `@tanstack/react-virtual` 构建虚拟列表，仅挂载视口内的 `div` 行。
  - **Canvas**：在进行 `ctx.fillRect` / `ctx.stroke` 前，结合 `scroll.x`, `scroll.y` 和视口宽高计算可见区间，在此区间外的元素直接 `continue` 不做绘制裁剪。

### 2.2 复杂计算卸载 (Web Worker Offloading)
- **现状**：由拖拽触发的”级联自动排程推演“在主线程中执行。
- **改善点**：如果连带影响的任务网极为庞大，计算图的遍历可能阻塞主进程，导致拖曳完成刹那有明显掉帧。需将此纯函数逻辑提取至 Web Worker，计算结果异步 `postMessage` 传回主线程并映射到 Zustand 中。

## 3. 用户体验增强 (UX Enhancements)

### 3.1 撤销栈架构 (Undo/Redo Stack)
- **现状**：图表拖拽是一次性的，排程引擎也是链式反应，改变后无法简单撤回。
- **改善点**：引进时间旅行 (Time-travel) 能力。利用类似 `zundo` 的中间件，对涉及布局与层级的操作建立撤销栈（只记录用户触发的 Master 动作及其快照），允许通过 `Cmd/Ctrl + Z` 实现安全撤销，大幅降低用户的试错心理压力。

### 3.2 局部加载指引 (Skeleton & Micro-interactions)
- **现状**：目前为粗颗粒度的 loading。
- **改善点**：彻底移除全屏遮罩式的 Spinner。
  - 后端获取数据采用分块骨架屏。
  - 增删改操作使用状态机的微交互表现（例如变更尚未到达服务端确认前，任务行文字为灰色/带有小 loading 图标）。

## 4. Phase 2 准备 (Feature Evolution)

### 4.1 Graph View (PERT图 / 网络图)
- 依据 `packages/contracts` 中定义的依赖数组 (`FS`, `FF` 等)，利用 `d3.js` 或类似图形库实现连线驱动的 Graph View，与现有的甘特图在逻辑上完全解耦并共享核心 Zustand state。

### 4.2 Document Control 与 External Release UI
- 解除 Phase 1 的展示范围限制，在侧边栏结构中挂载新页面，确保审批流程 (Approval flows) 组件在工程标准与 UI 规范的限制内有高度复用性。

### 4.3 无级缩放体验 (Stepless Semantic Zoom)
- 当前提供了 Day/Week/Month 的按键切换。未来改善可融合触控板的双指捏合（Pinch to Zoom）事件，实现平滑刻度切换的视觉体验，而非简单粗暴的状态跳变。
