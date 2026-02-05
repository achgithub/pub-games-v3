import { useState, useEffect, useRef, useCallback } from 'react';
import { LobbyState, Challenge, ChallengeOptions, GameConfig } from '../types';

const API_BASE = `http://${window.location.hostname}:3001/api`;

interface UseLobbyOptions {
  onNewChallenge?: (challenge: Challenge) => void;
  onGameStart?: (appId: string, gameId: string) => void;
}

export function useLobby(userEmail: string, options?: UseLobbyOptions) {
  const { onNewChallenge, onGameStart } = options || {};

  // Use refs to avoid stale closures in SSE handler
  const onNewChallengeRef = useRef(onNewChallenge);
  const onGameStartRef = useRef(onGameStart);

  // Keep refs updated
  useEffect(() => {
    onNewChallengeRef.current = onNewChallenge;
    onGameStartRef.current = onGameStart;
  }, [onNewChallenge, onGameStart]);
  const [lobbyState, setLobbyState] = useState<LobbyState>({
    onlineUsers: [],
    receivedChallenges: [],
    sentChallenges: [],
    lastUpdate: Date.now(),
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const notifiedChallenges = useRef<Set<string>>(new Set());
  const [notification, setNotification] = useState<string | null>(null);

  // Update user's presence
  const updatePresence = useCallback(async (status: 'online' | 'in_game' | 'away', currentApp?: string) => {
    try {
      await fetch(`${API_BASE}/lobby/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          name: userEmail.split('@')[0],
          status,
          currentApp,
        }),
      });
    } catch (err) {
      console.error('Failed to update presence:', err);
    }
  }, [userEmail]);

  // Fetch online users
  const fetchOnlineUsers = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/lobby/presence`);
      const data = await response.json();
      setLobbyState((prev) => ({
        ...prev,
        onlineUsers: data.users || [],
        lastUpdate: Date.now(),
      }));
    } catch (err) {
      console.error('Failed to fetch online users:', err);
    }
  }, []);

  // Fetch received challenges
  const fetchChallenges = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/lobby/challenges?email=${encodeURIComponent(userEmail)}`);
      const data = await response.json();
      const challenges = data.challenges || [];

      setLobbyState((prev) => ({
        ...prev,
        receivedChallenges: challenges,
        lastUpdate: Date.now(),
      }));

      // Detect new challenges by ID (not count)
      if (onNewChallengeRef.current) {
        challenges.forEach((challenge: Challenge) => {
          if (!notifiedChallenges.current.has(challenge.id)) {
            notifiedChallenges.current.add(challenge.id);
            onNewChallengeRef.current!(challenge);
          }
        });
      }
    } catch (err) {
      console.error('Failed to fetch challenges:', err);
    }
  }, [userEmail]);

  // Fetch sent challenges
  const fetchSentChallenges = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/lobby/challenges/sent?email=${encodeURIComponent(userEmail)}`);
      const data = await response.json();
      setLobbyState((prev) => ({
        ...prev,
        sentChallenges: data.challenges || [],
        lastUpdate: Date.now(),
      }));
    } catch (err) {
      console.error('Failed to fetch sent challenges:', err);
    }
  }, [userEmail]);

  // Fetch game config from mini-app
  // appId reserved for future use (e.g., caching by app)
  const fetchGameConfig = async (_appId: string, backendPort: number): Promise<GameConfig | null> => {
    try {
      const host = window.location.hostname;
      const response = await fetch(`http://${host}:${backendPort}/api/config`);
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      console.error('Failed to fetch game config:', err);
      return null;
    }
  };

  // Send a challenge with optional game options
  const sendChallenge = async (toUser: string, appId: string, options?: ChallengeOptions) => {
    try {
      const response = await fetch(`${API_BASE}/lobby/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUser: userEmail,
          toUser,
          appId,
          options: options || {},
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        // Refresh user list when challenge fails (user likely offline)
        fetchOnlineUsers();
        setNotification('User is offline');
        setTimeout(() => setNotification(null), 3000);
        throw new Error(error);
      }

      // Refresh sent challenges list
      fetchSentChallenges();

      // Show brief success notification
      setNotification('Challenge sent!');
      setTimeout(() => setNotification(null), 2000);

      return true;
    } catch (err) {
      console.error('Failed to send challenge:', err);
      // Refresh user list on any error
      fetchOnlineUsers();
      if (!notification) {
        setNotification('Failed to send challenge');
        setTimeout(() => setNotification(null), 3000);
      }
      return false;
    }
  };

  // Send a multi-player challenge
  const sendMultiChallenge = async (
    playerIds: string[],
    appId: string,
    minPlayers: number,
    maxPlayers: number,
    options?: ChallengeOptions
  ) => {
    try {
      const response = await fetch(`${API_BASE}/lobby/challenge/multi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initiatorId: userEmail,
          playerIds,
          appId,
          minPlayers,
          maxPlayers,
          options: options || {},
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        fetchOnlineUsers();
        setNotification('Failed to send multi-player challenge');
        setTimeout(() => setNotification(null), 3000);
        throw new Error(error);
      }

      // Refresh sent challenges list
      fetchSentChallenges();

      // Show success notification
      setNotification(`Challenge sent to ${playerIds.length} players!`);
      setTimeout(() => setNotification(null), 2000);

      return true;
    } catch (err) {
      console.error('Failed to send multi-player challenge:', err);
      fetchOnlineUsers();
      if (!notification) {
        setNotification('Failed to send challenge');
        setTimeout(() => setNotification(null), 3000);
      }
      return false;
    }
  };

  // Accept a challenge (with optional userId for multi-player)
  const acceptChallenge = async (challengeId: string, userId?: string) => {
    try {
      const url = userId
        ? `${API_BASE}/lobby/challenge/accept?id=${challengeId}&userId=${encodeURIComponent(userId)}`
        : `${API_BASE}/lobby/challenge/accept?id=${challengeId}`;

      await fetch(url, {
        method: 'POST',
      });

      // Refresh challenges
      fetchChallenges();
      fetchSentChallenges();
      return true;
    } catch (err) {
      console.error('Failed to accept challenge:', err);
      return false;
    }
  };

  // Reject a challenge
  const rejectChallenge = async (challengeId: string) => {
    try {
      await fetch(`${API_BASE}/lobby/challenge/reject?id=${challengeId}`, {
        method: 'POST',
      });

      // Refresh challenges
      fetchChallenges();
      return true;
    } catch (err) {
      console.error('Failed to reject challenge:', err);
      return false;
    }
  };

  // Setup SSE connection
  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/lobby/stream?email=${encodeURIComponent(userEmail)}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'challenge_received') {
        // Refresh challenges when notified
        fetchChallenges();
      } else if (data.type === 'accepted' || data.type === 'rejected') {
        // Refresh when challenge is responded to
        fetchChallenges();
        fetchSentChallenges();
      } else if (data.type === 'challenge_update') {
        // Multi-player challenge acceptance progress
        fetchChallenges();
        fetchSentChallenges();
      } else if (data.type === 'presence_update') {
        // Refresh online users and sent challenges (removes offline users)
        fetchOnlineUsers();
        fetchSentChallenges();
      } else if (data.type === 'game_started') {
        // Game has been created - navigate to it
        // Use ref to avoid stale closure
        if (onGameStartRef.current && data.appId && data.gameId) {
          console.log('🎮 game_started received, navigating to:', data.appId, data.gameId);
          onGameStartRef.current(data.appId, data.gameId);
        }
      }
    };

    eventSource.onerror = () => {
      console.warn('SSE connection lost, will auto-reconnect');
    };

    // Initial data fetch
    updatePresence('online');
    fetchOnlineUsers();
    fetchChallenges();
    fetchSentChallenges();

    // Heartbeat every 20 seconds (also refresh sent challenges to remove offline users)
    const heartbeat = setInterval(() => {
      updatePresence('online');
      fetchSentChallenges();
    }, 20000);

    // Cleanup on unmount
    return () => {
      clearInterval(heartbeat);
      eventSource.close();
      updatePresence('away');
    };
  }, [userEmail, updatePresence, fetchOnlineUsers, fetchChallenges, fetchSentChallenges]);

  // Browser lifecycle detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence('away');
      } else {
        updatePresence('online');
        fetchOnlineUsers();
        fetchChallenges();
      }
    };

    const handleBeforeUnload = () => {
      // Send synchronous beacon to remove presence
      navigator.sendBeacon(
        `${API_BASE}/lobby/presence/remove?email=${encodeURIComponent(userEmail)}`
      );
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userEmail, updatePresence, fetchOnlineUsers, fetchChallenges]);

  return {
    ...lobbyState,
    notification,
    updatePresence,
    sendChallenge,
    sendMultiChallenge,
    acceptChallenge,
    rejectChallenge,
    fetchGameConfig,
  };
}
