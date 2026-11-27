import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import deployment from './deployment-config.cjs';

const version = '3.4.0';
const app = fileURLToPath(new URL('..', import.meta.url));
const source = fileURLToPath(new URL('../../supabase/', import.meta.url));
const args = process.argv.slice(2);
const planOnly = args.includes('--plan');
const interactive = process.stdin.isTTY && process.stdout.isTTY;
let input;
let workdir;
const cliEnv = { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' };
delete cliEnv.SUPABASE_YES;

function cli(args, { interactive = false } = {}) {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'exec', '--yes', `--package=supabase@${version}`, '--',
    'supabase', ...args, ...(workdir ? ['--workdir', workdir] : [])], {
    cwd: workdir ?? app,
    env: cliEnv,
    encoding: 'utf8',
    stdio: interactive ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    timeout: 240_000,
  });
  if (result.error) throw new Error(`Supabase CLI could not run ${args.slice(0, 2).join(' ')} (${result.error.code ?? 'error'}).`);
  if (result.status !== 0) {
    const details = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (/AccessTokenRequired|Access token not provided/i.test(details)) {
      throw new Error(`Supabase CLI authentication required. Run npx supabase@${version} login, then retry.`);
    }
    if (/DbConfigIpv6Error|IPv6 is not supported|password authentication failed|Database password/i.test(details)) {
      throw new Error('Database connection failed. See RELEASE_GUIDE.md for the Session pooler and secure password input.');
    }
    const code = details.match(/"code"\s*:\s*"([A-Za-z0-9_]+)"/)?.[1];
    throw new Error(`Supabase CLI failed at ${args.slice(0, 2).join(' ')}${code ? ` (${code})` : ''}.`);
  }
  return result.stdout?.trim() ?? '';
}

function json(args) {
  return JSON.parse(cli([...args, '--output-format', 'json']));
}

async function ask(name, label, { optional = false } = {}) {
  if (process.env[name]?.trim()) return process.env[name].trim();
  if (!interactive && optional) return '';
  if (!interactive) throw new Error(`Set ${name}, or run the setup in an interactive terminal.`);
  const value = (await input.question(`${label}: `)).trim();
  if (!value && !optional) throw new Error(`${label} is required.`);
  return value;
}

async function verifyProjectKey(origin, key) {
  const response = await fetch(`${origin}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(12000) });
  if (!response.ok || response.headers.get('sb-project-ref') !== new URL(origin).hostname.split('.')[0]) {
    throw new Error(`The Project URL and Publishable Key could not be verified (HTTP ${response.status}).`);
  }
  return response.json();
}

async function existingEnv(path) {
  try { return parseEnv(await readFile(path, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return {}; }
}

function dotenvLine(name, value) {
  for (const quote of ['', "'", '"', '`']) {
    if (quote && value.includes(quote)) continue;
    const line = `${name}=${quote}${value}${quote}\n`;
    if (parseEnv(line)[name] === value) return line;
  }
  throw new Error(`Move ${name} to the build environment before rewriting the local file.`);
}

function assertPreview(output, ref) {
  if (output.target?.project_ref !== ref || output.target?.environment !== 'production') {
    throw new Error('The Supabase target does not match the selected hosted project.');
  }
}

function authConfig(base, site, redirects) {
  const siteSetting = site ? `site_url = ${JSON.stringify(site.href)}\n` : '';
  return `${base.trimEnd()}\n\n[auth]\n${siteSetting}additional_redirect_urls = ${JSON.stringify(redirects)}\n`;
}

function acceptChanges(diff) {
  const allowed = new Set(['auth.site_url', 'auth.additional_redirect_urls']);
  const declared = diff.changes.filter(change => change.declared && change.class !== 'remote_only');
  if (declared.some(change => !allowed.has(change.path.join('.')))) {
    throw new Error('Unexpected hosted configuration change. Review the Auth preview before applying.');
  }
  return declared;
}

