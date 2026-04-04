'use client';

import { useEffect } from 'react';

export default function AuthCallbackPage() {
  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage({ type: 'AUTH_SUCCESS' }, window.location.origin);
    }
    window.close();
  }, []);

  return <p className="p-4 text-sm text-slate-500">Signing in…</p>;
}
