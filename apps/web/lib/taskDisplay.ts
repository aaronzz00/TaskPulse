type DisplayableTask = {
  id: string;
  displayId?: string | null;
};

export function getTaskDisplayId(taskOrId: string | DisplayableTask): string {
  const taskId = typeof taskOrId === 'string' ? taskOrId : taskOrId.id;
  const displayId = typeof taskOrId === 'string' ? null : taskOrId.displayId;
  if (displayId?.trim()) {
    return displayId;
  }

  const whisperMatch = taskId.match(/^whisper-(\d+)$/i);
  if (whisperMatch) {
    return `W-${whisperMatch[1]}`;
  }

  return taskId;
}
