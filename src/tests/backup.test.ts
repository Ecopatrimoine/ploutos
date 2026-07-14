// C7 — Sauvegarde locale chiffree : tests unitaires du module isole
// (src/lib/backup). Environnement `node` (defaut vitest) : crypto.subtle,
// btoa/atob, TextEncoder disponibles nativement. Aucune I/O, aucun DOM.
//
// Couverture : round-trip chiffre/dechiffre de N dossiers, mauvais mot de passe
// -> erreur propre (pas de crash), enveloppe corrompue / version inconnue ->
// erreur propre, et validatePassword (cas limites).

import { describe, it, expect, beforeAll } from "vitest";
import type { ClientRecord } from "../useClients";
import { encryptBackup, decryptBackup, PBKDF2_ITERATIONS } from "../lib/backup/crypto";
import {
  parseBackupFile,
  serializeBackup,
  buildBackupFileName,
  BackupError,
  BACKUP_FORMAT,
  BACKUP_MANIFEST_NOTE,
  type BackupFile,
} from "../lib/backup/format";
import { validatePassword } from "../lib/backup/password";

const PASSWORD = "Coffre-Fort#2026";

const rec = (id: string, name: string): ClientRecord => ({
  id,
  displayName: name,
  createdAt: "2026-01-01T08:00:00.000Z",
  updatedAt: "2026-02-01T09:30:00.000Z",
  payload: {
    clientName: name,
    notes: `notes ${name}`,
    data: { person1LastName: name, properties: [], placements: [] },
    recommandations: [{ id: "r1", texte: "diversifier" }],
    piecesJointes: [{ id: "p1", dataUrl: "data:text/plain;base64,QUJD" }],
  },
});

const RECORDS: ClientRecord[] = [rec("id-1", "Delacroix"), rec("id-2", "Hélène"), rec("id-3", "Zébulon")];

// Une seule enveloppe chiffree partagee : limite le nombre de derivations PBKDF2
// (600k iterations) executees pendant la suite.
let envelope: BackupFile;
let serialized: string;

beforeAll(async () => {
  envelope = await encryptBackup(RECORDS, PASSWORD);
  serialized = serializeBackup(envelope);
});

describe("C7 backup — enveloppe", () => {
  it("porte le format, la version, le compte et le manifeste", () => {
    expect(envelope.format).toBe(BACKUP_FORMAT);
    expect(envelope.format_version).toBe(1);
    expect(envelope.count).toBe(RECORDS.length);
    expect(envelope.notes).toBe(BACKUP_MANIFEST_NOTE);
  });

  it("derive avec PBKDF2-SHA256 >= 600000 iterations, sel et IV presents", () => {
    expect(envelope.kdf.algo).toBe("PBKDF2-SHA256");
    expect(envelope.kdf.iterations).toBe(PBKDF2_ITERATIONS);
    expect(envelope.kdf.iterations).toBeGreaterThanOrEqual(600_000);
    expect(envelope.kdf.salt_b64.length).toBeGreaterThan(0);
    expect(envelope.iv_b64.length).toBeGreaterThan(0);
  });

  it("ne laisse aucun nom de dossier en clair dans le ciphertext", () => {
    // Sanity : le chiffrement masque bien les donnees (pas de fuite evidente).
    expect(serialized).not.toContain("Delacroix");
    expect(serialized).not.toContain("diversifier");
  });
});

describe("C7 backup — round-trip", () => {
  it("dechiffre a l'identique N dossiers (via serialize -> parse -> decrypt)", async () => {
    const parsed = parseBackupFile(serialized);
    const out = await decryptBackup(parsed, PASSWORD);
    expect(out).toEqual(RECORDS);
  });

  it("preserve un lot vide", async () => {
    const env = await encryptBackup([], PASSWORD);
    const out = await decryptBackup(env, PASSWORD);
    expect(out).toEqual([]);
    expect(env.count).toBe(0);
  });
});

