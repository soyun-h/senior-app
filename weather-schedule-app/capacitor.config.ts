import type { CapacitorConfig } from '@capacitor/cli';

const { siteUrl } = require('./scripts/deployment-config.cjs') as { siteUrl(value: string): URL };
const mode = process.env.ALLIT_ANDROID_MODE ?? 'local';
if (!['local', 'live', 'pages'].includes(mode)) throw new Error('Invalid ALLIT_ANDROID_MODE');
const pages = mode === 'pages' ? siteUrl(process.env.EXPO_PUBLIC_ALLIT_SITE_URL ?? '') : undefined;

const config: CapacitorConfig = {
  appId: 'com.allitcare.android',
  appName: '올잇',
  webDir: 'dist',
  loggingBehavior: 'none',
  android: { path: 'capacitor-android' },
  server: pages ? { url: pages.origin, appStartPath: pages.pathname, errorPath: 'offline.html' }
    : mode === 'live' ? { url: 'http://127.0.0.1:8090', cleartext: true, errorPath: 'offline.html' }
    : { androidScheme: 'https', hostname: 'localhost' },
};

export default config;
