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

// Handshake states
type HandshakeState = 'connecting' | 'sent_ping' | 'received_pong' | 'sent_ack' | 'ready' | 'failed';

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
  const handshakeStateRef = useRef<HandshakeState>('connecting');

  const connect = useCallback(() => {
    if (!gameId || !userId) return;

    // Construct WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = '4001'; // Tic-tac-toe backend port
    const wsUrl = `${protocol}//${host}:${port}/api/ws/game/${gameId}?userId=${encodeURIComponent(userId)}`;

    console.log('[WS] Connecting to:', wsUrl);
    handshakeStateRef.current = 'connecting';

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected, starting handshake');
      setConnected(true);
      setError(null);
      setOpponentDisconnected(false);

      // Step 1: Send PING to start handshake
      console.log('[WS] Handshake: Sending PING');
      ws.send(JSON.stringify({ type: 'ping' }));
      handshakeStateRef.current = 'sent_ping';
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        console.log('[WS] Received:', msg.type, handshakeStateRef.current);

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
          // Step 3: Received READY with game state
          console.log('[WS] Handshake: Received READY with game state');
          handshakeStateRef.current = 'ready';
          setGame(msg.payload as Game);
          setReady(true);
          return;
        }

        // Normal message handling (after handshake)
        switch (msg.type) {
          case 'pong':
            // Game state refresh response
            if (msg.payload) {
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
            break;

          case 'opponent_disconnected':
            console.log('[WS] Opponent disconnected');
            setOpponentDisconnected(true);
            break;

          case 'opponent_reconnected':
            console.log('[WS] Opponent reconnected');
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
      setError('Connection error');
      handshakeStateRef.current = 'failed';
    };

    ws.onclose = (event) => {
      console.log('[WS] Closed:', event.code, event.reason);
      setConnected(false);
      setReady(false);
      handshakeStateRef.current = 'connecting';

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
