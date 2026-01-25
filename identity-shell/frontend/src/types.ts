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
