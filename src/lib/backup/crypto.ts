// ─── Sauvegarde locale chiffree (C7) — chiffrement AES-GCM / PBKDF2 ─────────
//
// Green-field crypto.subtle cote renderer (identique web/Electron), aucun pont
// IPC. Derivation PBKDF2-SHA256 (>= 600 000 iterations, sel aleatoire 16 o) ->
// cle AES-GCM 256 bits ; chiffrement AES-GCM avec IV aleatoire 12 octets.
//
// Le tag d'authentification GCM garantit qu'un mauvais mot de passe OU une
// donnee alteree font ECHOUER le dechiffrement (exception) plutot que de rendre
// un clair silencieusement faux -> on convertit cet echec en BackupError propre.

import type { ClientRecord } from "../../useClients";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_MANIFEST_NOTE,
  BackupError,
  base64ToBytes,
  bytesToBase64,
  parseRecordsJson,
  type BackupFile,
} from "./format";

// Cout de derivation : >= 600 000 (recommandation OWASP PBKDF2-SHA256). Stocke
// dans l'enveloppe (kdf.iterations) pour rester dechiffrable si on l'augmente.
export const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function subtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new BackupError("decrypt-failed", "Le chiffrement n'est pas disponible dans cet environnement.");
  }
  return c.subtle;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n));
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const keyMaterial = await subtle().importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle().deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// Chiffre un lot de dossiers -> enveloppe prete a serialiser. Le clair est
// exactement JSON.stringify(ClientRecord[]).
export async function encryptBackup(records: ClientRecord[], password: string): Promise<BackupFile> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(records));
  const cipher = await subtle().encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    format: BACKUP_FORMAT,
    format_version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    count: records.length,
    kdf: { algo: "PBKDF2-SHA256", iterations: PBKDF2_ITERATIONS, salt_b64: bytesToBase64(salt) },
    iv_b64: bytesToBase64(iv),
    ciphertext_b64: bytesToBase64(new Uint8Array(cipher)),
    notes: BACKUP_MANIFEST_NOTE,
  };
}

// Dechiffre une enveloppe deja validee structurellement (cf. parseBackupFile).
// Un mot de passe errone ou une donnee alteree -> BackupError "decrypt-failed"
// (jamais de crash ni de clair errone). Le clair est revalide en ClientRecord[].
export async function decryptBackup(file: BackupFile, password: string): Promise<ClientRecord[]> {
  const salt = base64ToBytes(file.kdf.salt_b64);
  const iv = base64ToBytes(file.iv_b64);
  const data = base64ToBytes(file.ciphertext_b64);
  const key = await deriveKey(password, salt, file.kdf.iterations);
  let plainBuf: ArrayBuffer;
  try {
    plainBuf = await subtle().decrypt({ name: "AES-GCM", iv }, key, data);
  } catch {
    throw new BackupError("decrypt-failed", "Mot de passe incorrect, ou sauvegarde alteree.");
  }
  const json = new TextDecoder().decode(plainBuf);
  return parseRecordsJson(json);
}
