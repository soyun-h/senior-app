import type { ConfigContext, ExpoConfig } from 'expo/config';
const { siteUrl } = require('./scripts/deployment-config.cjs') as { siteUrl(value: string): URL };

export default ({ config }: ConfigContext): Partial<ExpoConfig> => process.env.ALLIT_PAGES_BUILD === '1'
  ? { ...config, experiments: { ...config.experiments,
    baseUrl: siteUrl(process.env.EXPO_PUBLIC_ALLIT_SITE_URL ?? '').pathname.replace(/\/$/, '') } }
  : config;
