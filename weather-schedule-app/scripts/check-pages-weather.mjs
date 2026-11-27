import deployment from './deployment-config.cjs';
import { parseEnvelope, SEOUL, usable } from '../shared/kma.ts';

const site = deployment.siteUrl(process.env.EXPO_PUBLIC_ALLIT_SITE_URL);
const endpoint = deployment.weatherUrl(process.env.EXPO_PUBLIC_WEATHER_API_URL);
if (!endpoint) throw new Error('Set EXPO_PUBLIC_WEATHER_API_URL to the deployed weather Worker before publishing Pages.');

endpoint.searchParams.set('x', String(SEOUL.x));
endpoint.searchParams.set('y', String(SEOUL.y));
const response = await fetch(endpoint, { headers: { Origin: site.origin }, signal: AbortSignal.timeout(25_000) });
const body = await response.json().catch(() => null);
if (response.status === 403 || response.headers.get('Access-Control-Allow-Origin') !== site.origin) {
  throw new Error(`Weather Worker did not allow ${site.origin} (HTTP ${response.status}). Add the site origin to the deployed Worker ALLOWED_ORIGINS.`);
}
if (!response.ok) {
  const code = typeof body?.error === 'string' && /^[A-Z_]+$/.test(body.error) ? ` ${body.error}` : '';
  throw new Error(`Weather Worker could not return KMA weather for ${site.origin} (HTTP ${response.status}${code}).`);
}
const weather = parseEnvelope(body);
if (weather.grid.x !== SEOUL.x || weather.grid.y !== SEOUL.y || !usable(weather)) {
  throw new Error('Weather Worker returned unusable data for the Seoul fallback grid.');
}
console.log(`Weather Worker served valid KMA data to ${site.origin}.`);
