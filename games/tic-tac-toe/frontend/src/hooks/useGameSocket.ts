import { useState, useEffect, useRef, useCallback } from 'react';

// Game types matching backend
export interface Game {
  id: string;
  challengeId?: string;
  player1Id: string;
  player1Name: string;
  player1Symbol: string;
  player2Id: string;
  player2Name: string;
  player2Symbol: string;
  board: string[];
  currentTurn: number;
  status: 'active' | 'completed' | 'abandoned';
  mode: 'normal' | 'timed';
  moveTimeLimit: number;
  firstTo: number;
  player1Score: number;
  player2Score: number;
  currentRound: number;
  winnerId: string | null;
  lastMoveAt: number;
  createdAt: number;
  completedAt?: number;
}

interface SSEEvent {
  type: string;
  payload?: any;
}

// Connection states for UI feedback
type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'failed';

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000;
const CONNECT_DELAY = 100;

interface UseGameSocketResult {
  game: Game | null;
  connected: boolean;
  ready: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  retryCount: number;
  opponentDisconnected: boolean;
  claimWinAvailable: boolean;
  claimWinCountdown: number | null;
  makeMove: (position: number) => void;
  forfeit: () => void;
  claimWin: () => void;
  retry: () => void;
}

export function useGameSocket(gameId: string | null, userId: string, token: string): UseGameSocketResult {
  const [game, setGame] = useState<Game | null>(null);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [retryCount, setRetryCount] = useState(0);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [claimWinAvailable, setClaimWinAvailable] = useState(false);
  const [claimWinCountdown, setClaimWinCountdown] = useState<number | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const claimWinTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const gameIdRef = useRef<string | null>(null);

  // Build API base URL
  const getApiBase = useCallback(() => {
    const host = window.location.hostname;
    const port = '4001';
    return `http://${host}:${port}`;
  }, []);

  // Clear claim win timers
  const clearClaimWinTimers = useCallback(() => {
    if (claimWinTimerRef.current) {
      clearTimeout(claimWinTimerRef.current);
      claimWinTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setClaimWinAvailable(false);
    setClaimWinCountdown(null);
  }, []);

  const connect = useCallback(() => {
    if (!gameId || !userId) return;

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Build SSE URL with token
    const apiBase = getApiBase();
    const sseUrl = `${apiBase}/api/game/${gameId}/stream`;

    console.log('[SSE] Connecting to:', sseUrl, `(attempt ${retryCountRef.current + 1})`);
    setConnectionStatus(retryCountRef.current > 0 ? 'reconnecting' : 'connecting');

    // EventSource doesn't support custom headers, so we include token in URL temporarily
    // Note: This is less secure but EventSource API limitation
    const sseUrlWithAuth = `${sseUrl}?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(sseUrlWithAuth);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[SSE] Connection opened');
      setConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const msg: SSEEvent = JSON.parse(event.data);
        console.log('[SSE] Received:', msg.type);

        switch (msg.type) {
          case 'connected':
            // Initial connection with game state
            console.log('[SSE] Connected with game state');
            const gameData = msg.payload as Game;
            setGame(gameData);
            setReady(true);
            setConnectionStatus('connected');
            // Reset retry count on successful connection
            retryCountRef.current = 0;
            setRetryCount(0);
            break;

          case 'move_update':
            // Game state updated after a move
            if (msg.payload?.game) {
              setGame(msg.payload.game as Game);
            }
            break;

          case 'game_ended':
            // Game finished
            if (msg.payload?.game) {
              setGame(msg.payload.game as Game);
            }
            // Clear any disconnect state since game ended
            clearClaimWinTimers();
            setOpponentDisconnected(false);
            break;

          case 'opponent_disconnected':
            console.log('[SSE] Opponent disconnected, starting claim win timer');
            setOpponentDisconnected(true);

            // Start countdown for claim win
            const claimWinDelay = msg.payload?.claimWinAfter || 15;
            setClaimWinCountdown(claimWinDelay);

            // Countdown interval
            countdownIntervalRef.current = setInterval(() => {
              setClaimWinCountdown(prev => {
                if (prev === null || prev <= 1) {
                  if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                  }
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);

            // Enable claim win after delay
            claimWinTimerRef.current = setTimeout(() => {
              setClaimWinAvailable(true);
              setClaimWinCountdown(0);
            }, claimWinDelay * 1000);
            break;

          case 'opponent_reconnected':
            console.log('[SSE] Opponent reconnected');
            clearClaimWinTimers();
            setOpponentDisconnected(false);
            break;

          case 'ping':
            // Keepalive ping, no action needed
            break;

          case 'error':
            console.error('[SSE] Server error:', msg.payload?.message);
            setError(msg.payload?.message || 'Unknown error');
            break;

          default:
            console.log('[SSE] Unknown message type:', msg.type);
        }
      } catch (e) {
        console.error('[SSE] Failed to parse message:', e, event.data);
      }
    };

    eventSource.onerror = (event) => {
      console.error('[SSE] Error:', event);
      setConnected(false);
      setReady(false);

      // EventSource will auto-reconnect, but we track retries for UI feedback
      if (eventSource.readyState === EventSource.CLOSED) {
        // Connection was closed, need to manually reconnect
        if (gameIdRef.current && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          setRetryCount(retryCountRef.current);
          setConnectionStatus('reconnecting');

          // Exponential backoff: 1s, 2s, 4s, 8s, 16s
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCountRef.current - 1);
          console.log(`[SSE] Retry ${retryCountRef.current}/${MAX_RETRIES} in ${delay}ms`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (retryCountRef.current >= MAX_RETRIES) {
          setConnectionStatus('failed');
          setError('Connection failed after multiple attempts. Tap to retry.');
        }
      }
    };
  }, [gameId, userId, getApiBase, clearClaimWinTimers]);

  // Manual retry function
  const retry = useCallback(() => {
    console.log('[SSE] Manual retry triggered');
    retryCountRef.current = 0;
    setRetryCount(0);
    setError(null);
    setConnectionStatus('connecting');

    setTimeout(() => connect(), CONNECT_DELAY);
  }, [connect]);

  // Connect when gameId changes
  useEffect(() => {
    gameIdRef.current = gameId;

    // Reset state for new game
    retryCountRef.current = 0;
    setRetryCount(0);
    setError(null);
    setConnectionStatus('connecting');
    setGame(null);
    setReady(false);

    // Small delay before connecting - helps iOS Safari settle
    const connectTimeout = setTimeout(() => {
      connect();
    }, CONNECT_DELAY);

    return () => {
      // Cleanup on unmount
      clearTimeout(connectTimeout);
      clearClaimWinTimers();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [gameId, connect, clearClaimWinTimers]);

  // Make a move via HTTP POST
  const makeMove = useCallback(async (position: number) => {
    if (!gameId || !ready) {
      console.error('[SSE] Cannot make move: not ready');
      return;
    }

    const apiBase = getApiBase();
    console.log('[SSE] Making move:', position);

    try {
      const response = await fetch(`${apiBase}/api/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          gameId,
          playerId: userId,
          position,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Session expired. Please login again.');
          setTimeout(() => {
            window.location.href = `http://${window.location.hostname}:3001`;
          }, 2000);
          return;
        }
        const data = await response.json();
        console.error('[SSE] Move failed:', data.error);
        setError(data.error || 'Move failed');
      }
      // Game state will be updated via SSE
    } catch (err) {
      console.error('[SSE] Move request failed:', err);
      setError('Failed to make move');
    }
  }, [gameId, userId, ready, getApiBase, token]);

  // Forfeit the game via HTTP POST
  const forfeit = useCallback(async () => {
    if (!gameId) {
      console.error('[SSE] Cannot forfeit: no game');
      return;
    }

    const apiBase = getApiBase();
    console.log('[SSE] Forfeiting game');

    try {
      const response = await fetch(`${apiBase}/api/game/${gameId}/forfeit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Session expired. Please login again.');
          setTimeout(() => {
            window.location.href = `http://${window.location.hostname}:3001`;
          }, 2000);
          return;
        }
        const data = await response.json();
        console.error('[SSE] Forfeit failed:', data.error);
        setError(data.error || 'Forfeit failed');
      }
      // Game state will be updated via SSE
    } catch (err) {
      console.error('[SSE] Forfeit request failed:', err);
      setError('Failed to forfeit');
    }
  }, [gameId, getApiBase, token]);

  // Claim win after opponent disconnect via HTTP POST
  const claimWin = useCallback(async () => {
    if (!gameId || !claimWinAvailable) {
      console.error('[SSE] Cannot claim win: not available');
      return;
    }

    const apiBase = getApiBase();
    console.log('[SSE] Claiming win');

    try {
      const response = await fetch(`${apiBase}/api/game/${gameId}/claim-win`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Session expired. Please login again.');
          setTimeout(() => {
            window.location.href = `http://${window.location.hostname}:3001`;
          }, 2000);
          return;
        }
        const data = await response.json();
        console.error('[SSE] Claim win failed:', data.error);
        setError(data.error || 'Claim win failed');
      }
      // Game state will be updated via SSE
    } catch (err) {
      console.error('[SSE] Claim win request failed:', err);
      setError('Failed to claim win');
    }
  }, [gameId, claimWinAvailable, getApiBase, token]);

  return {
    game,
    connected,
    ready,
    error,
    connectionStatus,
    retryCount,
    opponentDisconnected,
    claimWinAvailable,
    claimWinCountdown,
    makeMove,
    forfeit,
    claimWin,
    retry,
  };
}

export default useGameSocket;