function checkConflicts(catalog, pending) {
  const basePending = pending.includes('202611270001_account_data.sql');
  const aiPending = pending.includes('202611270003_ai_foundation.sql');
  if (!catalog.storage_rls || catalog.storage_owner_id_type !== 'text') throw new Error('Unexpected Supabase Storage schema.');
  if (basePending && (catalog.tables.some(t => t.schema !== 'allit_ai' && t.exists) ||
      catalog.internal_schemas.includes('allit_private') || catalog.bucket || catalog.rpcs.some(r => r.exists) || catalog.social_identity_trigger)) {
    throw new Error('The migration history and existing app schema conflict. Review the target database before applying.');
  }
  if (basePending && catalog.existing_multi_provider_accounts > 0) {
    throw new Error('The target has existing users with multiple login providers. Review the identity trigger impact before applying.');
  }
  if (aiPending && (!catalog.vector_available || (catalog.vector_schema && catalog.vector_schema !== 'extensions') ||
      catalog.internal_schemas.includes('allit_ai'))) {
    throw new Error('The target pgvector installation or private AI schema needs review before applying.');
  }
}

function verifyCatalog(catalog) {
  const bucket = catalog.bucket;
  const storagePolicies = catalog.policies.filter(p => p.schemaname === 'storage').map(p => p.policyname);
  if (catalog.tables.length !== 11 || catalog.tables.some(t => !t.exists || t.relation_type !== 'r' ||
      (t.schema !== 'allit_private' && !t.rls)) ||
      catalog.policies.filter(p => p.schemaname === 'public' && p.policyname === 'allit_owner').length !== 8 ||
      catalog.indexes.filter(i => i.name.startsWith('allit_') && i.valid).length !== 5 ||
      catalog.indexes.some(i => !i.valid) ||
      !['allit_photo_read', 'allit_photo_insert', 'allit_photo_delete'].every(name => storagePolicies.includes(name)) ||
      !catalog.storage_rls || !catalog.social_identity_trigger || !catalog.onboarding_column ||
      catalog.vector_schema !== 'extensions' || !catalog.rag_api_hidden ||
      bucket?.public !== false || bucket.size_limit !== 1048576 || bucket.mime_types?.join(',') !== 'image/jpeg' ||
      catalog.rpcs.some(r => !r.exists || r.anon_execute) ||
      catalog.rpcs.filter(r => r.authenticated_execute).length !== 2 ||
      catalog.rpcs.some(r => /account_deletion|photo_paths/.test(r.signature) && (r.authenticated_execute || !r.service_role_execute))) {
    throw new Error('The hosted schema differs from the expected migrations. Inspect the database before building the app.');
  }
}

