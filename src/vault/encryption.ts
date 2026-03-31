/** Vault Encryption - Web Crypto API Implementation */

import { PBKDF2_ITERATIONS } from '../constants';

const VAULT_VERSION = 3;

export interface EncryptedPayload {
  iv: string;
  data: string;
}

export interface VaultData {
  version: number;
  salt: string;
  payload: EncryptedPayload;
}

async function deriveKey(password: string, salt: BufferSource): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptVault(
  plaintext: object,
  password: string
): Promise<VaultData> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  
  const encoder = new TextEncoder();
  const plaintextBuffer = encoder.encode(JSON.stringify(plaintext));
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintextBuffer
  );
  
  return {
    version: VAULT_VERSION,
    salt: arrayBufferToBase64(salt),
    payload: {
      iv: arrayBufferToBase64(iv),
      data: arrayBufferToBase64(ciphertext),
    },
  };
}

export async function decryptVault(
  vault: VaultData,
  password: string
): Promise<unknown> {
  const salt = new Uint8Array(base64ToArrayBuffer(vault.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(vault.payload.iv));
  const ciphertext = base64ToArrayBuffer(vault.payload.data);

  const key = await deriveKey(password, salt);
  
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(plaintext));
  } catch (e) {
    throw new Error('Invalid password or corrupted vault');
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}


