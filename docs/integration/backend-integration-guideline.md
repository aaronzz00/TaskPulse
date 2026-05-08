# AuriPath - 前后端整合 Guideline (Backend Integration Guideline)

## 1. 架构目标
平滑替换目前的纯前端存储与 Mock API (`services/api.ts`)，接入真实的后端服务。核心要求是**不破坏当前的高优交互体验**（如包含自动排程的乐观更新、拖拽流畅度），同时保证前后端数据的一致性。

## 2. DTO 与数据契约对齐 (Contracts Alignment)
前端应用目前基于内部定义的 `Task` 和 `Project` 类型。
- **强制要求**：引入并在全端共享 `packages/contracts` 中的接口定义。
- 字段映射：留意日期字段的序列化处理。前端组件（如输入框、Canvas）通常依赖 `YYYY-MM-DD` 格式的字符串，若后端传输 ISO 8601 DateTime 或 Unix Timestamp，必须在 HTTP Client 的拦截器（Interceptor）中进行统一转换，避免业务代码中到处 `new Date()`。

## 3. 状态管理与乐观更新机制改造
当前 `store/useStore.ts` 已经实现了带有”自动排程推演“的本地状态更新。接入后端时，网络请求具有延迟与失败风险，需进行如下改造：

### 3.1 状态回滚 (State Rollback)
- **机制**：在执行 `api.updateTask` 之前，深拷贝当前的 `tasks` 状态，如果在 `try/catch` 中捕获到网络错误，或者后端返回校验失败，立即将画面状态恢复为深拷贝前的数据，并抛出 Toast 错误提示。
  
### 3.2 批量更新接口 (Batch Update)
- **场景**：目前的自动排程引擎（Auto-Scheduling Engine）一旦侦测到前置节点受更改，会连带更新所有下游依赖节点。如果是 100 个节点发生级联推演，绝对不能发起 100 次 PATCH 请求。
- **方案**：后端必须提供 `PATCH /tasks/batch` 或类似的批量更新 API。前端在 `useStore` 的排程计算完毕后，收集所有 dirty 状态（发生属性变更）的 Task，将其汇总为一个 Payload 一次性同步给服务端。

## 4. 网络层 (HTTP Client) 封装
替换目前的模拟 `fetch`：
- **认证 (Authentication)**：配置 `axios` 或原生 `fetch` 拦截器，自动携带 Bearer Token，统一处理 401 Unauthorized 回调。
- **重试机制 (Retry Logic)**：在拖拽层级、重要依赖变更等高价值操作中，如果遭遇网络抖动 (50x 错误)，应结合 `exponential backoff` (指数退避) 算法在后台完成静默重试。

## 5. 多端实时同步 (Real-time Sync) [如适用]
若 AuriPath 支持多 PM / 工程师协同排期：
- **引入 WebSocket/SSE**：订阅 `Workspace_Update` 等事件。
- **竞态条件处理**：避免别人推过来的更新覆盖掉当前用户正在进行的拖拽操作。可以锁定正在编辑的记录 (Record Lock)，或使用基于版本的乐观锁冲突解决策略。
