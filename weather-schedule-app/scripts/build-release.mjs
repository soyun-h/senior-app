import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import deployment from './deployment-config.cjs';

const task = process.argv[2];
if (!['pages', 'android'].includes(task)) throw new Error('Choose pages or android.');
const root = fileURLToPath(new URL('..', import.meta.url));
const envFile = new URL('../.env.release.local', import.meta.url);
const publicKeys = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_ALLIT_SITE_URL'];
if (!publicKeys.some(key => process.env[key]) && existsSync(envFile)) process.loadEnvFile(envFile);
deployment.supabaseConfig(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
deployment.siteUrl(process.env.EXPO_PUBLIC_ALLIT_SITE_URL);
deployment.weatherUrl(process.env.EXPO_PUBLIC_WEATHER_API_URL);
deployment.privacyDetails(process.env);

const env = {
  ...process.env,
  EXPO_NO_DOTENV: '1',
  EXPO_PUBLIC_ALLIT_ACCOUNT_REQUIRED: '1',
  EXPO_PUBLIC_ALLIT_ENVIRONMENT: 'release',
  ALLIT_ANDROID_MODE: 'local',
  ALLIT_PAGES_BUILD: task === 'pages' ? '1' : '0',
};
const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', task === 'pages' ? 'build:web:local' : 'android:sync'],
  { cwd: root, env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
