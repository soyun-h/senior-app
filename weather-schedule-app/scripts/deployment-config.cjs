function siteUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash ||
      ['localhost', '127.0.0.1'].includes(url.hostname) ||
      !/^\/(?:[A-Za-z0-9_][A-Za-z0-9_.-]*\/)*$/.test(url.pathname.endsWith('/') ? url.pathname : url.pathname + '/')) {
    throw new Error('Provide an HTTPS Pages site URL with a valid path.');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

function supabaseConfig(rawUrl, key) {
  const match = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(rawUrl ?? '');
  if (!match || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key ?? '')) {
    throw new Error('Provide the hosted Supabase Project URL and an sb_publishable_ key.');
  }
  return { ref: match[1], origin: `https://${match[1]}.supabase.co` };
}

function weatherUrl(value) {
  if (!value) return undefined;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Provide an HTTPS weather endpoint without credentials, query or fragment.');
  }
  return url;
}

function privacyDetails(env) {
  const operator = env.ALLIT_PUBLIC_OPERATOR?.trim();
  const email = env.ALLIT_PUBLIC_PRIVACY_EMAIL?.trim();
  const retention = env.ALLIT_PUBLIC_RETENTION?.trim();
  if (!operator || !email || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email) || !retention) {
    throw new Error('Set ALLIT_PUBLIC_OPERATOR, ALLIT_PUBLIC_PRIVACY_EMAIL and ALLIT_PUBLIC_RETENTION for a release build.');
  }
  return { operator, email, retention };
}

module.exports = { siteUrl, supabaseConfig, weatherUrl, privacyDetails };
