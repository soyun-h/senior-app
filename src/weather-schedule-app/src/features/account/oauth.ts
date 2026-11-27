import type { Session } from '@supabase/supabase-js';
import { android } from '../android/bridge';
import { authStorage, cloudOrigin, pendingAuthKey, supabase } from './client';
import { currentLogin, parseCallback, socialLoginOptions, verifierKey, type PendingLogin, type SocialProvider } from './oauthCallback';

let exchange: Promise<void> | undefined;

export async function startSocialLogin(provider: SocialProvider) {
  if (!supabase) throw new Error('로그인 서비스 설정을 확인해 주세요.');
  const redirect = android ? (await android.authRedirect()).redirect : `${window.location.origin}${window.location.pathname}`;
  await cancelSocialLogin();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: socialLoginOptions(provider, redirect) });
  if (error || !data.url) throw new Error('로그인 화면을 열지 못했어요. 다시 시도해 주세요.');
  const authorize = new URL(data.url);
  if (authorize.origin !== cloudOrigin || authorize.pathname !== '/auth/v1/authorize' ||
      authorize.searchParams.get('code_challenge_method')?.toLowerCase() !== 's256') {
    throw new Error('보안 로그인 주소를 확인할 수 없어요.');
  }
  const pending: PendingLogin = { provider, redirect, started: Date.now(), flowId: data.flowId ?? undefined };
  await authStorage.setItem(pendingAuthKey, JSON.stringify(pending));
  try {
    if (android) await android.authLaunch({ url: data.url }); else window.location.assign(data.url);
  } catch {
    await cancelSocialLogin();
    throw new Error('시스템 브라우저를 열지 못했어요.');
  }
}

async function pendingSocialLogin(): Promise<PendingLogin | undefined> {
  const stored = await authStorage.getItem(pendingAuthKey);
  if (stored) return JSON.parse(stored) as PendingLogin;
}

export async function hasPendingSocialLogin() {
  const pending = await pendingSocialLogin();
  if (!pending) return false;
  if (currentLogin(pending)) return true;
  await cancelSocialLogin();
  return false;
}

export async function cancelSocialLogin() {
  const pending = await pendingSocialLogin();
  await authStorage.removeItem(pendingAuthKey);
  await authStorage.removeItem('allit-auth-code-verifier');
  const slot = verifierKey(pending?.flowId);
  if (slot) await authStorage.removeItem(slot);
  if (android) await android.authCallback();
}

function webCallback() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('code') && !url.searchParams.has('error') && !url.hash.includes('access_token')) return undefined;
  // Remove the short-lived code before rendering, analytics or navigation.
  window.history.replaceState(window.history.state, '', url.pathname);
  return url.href;
}

export function finishSocialLogin() {
  if (exchange) return exchange;
  exchange = finish().finally(() => { exchange = undefined; });
  return exchange;
}

async function finish() {
  if (!supabase) return;
  const url = android ? (await android.authCallback()).url : webCallback();
  if (!url) return;
  const pending = await pendingSocialLogin();
  if (!pending) return;
  const result = parseCallback(url, pending);
  if (!result) {
    await cancelSocialLogin();
    throw new Error('로그인 응답을 확인할 수 없어요. 다시 시도해 주세요.');
  }
  if ('cancelled' in result || 'failed' in result) {
    await cancelSocialLogin();
    throw new Error('cancelled' in result ? '로그인이 취소됐어요.' : '소셜 계정을 확인할 수 없어요. 가입에 사용한 제공업체로 다시 시도해 주세요.');
  }
  // Consume before exchange so duplicates and process re-entry cannot repeat it.
  await authStorage.removeItem(pendingAuthKey);
  const { error } = await supabase.auth.exchangeCodeForSession(result.code, pending.flowId ? { flowId: pending.flowId } : undefined);
  if (error) throw new Error('로그인을 완료하지 못했어요. 네트워크와 소셜 계정을 확인해 주세요.');
}

export function singleProvider(session: Session) {
  const identities = session.user.identities ?? [];
  const providers = new Set(identities.map(identity => identity.provider));
  const provider = session.user.app_metadata.provider;
  return (provider === 'google' || provider === 'kakao') && (!providers.size || providers.size === 1 && providers.has(provider));
}
