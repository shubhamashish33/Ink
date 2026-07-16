export type UserRole = 'USER';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInMinutes: number;
  user: AuthUser;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface Note {
  id: string;
  version: number;
  title: string;
  content: string;
  tags: string[];
  archived: boolean;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EncryptedNoteResponse {
  id: string;
  encryptedPayload: string | null;
  version: number;
  archived: boolean;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteRequest {
  title: string;
  content: string;
  tags: string[];
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
