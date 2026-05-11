-- Add a project-scoped human-readable task identifier.
ALTER TABLE "Task" ADD COLUMN "displayId" TEXT;

CREATE UNIQUE INDEX "Task_projectId_displayId_key" ON "Task"("projectId", "displayId");
