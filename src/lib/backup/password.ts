// ─── Sauvegarde locale chiffree (C7) — regles de mot de passe ───────────────
//
// Le mot de passe protege une archive dont la perte = donnees definitivement
// illisibles. Regles minimales exigees a la SAISIE (export) : >= 12 caracteres,
// >= 1 majuscule, >= 1 caractere special. Pur & testable — aucune I/O.

export type PasswordCheck = {
  ok: boolean;
  errors: string[]; // messages clairs, prets a afficher (liste des regles non tenues)
};

const MIN_LENGTH = 12;

// Majuscule : toute lettre majuscule Unicode (A-Z et accentuees).
const HAS_UPPER = /\p{Lu}/u;
// Caractere special : ni lettre (toute langue), ni chiffre -> exclut les
// lettres accentuees (e accent n'est PAS un caractere special).
const HAS_SPECIAL = /[^\p{L}\p{N}]/u;

export function validatePassword(password: string): PasswordCheck {
  const errors: string[] = [];
  if (password.length < MIN_LENGTH) {
    errors.push(`Au moins ${MIN_LENGTH} caracteres.`);
  }
  if (!HAS_UPPER.test(password)) {
    errors.push("Au moins une majuscule.");
  }
  if (!HAS_SPECIAL.test(password)) {
    errors.push("Au moins un caractere special (par ex. ! ? @ # - _).");
  }
  return { ok: errors.length === 0, errors };
}