describe("C7 backup — erreurs propres (pas de crash)", () => {
  it("mauvais mot de passe -> BackupError decrypt-failed", async () => {
    try {
      await decryptBackup(envelope, "MauvaisMot#2026");
      throw new Error("aurait du echouer");
    } catch (e) {
      expect(e).toBeInstanceOf(BackupError);
      expect((e as BackupError).code).toBe("decrypt-failed");
    }
  });

  it("ciphertext altere (tag GCM) -> BackupError decrypt-failed", async () => {
    // Mutation d'un caractere au milieu du base64 : reste decodable, mais le tag
    // d'authentification GCM echoue -> dechiffrement refuse.
    const i = Math.floor(envelope.ciphertext_b64.length / 2);
    const ch = envelope.ciphertext_b64[i];
    const swapped = ch === "A" ? "B" : "A";
    const tampered: BackupFile = {
      ...envelope,
      ciphertext_b64: envelope.ciphertext_b64.slice(0, i) + swapped + envelope.ciphertext_b64.slice(i + 1),
    };
    try {
      await decryptBackup(tampered, PASSWORD);
      throw new Error("aurait du echouer");
    } catch (e) {
      expect(e).toBeInstanceOf(BackupError);
      expect((e as BackupError).code).toBe("decrypt-failed");
    }
  });

  it("ciphertext non-base64 -> BackupError corrupt", async () => {
    const bad: BackupFile = { ...envelope, ciphertext_b64: "£££ pas du base64 £££" };
    try {
      await decryptBackup(bad, PASSWORD);
      throw new Error("aurait du echouer");
    } catch (e) {
      expect(e).toBeInstanceOf(BackupError);
      expect((e as BackupError).code).toBe("corrupt");
    }
  });

  it("JSON illisible -> BackupError bad-format", () => {
    expect(() => parseBackupFile("{ ceci n'est pas du json")).toThrowError(BackupError);
    try {
      parseBackupFile("pas du tout du json");
    } catch (e) {
      expect((e as BackupError).code).toBe("bad-format");
    }
  });

  it("fichier etranger (format absent) -> BackupError bad-format", () => {
    try {
      parseBackupFile(JSON.stringify({ hello: "world" }));
      throw new Error("aurait du echouer");
    } catch (e) {
      expect((e as BackupError).code).toBe("bad-format");
    }
  });

  it("version inconnue -> BackupError unsupported-version (refus explicite)", () => {
    const future = serializeBackup({ ...envelope, format_version: 2 });
    try {
      parseBackupFile(future);
      throw new Error("aurait du echouer");
    } catch (e) {
      expect(e).toBeInstanceOf(BackupError);
      expect((e as BackupError).code).toBe("unsupported-version");
    }
  });

  it("champs crypto manquants -> BackupError corrupt", () => {
    const incomplete = JSON.stringify({ format: BACKUP_FORMAT, format_version: 1 });
    try {
      parseBackupFile(incomplete);
      throw new Error("aurait du echouer");
    } catch (e) {
      expect((e as BackupError).code).toBe("corrupt");
    }
  });
});

describe("C7 backup — validatePassword", () => {
  it("accepte >= 12 caracteres avec majuscule + special", () => {
    expect(validatePassword("Coffre-Fort#2026").ok).toBe(true);
    expect(validatePassword("Azerty123456!").ok).toBe(true);
  });

  it("refuse trop court (< 12)", () => {
    const r = validatePassword("Court#1");
    expect(r.ok).toBe(false);
    expect(r.errors.some((m) => m.includes("12"))).toBe(true);
  });

  it("refuse sans majuscule", () => {
    const r = validatePassword("minuscule#2026");
    expect(r.ok).toBe(false);
    expect(r.errors.some((m) => m.toLowerCase().includes("majuscule"))).toBe(true);
  });

  it("refuse sans caractere special", () => {
    const r = validatePassword("SansSpecial2026");
    expect(r.ok).toBe(false);
    expect(r.errors.some((m) => m.toLowerCase().includes("special"))).toBe(true);
  });

  it("une lettre accentuee ne compte PAS comme caractere special", () => {
    // "é" est une lettre : ce mot n'a ni special ni... il a une majuscule (M).
    const r = validatePassword("Motdepasseéééé");
    expect(r.ok).toBe(false);
    expect(r.errors.some((m) => m.toLowerCase().includes("special"))).toBe(true);
  });

  it("cumule plusieurs regles non tenues", () => {
    const r = validatePassword("court"); // < 12, pas de majuscule, pas de special
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("C7 backup — nom de fichier", () => {
  it("slugifie (accents retires), ajoute la date et l'extension", () => {
    expect(buildBackupFileName("Hélène Delacroix", "2026-07-14T10:00:00.000Z"))
      .toBe("helene-delacroix-20260714.ploutosbackup");
  });

  it("retombe sur 'sauvegarde' si le nom ne donne aucun caractere utile", () => {
    expect(buildBackupFileName("   ---   ", "2026-07-14T00:00:00.000Z"))
      .toBe("sauvegarde-20260714.ploutosbackup");
  });
});
