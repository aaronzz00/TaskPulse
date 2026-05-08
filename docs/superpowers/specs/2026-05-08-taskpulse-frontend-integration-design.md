# TaskPulse Frontend Integration Design

## Goal

Replace the existing TaskPulse frontend with the new Next.js interface while keeping the NestJS backend, improving repository structure, applying the provided icon set, and adding system-level verification.

## Current Context

The source backend lives in a local non-Git monorepo with `apps/api`, `packages/shared`, and a legacy `apps/web` Vite frontend. The target GitHub repository currently contains the new standalone Next.js frontend plus two integration guideline documents under `docs/`.

The final repository will be the GitHub `TaskPulse` repository. The local non-Git folder remains the source for backend code and icon assets during migration.

## Architecture

The integrated repository will be a pnpm/turbo monorepo:

```text
apps/
  api/          NestJS API, Prisma schema, migrations, seed script
  web/          Next.js frontend replacing the old Vite frontend
packages/
  contracts/   Shared task/project/dependency contracts and mapping helpers
assets/
  icons/        Source icon assets copied from the local design set
docs/
  integration/ Existing frontend/backend integration guidelines
```

The frontend will call the NestJS API through a focused client layer. UI components will consume frontend-friendly date strings (`YYYY-MM-DD`), while the API and Prisma continue to persist dates as ISO-compatible `DateTime` values. The contract package owns those conversions so UI files do not scatter date parsing.

## Backend Integration

The existing backend routes are kept:

- `GET /projects`
- `GET /projects/:id`
- `GET /tasks?projectId=...`
- `POST /tasks`
- `PATCH /tasks/:id`
- `DELETE /tasks/:id`
- `GET /dependencies`
- `POST /dependencies`
- `PATCH /dependencies/:id`
- `DELETE /dependencies/:id`

One new endpoint is added:

- `PATCH /tasks/batch`

The batch endpoint accepts multiple task updates from the frontend auto-scheduling engine and applies them in one transaction. This avoids sending one request per downstream task after a schedule cascade.

## Frontend State

The Next.js frontend keeps the new workspace layout and canvas Gantt interaction, but the mock API is replaced. Store actions will:

- fetch the first available project and its tasks from the backend;
- map backend tasks plus dependency rows into the UI task shape;
- create/update/delete tasks through HTTP;
- optimistically update edits and roll back on failed network responses;
- use `PATCH /tasks/batch` when a date change cascades to multiple dependent tasks.

The AI sidebar remains present but any mock-only behavior is clearly isolated from persisted project data unless it creates a real task through the API.

## Icons

Provided icons are copied into:

- `assets/icons/` for original source retention;
- `apps/web/public/icons/` for browser runtime use.

Next metadata and web app manifest references will use these files for favicon, Apple touch icon, and maskable/web icons.

## Tests

Verification includes three layers:

- Contract/unit tests for date and dependency mapping helpers.
- Backend tests for task batch update behavior.
- Frontend/system tests that build the Next app and exercise the integrated page against the backend with seeded data.

If full end-to-end browser testing is blocked by environment limits, the fallback is a documented build plus API smoke test matrix with exact commands and observed results.

## Risks

- The source folder is not a Git repository, so GitHub updates must happen from a cloned target repository.
- The new frontend uses Next 15, React 19, Tailwind 4, and npm lockfile conventions, while the backend source uses pnpm/turbo. The final repository standardizes on pnpm/turbo and may regenerate lockfiles.
- Current backend task dependency relations are stored separately from task update payloads. Dependency editing from the drawer may need focused API orchestration instead of stuffing dependencies into `PATCH /tasks/:id`.

## Acceptance Criteria

- Repository structure is clean and monorepo-based.
- New Next frontend replaces the old Vite frontend.
- Frontend uses real backend APIs for projects and tasks.
- Provided icons are wired into app metadata/manifest.
- Batch task update exists and is tested.
- Build/test commands are documented and run before completion.
- Integrated result is committed and pushed to GitHub.
