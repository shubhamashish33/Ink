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
  private keyMaterial: CryptoKey | null = null;
  private restorePromise: Promise<boolean> | null = null;
  private readonly iterations = 600_000;
  private readonly databaseName = 'ink-crypto';
  private readonly keyStoreName = 'session-keys';
  private readonly sessionIdStorageKey = 'ink.cryptoSessionId';

  async unlock(password: string) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    const sessionId = crypto.randomUUID();

    await this.storeSessionKey(sessionId, keyMaterial);
    sessionStorage.setItem(this.sessionIdStorageKey, sessionId);
    this.keyMaterial = keyMaterial;
    this.unlocked.set(true);
  }

  async restore() {
    if (this.keyMaterial) return true;
    this.restorePromise ??= this.restoreSessionKey();
    return this.restorePromise;
  }

  async lock() {
    const sessionId = sessionStorage.getItem(this.sessionIdStorageKey);
    sessionStorage.removeItem(this.sessionIdStorageKey);
    this.keyMaterial = null;
    this.restorePromise = null;
    this.unlocked.set(false);

    if (sessionId) await this.deleteSessionKey(sessionId);
  }

  async encrypt(note: NoteRequest): Promise<string> {
    const keyMaterial = await this.requireKeyMaterial();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(keyMaterial, salt);
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
    const keyMaterial = await this.requireKeyMaterial();
    const payload = JSON.parse(response.encryptedPayload) as EncryptedPayload;
    if (payload.version !== 1 || payload.algorithm !== 'AES-GCM' || payload.kdf !== 'PBKDF2-SHA-256') {
      throw new Error('Unsupported encrypted note format.');
    }
    const salt = this.decode(payload.salt);
    const key = await this.deriveKey(keyMaterial, salt, payload.iterations);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.decode(payload.iv) }, key, this.decode(payload.ciphertext));
    const note = JSON.parse(new TextDecoder().decode(plaintext)) as NoteRequest;
    return { ...note, id: response.id, version: response.version, archived: response.archived, pinned: response.pinned, createdAt: response.createdAt, updatedAt: response.updatedAt };
  }

  private deriveKey(keyMaterial: CryptoKey, salt: Uint8Array, iterations = this.iterations) {
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  private async requireKeyMaterial() {
    if (!this.keyMaterial) await this.restore();
    if (!this.keyMaterial) throw new Error('Notes are locked. Please log in again.');
    return this.keyMaterial;
  }

  private async restoreSessionKey() {
    const sessionId = sessionStorage.getItem(this.sessionIdStorageKey);
    if (!sessionId) return false;

    const keyMaterial = await this.readSessionKey(sessionId);
    if (!keyMaterial) {
      sessionStorage.removeItem(this.sessionIdStorageKey);
      return false;
    }

    this.keyMaterial = keyMaterial;
    this.unlocked.set(true);
    return true;
  }

  private async openDatabase() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(this.keyStoreName)) {
          database.createObjectStore(this.keyStoreName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async storeSessionKey(sessionId: string, key: CryptoKey) {
    const database = await this.openDatabase();
    await this.completeTransaction(database, 'readwrite', (store) => store.put(key, sessionId));
  }

  private async readSessionKey(sessionId: string) {
    const database = await this.openDatabase();
    return new Promise<CryptoKey | null>((resolve, reject) => {
      const transaction = database.transaction(this.keyStoreName, 'readonly');
      const request = transaction.objectStore(this.keyStoreName).get(sessionId);
      request.onsuccess = () => resolve((request.result as CryptoKey | undefined) ?? null);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
    });
  }

  private async deleteSessionKey(sessionId: string) {
    const database = await this.openDatabase();
    await this.completeTransaction(database, 'readwrite', (store) => store.delete(sessionId));
  }

  private completeTransaction(
    database: IDBDatabase,
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest,
  ) {
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(this.keyStoreName, mode);
      action(transaction.objectStore(this.keyStoreName));
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error);
      };
    });
  }

  private encode(value: Uint8Array) { return btoa(String.fromCharCode(...value)); }
  private decode(value: string) { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }
}