async function apiChecks(origin, key, site, profile) {
  async function request(path, options) {
    return fetch(`${origin}${path}`, { ...options, signal: AbortSignal.timeout(12000), headers: {
      apikey: key, ...options?.headers,
    } });
  }
  const callerOrigins = ['https://localhost'];
  if (profile === 'development') callerOrigins.push('http://localhost:8080');
  if (site) callerOrigins.push(site.origin);
  const preflight = caller => request('/functions/v1/delete-account', { method: 'OPTIONS', headers: {
    Origin: caller, 'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'authorization, apikey, x-client-info, content-type',
  } });
  for (let attempt = 0; attempt < 6; attempt++) {
    const [profiles, schedules, anonymous, ...options] = await Promise.all([
      request('/rest/v1/profiles?select=user_id&limit=0'),
      request('/rest/v1/schedules?select=id&limit=0'),
      request('/functions/v1/delete-account', { method: 'POST', headers: { Origin: 'https://localhost', 'Content-Type': 'application/json' }, body: '{}' }),
      ...callerOrigins.map(preflight),
    ]);
    const denied = async response => [401, 403].includes(response.status) && (await response.json()).code === '42501';
    const [profilesDenied, schedulesDenied] = await Promise.all([denied(profiles), denied(schedules)]);
    const allowed = options.every((response, i) => {
      const headers = new Set((response.headers.get('access-control-allow-headers') ?? '').toLowerCase().split(',').map(name => name.trim()));
      return response.status === 204 && response.headers.get('access-control-allow-origin') === callerOrigins[i] &&
        ['authorization', 'apikey', 'x-client-info', 'content-type'].every(name => headers.has(name));
    });
    if (profilesDenied && schedulesDenied && allowed && [401, 403].includes(anonymous.status)) return;
    if (attempt === 5) throw new Error(`API verification failed (profiles ${profiles.status}, schedules ${schedules.status}, function OPTIONS ${options.map(response => response.status).join('/')}, anonymous POST ${anonymous.status}).`);
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
}

function printOAuth(origin, site, settings) {
  console.log(`Google and Kakao callback: ${origin}/auth/v1/callback`);
  if (site) {
    console.log(`Google authorized web origin: ${site.origin}`);
    console.log(`Supabase Site URL: ${site.href}`);
    console.log(`Account deletion: ${new URL('delete-account.html', site).href}`);
  }
  console.log(`Provider status: Google ${settings.external?.google ? 'enabled' : 'needs setup'}, Kakao ${settings.external?.kakao ? 'enabled' : 'needs setup'}.`);
  console.log('Configure provider credentials and Kakao email-optional login as described in RELEASE_GUIDE.md.');
}

async function main() {
  if (args.includes('--help')) {
    console.log('npm run setup:supabase -- [--plan]\nSee RELEASE_GUIDE.md for environment inputs and permissions.');
    return;
  }
  if (args.some(arg => arg !== '--plan')) throw new Error('Unknown option. Use --help.');
  if (cli(['--version']) !== version) throw new Error(`Supabase CLI ${version} is required.`);
  if (interactive) input = createInterface({ input: process.stdin, output: process.stdout });

  const profile = await ask('ALLIT_SETUP_PROFILE', 'Profile (development or release)');
  if (!['development', 'release'].includes(profile)) throw new Error('Use development or release.');
  if (!interactive && !planOnly) throw new Error('Applying changes requires an interactive terminal and explicit confirmation.');
  const rawUrl = await ask('ALLIT_SETUP_SUPABASE_URL', 'Supabase Project URL');
  const ref = await ask('ALLIT_SETUP_PROJECT_REF', 'Supabase Project ID');
  const key = await ask('ALLIT_SETUP_PUBLISHABLE_KEY', 'Supabase Publishable Key');
  const cloud = deployment.supabaseConfig(rawUrl, key);
  if (ref !== cloud.ref) throw new Error('Project ID and URL do not match.');
  const output = join(app, profile === 'release' ? '.env.release.local' : '.env.development.local');
  const current = await existingEnv(output);
  const siteInput = await ask('ALLIT_SETUP_SITE_URL',
    profile === 'development' ? 'Public HTTPS site URL (optional for embedded APK tests)' : 'Public HTTPS site URL',
    { optional: profile === 'development' });
  const siteValue = siteInput || current.EXPO_PUBLIC_ALLIT_SITE_URL;
  const site = siteValue ? deployment.siteUrl(siteValue) : undefined;
  const weatherInput = await ask('ALLIT_SETUP_WEATHER_API_URL', 'Weather Worker URL (optional, Enter keeps the saved value)', { optional: true });
  const weather = deployment.weatherUrl(weatherInput || current.EXPO_PUBLIC_WEATHER_API_URL);
  if (current.EXPO_PUBLIC_SUPABASE_URL && current.EXPO_PUBLIC_SUPABASE_URL.replace(/\/$/, '') !== cloud.origin) {
    throw new Error('The selected profile already targets another project. Move its local settings aside before continuing.');
  }
  const otherPaths = profile === 'release' ? ['.env.development.local', '.env.local'] : ['.env.release.local'];
  for (const path of otherPaths) {
    const other = await existingEnv(join(app, path));
    if (other.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') === cloud.origin) {
      throw new Error('Development and release must use different Supabase projects.');
    }
  }
  const publicValues = {
    EXPO_PUBLIC_SUPABASE_URL: cloud.origin,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
    EXPO_PUBLIC_ALLIT_SITE_URL: site?.href ?? '',
    EXPO_PUBLIC_WEATHER_API_URL: weather?.href ?? '',
    EXPO_PUBLIC_WEATHER_MODE: 'live',
  };
  for (const name of ['ALLIT_PUBLIC_OPERATOR', 'ALLIT_PUBLIC_PRIVACY_EMAIL', 'ALLIT_PUBLIC_RETENTION']) {
    if (current[name]) publicValues[name] = current[name];
  }
  const content = `# Allit ${profile} public build configuration\n` +
    Object.entries(publicValues).map(([name, value]) => dotenvLine(name, value)).join('');

  const projects = JSON.parse(cli(['projects', 'list', '--output', 'json']));
  const target = projects.find(project => (project.ref ?? project.id) === ref);
  if (!target || target.status !== 'ACTIVE_HEALTHY') throw new Error('The selected project is not available and healthy for this Supabase account.');
  const settings = await verifyProjectKey(cloud.origin, key);
  console.log(`Target: ${JSON.stringify(target.name)} (${ref}), ${profile}, ${cloud.origin}`);
  console.log(site ? `Web: ${site.href}` : 'Web: leave the existing Site URL as configured (embedded APK test).');
  if (!planOnly && await input.question(`Type the project ID ${ref} to start preflight: `) !== ref) {
    console.log('Setup stopped before linking.');
    return;
  }

  workdir = await mkdtemp(join(tmpdir(), 'allit-supabase-'));
  const working = join(workdir, 'supabase');
  await cp(source, working, { recursive: true, filter: path => !['.temp', '.branches'].includes(path.split(/[\\/]/).at(-1)) &&
    !/^\.env(?:\.|$)/.test(path.split(/[\\/]/).at(-1)) });
  cli(['link', '--project-ref', ref]);
  const linkedRef = (await readFile(join(working, '.temp', 'project-ref'), 'utf8')).trim();
  if (linkedRef !== ref) throw new Error('The temporary work directory linked to a different project.');
  const history = json(['migration', 'list', '--remote']);
  assertPreview(history, ref);
  const pending = json(['db', 'push', '--remote', '--dry-run', '--skip-vault']);
  assertPreview(pending, ref);
  if (!pending.dryRun || !Array.isArray(pending.migrations) || pending.seeds?.length || pending.roles?.length) {
    throw new Error('Unexpected migration plan. Review the target before applying.');
  }
  const inspect = () => {
    const result = json(['db', 'query', `--remote=${ref}`, '--read-only', '--file', join(working, 'tests', 'inspect_catalog.sql')]);
    return result.rows[0].catalog;
  };
  const catalog = inspect();
  checkConflicts(catalog, pending.migrations);

  const configPath = join(working, 'config.toml');
  const config = await readFile(configPath, 'utf8');
  const localProjectId = config.match(/^project_id\s*=\s*".+"$/m)?.[0];
  if (!localProjectId) throw new Error('Missing the local Supabase project identifier.');
  const redirects = ['com.allitcare.android.oauth://auth/callback'];
  if (site) redirects.push(site.href, new URL('index.html', site).href, new URL('delete-account.html', site).href);
  if (profile === 'development') redirects.push('com.allitcare.android.debug.oauth://auth/callback',
    'http://localhost:8080/', 'http://localhost:8080/delete-account.html',
    'http://localhost:8090/', 'http://localhost:8090/delete-account.html');
  const configDiff = () => json(['config', 'diff', `--remote=${ref}`]);
  await writeFile(configPath, authConfig(localProjectId, site, redirects));
  const initial = acceptChanges(configDiff());
  const previous = initial.find(change => change.path[1] === 'additional_redirect_urls')?.remote;
  if (previous !== undefined && previous !== null && !Array.isArray(previous)) throw new Error('Unexpected Auth redirect settings.');
  const merged = [...new Set([...(previous ?? []), ...redirects])];
  await writeFile(configPath, authConfig(localProjectId, site, merged));
  const authChanges = acceptChanges(configDiff());
  const funcs = (await readdir(join(working, 'functions'), { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^[a-z0-9][a-z0-9-]*$/.test(entry.name)).map(entry => entry.name).sort();
  if (!funcs.length) throw new Error('No versioned Edge Functions found.');

  console.log(`Applied migration count: ${history.migrations.filter(m => m.remote).length}`);
  console.log(`Pending migrations: ${pending.migrations.join(', ') || 'none'}`);
  console.log(`Auth changes: ${authChanges.map(change => change.path.join('.')).join(', ') || 'none'}`);
  console.log(`Required redirects:\n  ${redirects.join('\n  ')}`);
  console.log(`Edge Functions: ${funcs.join(', ')} | Android origin: https://localhost${site ? ` | Pages origin: ${site.origin}` : ''}`);
  if (planOnly) {
    printOAuth(cloud.origin, site, settings);
    console.log('Preview complete. No migrations, Auth settings, secrets, or Edge Functions were applied.');
    return;
  }
  if (await input.question(`Type "apply ${ref}" to apply this plan: `) !== `apply ${ref}`) {
    console.log('Setup stopped before applying remote changes.');
    return;
  }
  if (pending.migrations.length) {
    const latest = json(['db', 'push', '--remote', '--dry-run', '--skip-vault']);
    assertPreview(latest, ref);
    if (JSON.stringify(latest.migrations) !== JSON.stringify(pending.migrations)) throw new Error('The migration plan changed. Rerun the setup.');
    cli(['db', 'push', '--remote', '--skip-vault', '--yes']);
  }
  const applied = json(['migration', 'list', '--remote']);
  assertPreview(applied, ref);
  if (applied.migrations.some(m => m.local && m.local !== m.remote)) {
    throw new Error('One or more local migrations are missing from the hosted history.');
  }
  verifyCatalog(inspect());
  const authNow = acceptChanges(configDiff());
  if (JSON.stringify(authNow) !== JSON.stringify(authChanges)) throw new Error('The Auth plan changed. Rerun the setup to review it.');
  if (authChanges.length) cli(['config', 'push', `--remote=${ref}`, '--yes']);
  if (acceptChanges(configDiff()).length) throw new Error('Hosted Auth settings could not be verified.');
  await writeFile(configPath, config);

  const secrets = join(workdir, 'edge.env');
  const webOrigin = site ? `ALLIT_WEB_ORIGIN=${site.origin}\n` : '';
  await writeFile(secrets, `${webOrigin}ALLIT_EDGE_ALLOW_LOCAL_DEV=${profile === 'development' ? '1' : '0'}\n`, { mode: 0o600 });
  cli(['secrets', 'set', `--remote=${ref}`, '--env-file', secrets, '--yes']);
  cli(['functions', 'deploy', ...funcs, `--remote=${ref}`, '--use-api', '--yes']);
  const deployed = JSON.parse(cli(['functions', 'list', `--remote=${ref}`, '--output', 'json']));
  if (!funcs.every(slug => deployed.some(fn => fn.slug === slug && fn.status === 'ACTIVE'))) {
    throw new Error('One or more Edge Functions are not active.');
  }
  await apiChecks(cloud.origin, key, site, profile);

  const temporary = `${output}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, content, { mode: 0o600, flag: 'wx' });
    await rename(temporary, output);
  } finally { await rm(temporary, { force: true }); }
  printOAuth(cloud.origin, site, await verifyProjectKey(cloud.origin, key));
  console.log(`Verified database, private bucket, functions and unauthenticated API responses. Wrote ${output}.`);
}

try { await main(); }
catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  input?.close();
  if (workdir) await rm(workdir, { recursive: true, force: true });
}
