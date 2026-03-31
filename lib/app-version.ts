const DEFAULT_VERSION = 'dev';

export function getCurrentAppVersion() {
  return (
    process.env.NEXT_PUBLIC_APP_VERSION ??
    process.env.APP_VERSION ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.npm_package_version ??
    DEFAULT_VERSION
  );
}

export function getLatestAppVersion() {
  return process.env.APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.npm_package_version ?? DEFAULT_VERSION;
}
