import { Injectable, signal } from '@angular/core';
import { EncryptedNoteResponse, Note, NoteRequest } from './models';

interface EncryptedPayload {
  version: 1;
  algorithm: 'AES-GCM';
  kdf: 'PBKDF2-SHA-256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

@Injectable({ providedIn: 'root' })
export class CryptoService {
  readonly unlocked = signal(false);
  private password: string | null = null;
  private readonly iterations = 600_000;

  unlock(password: string) {
    this.password = password;
    this.unlocked.set(true);
  }

  lock() {
    this.password = null;
    this.unlocked.set(false);
  }

  async encrypt(note: NoteRequest): Promise<string> {
    if (!this.password) throw new Error('Notes are locked. Please log in again.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(this.password, salt);
    const plaintext = new TextEncoder().encode(JSON.stringify(note));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    return JSON.stringify({
      version: 1,
      algorithm: 'AES-GCM',
      kdf: 'PBKDF2-SHA-256',
      iterations: this.iterations,
      salt: this.encode(salt),
      iv: this.encode(iv),
      ciphertext: this.encode(new Uint8Array(ciphertext)),
    } satisfies EncryptedPayload);
  }

  async decrypt(response: EncryptedNoteResponse): Promise<Note | null> {
    if (!response.encryptedPayload) return null;
    if (!this.password) throw new Error('Notes are locked. Please log in again.');
    const payload = JSON.parse(response.encryptedPayload) as EncryptedPayload;
    if (payload.version !== 1 || payload.algorithm !== 'AES-GCM' || payload.kdf !== 'PBKDF2-SHA-256') {
      throw new Error('Unsupported encrypted note format.');
    }
    const salt = this.decode(payload.salt);
    const key = await this.deriveKey(this.password, salt, payload.iterations);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.decode(payload.iv) }, key, this.decode(payload.ciphertext));
    const note = JSON.parse(new TextDecoder().decode(plaintext)) as NoteRequest;
    return { ...note, id: response.id, archived: response.archived, pinned: response.pinned, createdAt: response.createdAt, updatedAt: response.updatedAt };
  }

  private deriveKey(password: string, salt: Uint8Array, iterations = this.iterations) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']).then((key) =>
      crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' }, key, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
    );
  }

  private encode(value: Uint8Array) { return btoa(String.fromCharCode(...value)); }
  private decode(value: string) { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }
}
