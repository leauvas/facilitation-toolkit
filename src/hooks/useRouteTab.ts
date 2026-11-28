import { useCallback, useEffect, useState } from 'react';
import { TabRoute } from '../types/facilitation';

const CANONICAL_PATH = '/toolkit/allvoices';

function ensureCanonicalPath(): void {
  const clean = window.location.pathname.replace(/\/+$/, '') || '/';
  if (clean !== CANONICAL_PATH) {
    window.history.replaceState(null, '', CANONICAL_PATH);
  }
}

export function useRouteTab() {
  const [activeTab, setActiveTab] = useState<TabRoute>(() => {
    ensureCanonicalPath();
    return 'balance';
  });

  useEffect(() => {
    const onPopState = () => {
      ensureCanonicalPath();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((tab: TabRoute) => {
    ensureCanonicalPath();
    setActiveTab(tab);
  }, []);

  return { activeTab, navigate };
}
