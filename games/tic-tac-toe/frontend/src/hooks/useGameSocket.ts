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

interface UseGameSocketResult {
  game: Game | null;
  connected: boolean;
  ready: boolean;
  error: string | null;
  opponentDisconnected: boolean;
  makeMove: (position: number) => void;
}

export function useGameSocket(gameId: string | null, userId: string): UseGameSocketResult {
  const [game, setGame] = useState<Game | null>(null);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!gameId || !userId) return;

    // Construct WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = '4001'; // Tic-tac-toe backend port
    const wsUrl = `${protocol}//${host}:${port}/api/ws/game/${gameId}?userId=${encodeURIComponent(userId)}`;

    console.log('[WS] Connecting to:', wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      setConnected(true);
      setError(null);
      setOpponentDisconnected(false);

      // Send ack to signal we're ready
      ws.send(JSON.stringify({ type: 'ack' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        console.log('[WS] Received:', msg.type, msg.payload);

        switch (msg.type) {
          case 'pong':
            // Initial game state or ping response
            setGame(msg.payload as Game);
            break;

          case 'ready':
            // Both players connected and ready
            setReady(true);
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
            break;

          case 'opponent_disconnected':
            setOpponentDisconnected(true);
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
      setError('Connection error');
    };

    ws.onclose = (event) => {
      console.log('[WS] Closed:', event.code, event.reason);
      setConnected(false);
      setReady(false);

      // Attempt reconnect if not intentional close
      if (event.code !== 1000 && gameId) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[WS] Attempting reconnect...');
          connect();
        }, 3000);
      }
    };
  }, [gameId, userId]);

  // Connect when gameId changes
  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [connect]);

  // Make a move
  const makeMove = useCallback((position: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('[WS] Cannot make move: not connected');
      return;
    }

    const msg: WSMessage = {
      type: 'move',
      payload: { position },
    };

    wsRef.current.send(JSON.stringify(msg));
  }, []);

  return {
    game,
    connected,
    ready,
    error,
    opponentDisconnected,
    makeMove,
  };
}

export default useGameSocket;
