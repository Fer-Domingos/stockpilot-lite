import packageJson from '@/package.json';

export function getAppVersion() {
  return process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? packageJson.version;
}
