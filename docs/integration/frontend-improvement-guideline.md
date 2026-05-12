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

### 3.3 依赖项连线可读性 (Dependency Line Readability)
- **现状**：当前甘特图中 critical path 依赖使用红色高亮，选中任务相关依赖使用靛蓝色，其余依赖使用低透明度灰蓝虚线。非 critical 依赖在浅色网格和任务条背景上识别度不足，尤其在 `all` 模式下容易被网格线吞没。
- **改善点**：建立明确的依赖连线视觉层级。
  - Critical path：继续使用红色实线，保持最高优先级。
  - Selected dependency：使用靛蓝色实线或半实线，线宽高于普通依赖。
  - Normal dependency：改为更高对比度的中性蓝灰，降低透明度损失，避免与网格线颜色接近。
  - Dependency type：可用不同 dash pattern 或箭头样式区分 `FS` / `SS` / `FF` / `SF`，但不要只依赖颜色。
  - 在甘特图右上角依赖模式控制区旁增加小型 legend，解释 critical / selected / normal 的样式含义。

### 3.4 任务 Priority 视觉区分 (Task Priority Visual Differentiation)
- **现状**：目前只有 `critical` priority 或 critical path 任务有明显红点/描边；`low`、`medium`、`high` 在任务列表和甘特图上缺少可扫读差异。
- **改善点**：为所有 priority 建立一致的视觉编码，并确保它和 status、critical path 不冲突。
  - `low`：低饱和灰/绿，弱提示。
  - `medium`：中性蓝灰，默认态。
  - `high`：橙/琥珀强调。
  - `critical`：红色强调。
  - 任务列表中增加 priority badge 或左侧色条，不只在标题后追加红点。
  - 甘特条可使用 priority 色作为左侧细条、顶部细线或外描边；任务 status 仍控制主体填充色，critical path 仍使用独立红色描边。
  - 搜索、选中、拖拽和 critical path 高亮应优先级明确，避免多个背景色互相覆盖导致不可读。

### 3.5 任务备注栏 (Task Notes Field)
- **现状**：后端 Task 已有 `description` 字段，但当前前端 WorkspaceTask 类型和任务详情抽屉没有把它作为可编辑备注栏暴露给用户。
- **改善点**：把 `description` 明确作为用户可编辑的备注栏。
  - 在任务详情抽屉中增加 `Notes` 多行文本框，支持查看和编辑备注。
  - 任务列表中可用备注图标或摘要提示任务存在备注，但不应挤占主任务名空间。
  - 搜索应可匹配备注内容，便于用户用备注关键词查找任务。
  - 创建任务和子任务时默认备注为空字符串。
  - 日程版本快照、Excel 导入和 AI 上下文应继续保留 `description`，避免恢复版本或 AI 分析时丢失备注。

## 4. Phase 2 准备 (Feature Evolution)

### 4.1 Graph View (PERT图 / 网络图)
- 依据 `packages/contracts` 中定义的依赖数组 (`FS`, `FF` 等)，利用 `d3.js` 或类似图形库实现连线驱动的 Graph View，与现有的甘特图在逻辑上完全解耦并共享核心 Zustand state。

### 4.2 Document Control 与 External Release UI
- 解除 Phase 1 的展示范围限制，在侧边栏结构中挂载新页面，确保审批流程 (Approval flows) 组件在工程标准与 UI 规范的限制内有高度复用性。

### 4.3 无级缩放体验 (Stepless Semantic Zoom)
- 当前提供了 Day/Week/Month 的按键切换。未来改善可融合触控板的双指捏合（Pinch to Zoom）事件，实现平滑刻度切换的视觉体验，而非简单粗暴的状态跳变。
