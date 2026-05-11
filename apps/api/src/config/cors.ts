const DEFAULT_LOCAL_WEB_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export function resolveCorsOrigin(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = env.TASKPULSE_CORS_ORIGIN;
  if (!configured) {
    return DEFAULT_LOCAL_WEB_ORIGINS;
  }

  return [...new Set(
    configured
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )];
}
