// User types
export interface User {
  email: string;
  name: string;
  is_admin?: boolean;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface ValidateResponse {
  valid: boolean;
  user?: User;
}

// Presence types
export type UserStatus = 'online' | 'in_game' | 'away';

export interface UserPresence {
  email: string;
  displayName: string;
  status: UserStatus;
  currentApp?: string;
  lastSeen: number; // Unix timestamp
}

// App types
export type AppType = 'internal' | 'iframe';
export type RealtimeType = 'websocket' | 'sse' | 'none';

export interface AppDefinition {
  id: string;
  name: string;
  icon: string;
  type: AppType;
  url?: string; // URL template with {host} placeholder
  description: string;
  category: 'game' | 'utility' | 'admin';
  backendPort?: number;
  realtime?: RealtimeType;
}

export interface AppsRegistry {
  apps: AppDefinition[];
}

// Challenge types
export interface Challenge {
  id: string;
  fromUser: string;
  toUser: string;
  appId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp
}

// Lobby types
export interface LobbyState {
  onlineUsers: UserPresence[];
  receivedChallenges: Challenge[];
  sentChallenges: Challenge[];
  lastUpdate: number;
}

// Game config types (returned by mini-app /api/config)
export interface GameOptionChoice {
  value: string | number;
  label: string;
}

export interface GameOption {
  id: string;
  type: 'select' | 'checkbox' | 'number';
  label: string;
  default: string | number | boolean;
  options?: GameOptionChoice[];
  min?: number;
  max?: number;
}

export interface GameConfig {
  appId: string;
  name: string;
  icon: string;
  description: string;
  gameOptions: GameOption[];
}

// Challenge options (selected by challenger)
export interface ChallengeOptions {
  [key: string]: string | number | boolean;
}
