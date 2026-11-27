export type SocialProvider = 'google' | 'kakao';
export type PendingLogin = { provider: SocialProvider; redirect: string; started: number; flowId?: string };
export type Callback = { code: string } | { cancelled: true } | { failed: true };

export function verifierKey(flowId: unknown) {
  return typeof flowId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(flowId)
    ? `allit-auth-flow-${flowId}-code-verifier` : undefined;
}

export function currentLogin(pending: PendingLogin, now = Date.now()) {
  return Number.isFinite(pending.started) && pending.started <= now && now - pending.started <= 15 * 60_000;
}

export function socialLoginOptions(provider: SocialProvider, redirectTo: string) {
  return {
    redirectTo,
    skipBrowserRedirect: true,
    // Supabase adds account_email to the built-in Kakao scopes. The OAuth
    // scope query parameter replaces that list instead of appending to it.
    queryParams: provider === 'kakao' ? { scope: 'profile_nickname profile_image' } : undefined,
  };
}

export function parseCallback(url: string, pending: PendingLogin, now = Date.now()): Callback | undefined {
  if (!currentLogin(pending, now) || url.length > 2500) return undefined;
  let returned: URL;
  let expected: URL;
  try { returned = new URL(url); expected = new URL(pending.redirect); } catch { return undefined; }
  if (returned.protocol !== expected.protocol || returned.host !== expected.host || returned.pathname !== expected.pathname ||
      returned.username || returned.password || returned.hash || [...returned.searchParams.keys()].some(
        key => !['code', 'error', 'error_code', 'error_description'].includes(key))) return undefined;
  const codes = returned.searchParams.getAll('code');
  const errors = returned.searchParams.getAll('error');
  if (!codes.length && errors.length === 1) return errors[0] === 'access_denied' ? { cancelled: true } : { failed: true };
  if (errors.length || codes.length !== 1 || !/^[A-Za-z0-9_-]{1,1024}$/.test(codes[0])) return undefined;
  return { code: codes[0] };
}
