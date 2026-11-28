import { useCallback, useEffect, useState } from 'react';
import { TabRoute } from '../types/facilitation';

function isAllowedPath(pathname: string): boolean {
  return pathname === '/toolkit/allvoices' || pathname === '/toolkit/allvoices/';
}

export function useRouteTab() {
  const [activeTab, setActiveTab] = useState<TabRoute>('balance');
  const [isNotFound, setIsNotFound] = useState<boolean>(() => !isAllowedPath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => {
      setIsNotFound(!isAllowedPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((tab: TabRoute) => {
    setActiveTab(tab);
  }, []);

  return { activeTab, navigate, isNotFound };
}
