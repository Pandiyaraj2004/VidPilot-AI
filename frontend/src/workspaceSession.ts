type SessionStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const key = 'vidpilot-session';

function read(store: SessionStore): string | null {
  try { return store.getItem(key); } catch { return null; }
}

export function clearWorkspaceSession(persistent: SessionStore, tab: SessionStore): void {
  for (const store of [persistent, tab]) {
    try { store.removeItem(key); } catch { /* Storage can be disabled by browser policy. */ }
  }
}

export function rememberWorkspaceSession(token: string, persistent: SessionStore, tab: SessionStore): void {
  for (const store of [persistent, tab]) {
    try { store.setItem(key, token); } catch { /* The other store can still retain this session. */ }
  }
}

// Client expiry checks improve UX; the backend still verifies the signature.
export function readWorkspaceSession(hash: string, persistent: SessionStore, tab: SessionStore, now = Date.now()): string {
  const access = new URLSearchParams(hash.replace(/^#/, '')).get('access');
  for (const token of [access, read(persistent), read(tab)]) {
    if (token && /^\d+\.[a-f0-9]{64}$/.test(token) && Number(token.split('.')[0]) > now) {
      rememberWorkspaceSession(token, persistent, tab);
      return token;
    }
  }
  clearWorkspaceSession(persistent, tab);
  return '';
}
