import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { load } from '@expo/env';
import deployment from './deployment-config.cjs';

load(fileURLToPath(new URL('..', import.meta.url)), { silent: true });
const project = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
const cloud = project || key || process.env.EXPO_PUBLIC_ALLIT_ACCOUNT_REQUIRED === '1'
  ? deployment.supabaseConfig(project, key) : undefined;
const htmlFile = new URL('../dist/index.html', import.meta.url);
const index = await readFile(htmlFile, 'utf8');
const weather = process.env.EXPO_PUBLIC_WEATHER_API_URL?.trim();
const localWeather = weather && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(weather) &&
  process.env.EXPO_PUBLIC_ALLIT_ENVIRONMENT !== 'release' ? new URL(weather) : undefined;
const destinations = [(localWeather ?? deployment.weatherUrl(weather))?.origin, cloud?.origin].filter(Boolean).join(' ');
const policy = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self' ${destinations}; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`;
const secured = index.replace(/<head(?:\s[^>]*)?>/i, head => `${head}\n<meta http-equiv="Content-Security-Policy" content="${policy}">\n<meta name="referrer" content="no-referrer">`);
if (secured === index) throw new Error('The Expo HTML template has no head element');
await writeFile(htmlFile, secured);
await writeFile(new URL('../dist/delete-account.html', import.meta.url), secured.replace(/<title>[^<]*<\/title>/i, '<title>올잇 계정 및 데이터 삭제</title>'));
if (process.env.EXPO_PUBLIC_ALLIT_ENVIRONMENT === 'release') {
  const path = new URL('../dist/privacy.html', import.meta.url);
  const privacy = await readFile(path, 'utf8');
  const { operator, email, retention } = deployment.privacyDetails(process.env);
  const escape = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const values = {
    introduction: '이 개인정보 처리방침은 올잇의 계정 및 사용자 데이터 처리 방식을 설명합니다.',
    retention: escape(retention),
    operator: `운영자 ${escape(operator)} · 개인정보 문의 ${escape(email)}. 계정 삭제는 아래 온라인 절차에서 요청할 수 있습니다.`,
  };
  let rendered = privacy;
  for (const [name, value] of Object.entries(values)) {
    const pattern = new RegExp(`(<p data-release="${name}">)[^<]*(</p>)`);
    if (!pattern.test(rendered)) throw new Error(`Missing privacy template section ${name}.`);
    rendered = rendered.replace(pattern, (_match, open, close) => open + value + close);
  }
  await writeFile(path, rendered);
}
