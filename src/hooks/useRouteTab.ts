import { useCallback, useEffect, useState } from 'react';
import { TabRoute } from '../types/facilitation';

function resolvePathToTab(pathname: string): { tab: TabRoute; canonicalPath: string; needsReplace: boolean } {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/toolkit/timer') {
    return { tab: 'timer', canonicalPath: '/toolkit/timer', needsReplace: pathname !== '/toolkit/timer' };
  }
  if (clean === '/toolkit/balance') {
    return { tab: 'balance', canonicalPath: '/toolkit/balance', needsReplace: pathname !== '/toolkit/balance' };
  }
  // '/' or '/toolkit' or any fallback redirects to '/toolkit/balance'
  return { tab: 'balance', canonicalPath: '/toolkit/balance', needsReplace: true };
}

export function useRouteTab() {
  const [activeTab, setActiveTab] = useState<TabRoute>(() => {
    const resolved = resolvePathToTab(window.location.pathname);
    if (resolved.needsReplace) {
      window.history.replaceState(null, '', resolved.canonicalPath);
    }
    return resolved.tab;
  });

  useEffect(() => {
    const onPopState = () => {
      const resolved = resolvePathToTab(window.location.pathname);
      if (resolved.needsReplace) {
        window.history.replaceState(null, '', resolved.canonicalPath);
      }
      setActiveTab(resolved.tab);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((tab: TabRoute) => {
    const targetPath = tab === 'timer' ? '/toolkit/timer' : '/toolkit/balance';
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    setActiveTab(tab);
  }, []);

  return { activeTab, navigate };
}
