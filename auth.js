(function () {
  const SESSION_KEY = 'orcazap_client_session_v1';
  const NEXT_KEY = 'orcazap_client_auth_next_v1';

  function config() {
    return window.ORCAZAP_BACKEND || {};
  }

  function baseUrl() {
    return String(config().supabaseUrl || '').replace(/\/+$/, '');
  }

  function anonKey() {
    return String(config().supabaseAnonKey || '');
  }

  function saveSession(session) {
    if (!session || !session.access_token) return;
    const expiresIn = Number(session.expires_in || 3600);
    const normalized = {
      access_token: session.access_token,
      refresh_token: session.refresh_token || '',
      token_type: session.token_type || 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      user: session.user || null
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
  }

  function readSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function parseHashSession() {
    const hash = String(location.hash || '').replace(/^#/, '');
    if (!hash) return null;

    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    if (!accessToken) return null;

    const session = {
      access_token: accessToken,
      refresh_token: params.get('refresh_token') || '',
      token_type: params.get('token_type') || 'bearer',
      expires_in: Number(params.get('expires_in') || 3600)
    };

    saveSession(session);
    history.replaceState(
      null,
      document.title,
      `${location.pathname}${location.search}`
    );
    return readSession();
  }

  async function refreshSession(session) {
    if (!session?.refresh_token) return null;

    const response = await fetch(
      `${baseUrl()}/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: {
          apikey: anonKey(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refresh_token: session.refresh_token
        })
      }
    );

    if (!response.ok) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    const refreshed = await response.json();
    saveSession(refreshed);
    return readSession();
  }

  async function getSession() {
    parseHashSession();

    let session = readSession();
    if (!session?.access_token) return null;

    const now = Math.floor(Date.now() / 1000);
    if (Number(session.expires_at || 0) <= now + 60) {
      session = await refreshSession(session);
    }

    return session;
  }

  async function getUser() {
    const session = await getSession();
    if (!session) return null;
    if (session.user?.id) return session.user;

    const response = await fetch(`${baseUrl()}/auth/v1/user`, {
      headers: {
        apikey: anonKey(),
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) return null;

    const user = await response.json();
    session.user = user;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return user;
  }

  async function sendMagicLink(email, nextPath) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Informe um e-mail válido.');
    }

    const next = String(nextPath || 'cliente.html');
    localStorage.setItem(NEXT_KEY, next);

    const redirectTo = String(
      config().publicSiteUrl || location.origin
    ).replace(/\/+$/, '');

    const response = await fetch(
      `${baseUrl()}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`,
      {
        method: 'POST',
        headers: {
          apikey: anonKey(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: cleanEmail,
          create_user: true
        })
      }
    );

    const raw = await response.text();
    let payload = null;
    if (raw.trim()) {
      try {
        payload = JSON.parse(raw);
      } catch (_) {
        payload = raw;
      }
    }

    if (!response.ok) {
      throw new Error(
        payload?.msg ||
        payload?.message ||
        'Não foi possível enviar o link de acesso.'
      );
    }

    return true;
  }

  function consumeNextPath() {
    const next = localStorage.getItem(NEXT_KEY) || '';
    localStorage.removeItem(NEXT_KEY);
    return next;
  }

  async function rpc(name, body, options = {}) {
    const authRequired = options.auth === true;
    const session = await getSession();
    const bearer = session?.access_token || anonKey();

    if (authRequired && !session?.access_token) {
      throw new Error('Entre na sua conta para continuar.');
    }

    const response = await fetch(
      `${baseUrl()}/rest/v1/rpc/${name}`,
      {
        method: 'POST',
        headers: {
          apikey: anonKey(),
          Authorization: `Bearer ${bearer}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body || {})
      }
    );

    const raw = await response.text();
    let payload = null;
    if (raw.trim()) {
      try {
        payload = JSON.parse(raw);
      } catch (_) {
        payload = raw;
      }
    }

    if (!response.ok) {
      throw new Error(
        payload?.message ||
        payload?.hint ||
        payload?.msg ||
        'Não foi possível concluir.'
      );
    }

    return payload;
  }

  async function uploadMedia(path, file) {
    const session = await getSession();
    if (!session?.access_token) {
      throw new Error('Entre na conta para enviar fotos.');
    }

    const bucket = config().mediaBucket || 'orcazap-request-media';
    const response = await fetch(
      `${baseUrl()}/storage/v1/object/${bucket}/${path}`,
      {
        method: 'POST',
        headers: {
          apikey: anonKey(),
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': file.type,
          'x-upsert': 'false'
        },
        body: file
      }
    );

    if (!response.ok) {
      const raw = await response.text();
      let message = raw;
      try {
        const payload = JSON.parse(raw);
        message = payload.message || payload.error || raw;
      } catch (_) {}
      throw new Error(message || 'Falha no envio da foto.');
    }

    return true;
  }

  async function downloadMedia(path) {
    const session = await getSession();
    if (!session?.access_token) {
      throw new Error('Entre na conta para abrir as fotos.');
    }

    const bucket = config().mediaBucket || 'orcazap-request-media';
    const response = await fetch(
      `${baseUrl()}/storage/v1/object/authenticated/${bucket}/${path}`,
      {
        headers: {
          apikey: anonKey(),
          Authorization: `Bearer ${session.access_token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Não foi possível carregar a foto.');
    }

    return response.blob();
  }

  async function signOut() {
    const session = await getSession();

    if (session?.access_token) {
      try {
        await fetch(`${baseUrl()}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: anonKey(),
            Authorization: `Bearer ${session.access_token}`
          }
        });
      } catch (_) {}
    }

    localStorage.removeItem(SESSION_KEY);
  }

  window.OrcaClientAuth = {
    init: async function () {
      const parsed = parseHashSession();
      const session = parsed || await getSession();
      return session;
    },
    getSession,
    getUser,
    sendMagicLink,
    consumeNextPath,
    rpc,
    uploadMedia,
    downloadMedia,
    signOut
  };
})();
