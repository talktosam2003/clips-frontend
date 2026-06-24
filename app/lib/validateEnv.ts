// Variables required in every environment (dev, CI, production).
const REQUIRED_ENV_VARS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'APPLE_ID',
  'APPLE_TEAM_ID',
  'APPLE_PRIVATE_KEY',
  'APPLE_KEY_ID',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'NEXT_PUBLIC_SENTRY_DSN',
] as const;

// Additional variables that must be present in production (and CI).
const REQUIRED_PROD_ENV_VARS = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_AI_API_URL',
  'AI_BACKEND_CALLBACK_SECRET',
  'CLOUD_STORAGE_PROVIDER',
  'CLOUD_STORAGE_BUCKET',
  'CLOUD_STORAGE_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
] as const;

type RequiredVar =
  | (typeof REQUIRED_ENV_VARS)[number]
  | (typeof REQUIRED_PROD_ENV_VARS)[number];

function isMissing(value: string | undefined): boolean {
  if (value === undefined || value === null) return true;
  return value.trim().length === 0;
}

function formatError(missing: string[]): string {
  return (
    `Missing required environment variables: ${missing.join(', ')}.\n` +
    `Copy .env.example to .env.local and fill in the missing values.`
  );
}

export function validateRequiredEnv(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const isCI = process.env.CI === 'true';
  const isDevelopment = !isProduction && !isCI;

  // Always check the core auth/session vars.
  const missingCore = (REQUIRED_ENV_VARS as readonly string[]).filter((name) =>
    isMissing(process.env[name])
  );

  // Check production-only vars in prod and CI.
  const missingProd =
    isProduction || isCI
      ? (REQUIRED_PROD_ENV_VARS as readonly string[]).filter((name) =>
          isMissing(process.env[name])
        )
      : [];

  const missing: string[] = [...missingCore, ...missingProd];

  if (missing.length === 0) return;

  const message = formatError(missing);

  if (isDevelopment) {
    // Warn so the dev server still starts, but the problem is visible.
    console.warn(`\n⚠️  [validateEnv] ${message}\n`);
  } else {
    // Hard fail in CI and production — a misconfigured deployment must not proceed.
    throw new Error(message);
  }
}

export { REQUIRED_ENV_VARS, REQUIRED_PROD_ENV_VARS };
export type { RequiredVar };
