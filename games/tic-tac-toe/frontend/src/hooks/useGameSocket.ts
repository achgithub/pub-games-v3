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

interface WSMessage {
  type: string;
  payload?: any;
}

// Connection states for UI feedback
type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'failed';

// Handshake states
type HandshakeState = 'connecting' | 'sent_ping' | 'received_pong' | 'sent_ack' | 'ready' | 'failed';

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second between retries
const CONNECT_DELAY = 100; // Small delay before connecting

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

export function useGameSocket(gameId: string | null, userId: string): UseGameSocketResult {
  const [game, setGame] = useState<Game | null>(null);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [retryCount, setRetryCount] = useState(0);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [claimWinAvailable, setClaimWinAvailable] = useState(false);
  const [claimWinCountdown, setClaimWinCountdown] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const claimWinTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const handshakeStateRef = useRef<HandshakeState>('connecting');
  const retryCountRef = useRef(0);

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
    if (wsRef.current) {
      wsRef.current.close(1000, 'Reconnecting');
      wsRef.current = null;
    }

    // Construct WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = '4001'; // Tic-tac-toe backend port
    const wsUrl = `${protocol}//${host}:${port}/api/ws/game/${gameId}?userId=${encodeURIComponent(userId)}`;

    console.log('[WS] Connecting to:', wsUrl, `(attempt ${retryCountRef.current + 1})`);
    handshakeStateRef.current = 'connecting';
    setConnectionStatus(retryCountRef.current > 0 ? 'reconnecting' : 'connecting');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected, starting handshake');
      setConnected(true);
      setError(null);

      // Step 1: Send PING to start handshake
      console.log('[WS] Handshake: Sending PING');
      ws.send(JSON.stringify({ type: 'ping' }));
      handshakeStateRef.current = 'sent_ping';
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        console.log('[WS] Received:', msg.type, 'handshakeState:', handshakeStateRef.current, 'payload:', msg.payload ? 'yes' : 'no');

        // Handle handshake sequence
        if (handshakeStateRef.current === 'sent_ping' && msg.type === 'pong') {
          // Step 2: Received PONG, send ACK
          console.log('[WS] Handshake: Received PONG, sending ACK');
          handshakeStateRef.current = 'received_pong';
          ws.send(JSON.stringify({ type: 'ack' }));
          handshakeStateRef.current = 'sent_ack';
          return;
        }

        if (handshakeStateRef.current === 'sent_ack' && msg.type === 'ready') {
          // Step 3: Received READY with game state - success!
          console.log('[WS] Handshake: Received READY with game state:', JSON.stringify(msg.payload));
          handshakeStateRef.current = 'ready';
          const gameData = msg.payload as Game;
          console.log('[WS] Setting game state:', gameData?.id, 'status:', gameData?.status);
          setGame(gameData);
          console.log('[WS] Setting ready=true, connectionStatus=connected');
          setReady(true);
          setConnectionStatus('connected');
          // Reset retry count on successful connection
          retryCountRef.current = 0;
          setRetryCount(0);
          return;
        }

        // Log unexpected handshake messages
        if (msg.type === 'ready' && handshakeStateRef.current !== 'sent_ack') {
          console.warn('[WS] Received READY but handshake state is:', handshakeStateRef.current, '(expected sent_ack)');
        }
        if (msg.type === 'pong' && handshakeStateRef.current !== 'sent_ping') {
          console.log('[WS] Received PONG outside handshake (game refresh)');
        }

        // Normal message handling (after handshake)
        switch (msg.type) {
          case 'pong':
            // Game state refresh response (only after handshake complete)
            if (handshakeStateRef.current === 'ready' && msg.payload) {
              setGame(msg.payload as Game);
            }
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
            console.log('[WS] Opponent disconnected, starting claim win timer');
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
            console.log('[WS] Opponent reconnected');
            clearClaimWinTimers();
            setOpponentDisconnected(false);
            break;

          case 'error':
            console.error('[WS] Server error:', msg.payload?.message);
            setError(msg.payload?.message || 'Unknown error');
            break;

          default:
            console.log('[WS] Unknown message type:', msg.type);
        }
      } catch (e) {
        console.error('[WS] Failed to parse message:', e);
      }
    };

    ws.onerror = (event) => {
      console.error('[WS] Error:', event);
      handshakeStateRef.current = 'failed';
    };

    ws.onclose = (event) => {
      console.log('[WS] Closed:', event.code, event.reason);
      setConnected(false);
      setReady(false);
      handshakeStateRef.current = 'connecting';

      // Don't retry if intentional close or game ended
      if (event.code === 1000) {
        return;
      }

      // Check if we should retry
      if (gameId && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        setRetryCount(retryCountRef.current);
        setConnectionStatus('reconnecting');

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCountRef.current - 1);
        console.log(`[WS] Retry ${retryCountRef.current}/${MAX_RETRIES} in ${delay}ms`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else if (retryCountRef.current >= MAX_RETRIES) {
        // Max retries reached
        setConnectionStatus('failed');
        setError('Connection failed after multiple attempts. Tap to retry.');
      }
    };
  }, [gameId, userId, clearClaimWinTimers]);

  // Manual retry function
  const retry = useCallback(() => {
    console.log('[WS] Manual retry triggered');
    retryCountRef.current = 0;
    setRetryCount(0);
    setError(null);
    setConnectionStatus('connecting');

    // Small delay then connect
    setTimeout(() => connect(), CONNECT_DELAY);
  }, [connect]);

  // Connect when gameId changes
  useEffect(() => {
    // Reset state for new game
    retryCountRef.current = 0;
    setRetryCount(0);
    setError(null);
    setConnectionStatus('connecting');

    // Small delay before connecting - helps iOS Safari in iframes settle
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
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [connect, clearClaimWinTimers]);

  // Make a move
  const makeMove = useCallback((position: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('[WS] Cannot make move: not connected');
      return;
    }

    if (!ready) {
      console.error('[WS] Cannot make move: handshake not complete');
      return;
    }

    const msg: WSMessage = {
      type: 'move',
      payload: { position },
    };

    console.log('[WS] Sending move:', position);
    wsRef.current.send(JSON.stringify(msg));
  }, [ready]);

  // Forfeit the game (intentional leave)
  const forfeit = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('[WS] Cannot forfeit: not connected');
      return;
    }

    console.log('[WS] Sending forfeit');
    wsRef.current.send(JSON.stringify({ type: 'forfeit' }));
  }, []);

  // Claim win after opponent disconnect
  const claimWin = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('[WS] Cannot claim win: not connected');
      return;
    }

    if (!claimWinAvailable) {
      console.error('[WS] Cannot claim win: not available yet');
      return;
    }

    console.log('[WS] Sending claim_win');
    wsRef.current.send(JSON.stringify({ type: 'claim_win' }));
  }, [claimWinAvailable]);

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
