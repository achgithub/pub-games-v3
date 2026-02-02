import { useState, useEffect } from 'react';
import { AppDefinition, AppsRegistry } from '../types';

const API_BASE = `http://${window.location.hostname}:3001`;

export function useApps() {
  const [apps, setApps] = useState<AppDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchApps() {
      try {
        const response = await fetch(`${API_BASE}/api/apps`);
        if (!response.ok) {
          throw new Error('Failed to fetch apps');
        }
        const data: AppsRegistry = await response.json();
        setApps(data.apps || []);
        setError(null);
      } catch (err) {
        console.error('Failed to load apps:', err);
        setError(err instanceof Error ? err.message : 'Failed to load apps');
        // Fallback to minimal internal apps
        setApps([
          {
            id: 'lobby',
            name: 'Lobby',
            icon: '🏠',
            type: 'internal',
            description: 'View online users and challenges',
            category: 'utility',
          },
        ]);
      } finally {
        setLoading(false);
      }
    }

    fetchApps();
  }, []);

  return { apps, loading, error };
}

// Helper to build the app URL with query params
export function buildAppUrl(
  app: AppDefinition,
  params: { userId?: string; userName?: string; isAdmin?: boolean; gameId?: string }
): string {
  console.log('🔍 buildAppUrl called:', {
    appId: app.id,
    appUrl: app.url,
    params: params,
  });

  if (!app.url) return '';

  // Replace {host} placeholder with current hostname
  let url = app.url.replace('{host}', window.location.hostname);

  // Get token from localStorage (stored as 'token' by App.tsx handleLogin)
  const token = localStorage.getItem('token');
  console.log('🔍 Token from localStorage:', token ? `${token.substring(0, 20)}...` : 'MISSING');

  // Add query params
  const searchParams = new URLSearchParams();
  if (params.userId) searchParams.set('userId', params.userId);
  if (params.userName) searchParams.set('userName', params.userName);
  if (params.isAdmin !== undefined) searchParams.set('isAdmin', params.isAdmin.toString());
  if (params.gameId) searchParams.set('gameId', params.gameId);
  if (token) searchParams.set('token', token);

  const queryString = searchParams.toString();
  if (queryString) {
    url += (url.includes('?') ? '&' : '?') + queryString;
  }

  console.log('🔍 buildAppUrl result:', url);

  return url;
}

export default useApps;
