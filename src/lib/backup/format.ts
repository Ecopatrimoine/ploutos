// ─── Sauvegarde locale chiffree (C7) — format d'enveloppe & utilitaires ─────
//
// Module ISOLE : zero dependance vers lib/calculs/ ou le moteur fiscal. Il ne
// connait que la forme d'un ClientRecord (persistance) et l'enveloppe chiffree.
//
// Le "clair" chiffre est exactement JSON.stringify(ClientRecord[]) — la forme
// COMPLETE de persistance (id, displayName, createdAt, updatedAt, payload),
// jamais l'ancien export lossy. Le chiffrement lui-meme vit dans crypto.ts.

import type { ClientRecord } from "../../useClients";

export const BACKUP_FORMAT = "ploutos-backup" as const;
export const BACKUP_FORMAT_VERSION = 1 as const;
export const BACKUP_EXTENSION = ".ploutosbackup" as const;

// Manifeste porte dans l'enveloppe (champ `notes`) : ce qui est / n'est pas
// inclus dans l'archive. Les pieces jointes integrees (dataUrl) voyagent avec
// le payload ; les documents GED deportes dans le cloud (storagePath) non.
export const BACKUP_MANIFEST_NOTE =
  "Les documents GED stockes dans le cloud (storagePath) ne sont pas inclus ; " +
  "les pieces jointes integrees (dataUrl) le sont.";

// Descriptif de la derivation de cle (PBKDF2) — tout est reproductible cote
// dechiffrement a partir de ces champs + le mot de passe.
export type BackupKdf = {
  algo: "PBKDF2-SHA256";
  iterations: number;
  salt_b64: string; // sel aleatoire (16 octets), base64
};

// Enveloppe serialisee sur disque (fichier .ploutosbackup).
export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  format_version: number;
  exportedAt: string; // ISO
  count: number;      // nombre de dossiers chiffres (indicatif, non autoritaire)
  kdf: BackupKdf;
  iv_b64: string;         // vecteur d'initialisation AES-GCM (12 octets), base64
  ciphertext_b64: string; // JSON.stringify(ClientRecord[]) chiffre, base64
  notes?: string;         // manifeste (cf. BACKUP_MANIFEST_NOTE)
};

// Erreur typee : le `code` permet a l'UI de choisir un message adapte sans
// re-parser le message libre.
export type BackupErrorCode =
  | "bad-format"          // pas une enveloppe ploutos-backup / champs manquants
  | "unsupported-version" // format_version inconnu -> refus explicite
  | "corrupt"             // base64 / JSON illisible
  | "decrypt-failed";     // mauvais mot de passe OU donnee alteree (tag GCM)

export class BackupError extends Error {
  code: BackupErrorCode;
  constructor(code: BackupErrorCode, message: string) {
    super(message);
    this.name = "BackupError";
    this.code = code;
  }
}

// ─── Base64 <-> octets ──────────────────────────────────────────────────────
// btoa/atob sont disponibles cote renderer (web ET Electron). Chunk pour ne pas
// exploser la pile sur de gros contenus (pieces jointes dataUrl).

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  let binary: string;
  try {
    binary = atob(b64);
  } catch {
    throw new BackupError("corrupt", "La sauvegarde est illisible (encodage invalide).");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ─── Enveloppe ──────────────────────────────────────────────────────────────

// Serialise une enveloppe en texte JSON indente (pret a ecrire sur disque).
export function serializeBackup(file: BackupFile): string {
  return JSON.stringify(file, null, 2);
}

// Lit + valide STRUCTURELLEMENT une enveloppe. Ne dechiffre pas.
// Ordre des controles : JSON lisible -> forme ploutos-backup -> version connue
// -> champs crypto presents. Un format_version inconnu est refuse explicitement
// (BackupError "unsupported-version") : on ne tente jamais de dechiffrer un
// format qu'on ne sait pas relire.
export function parseBackupFile(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("bad-format", "Ce fichier n'est pas une sauvegarde Ploutos valide.");
  }
  if (!raw || typeof raw !== "object") {
    throw new BackupError("bad-format", "Ce fichier n'est pas une sauvegarde Ploutos valide.");
  }
  const f = raw as Record<string, unknown>;
  if (f.format !== BACKUP_FORMAT) {
    throw new BackupError("bad-format", "Ce fichier n'est pas une sauvegarde Ploutos (.ploutosbackup).");
  }
  if (typeof f.format_version !== "number" || f.format_version !== BACKUP_FORMAT_VERSION) {
    throw new BackupError(
      "unsupported-version",
      `Version de sauvegarde non prise en charge (attendue ${BACKUP_FORMAT_VERSION}, trouvee ${String(f.format_version)}). Mettez Ploutos a jour.`,
    );
  }
  const kdf = f.kdf as Record<string, unknown> | undefined;
  const kdfOk =
    !!kdf &&
    kdf.algo === "PBKDF2-SHA256" &&
    typeof kdf.iterations === "number" &&
    kdf.iterations > 0 &&
    typeof kdf.salt_b64 === "string";
  if (
    !kdfOk ||
    typeof f.iv_b64 !== "string" ||
    typeof f.ciphertext_b64 !== "string"
  ) {
    throw new BackupError("corrupt", "La sauvegarde est incomplete ou alteree.");
  }
  return raw as BackupFile;
}

// ─── Validation du clair dechiffre ──────────────────────────────────────────
// Apres dechiffrement, on s'assure d'obtenir bien un tableau de ClientRecord
// (au moins id + payload) : garde-fou contre un clair syntaxiquement valide mais
// hors-schema (fichier trafique dont le tag GCM aurait quand meme passe).
export function parseRecordsJson(json: string): ClientRecord[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new BackupError("corrupt", "Le contenu dechiffre est illisible.");
  }
  if (!Array.isArray(raw)) {
    throw new BackupError("corrupt", "Le contenu dechiffre n'est pas une liste de dossiers.");
  }
  for (const r of raw) {
    if (!r || typeof r !== "object" || typeof (r as { id?: unknown }).id !== "string" || !("payload" in r)) {
      throw new BackupError("corrupt", "Un dossier de la sauvegarde est mal forme.");
    }
  }
  return raw as ClientRecord[];
}

// ─── Nom de fichier ─────────────────────────────────────────────────────────
// Slug ASCII-safe (accents retires) + date, extension .ploutosbackup.
export function buildBackupFileName(base: string, isoDate: string): string {
  const day = isoDate.slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const slug = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques combinants (post-NFD)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "sauvegarde";
  return `${slug}-${day}${BACKUP_EXTENSION}`;
}
