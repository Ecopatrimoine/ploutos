// ─── Évaluation de formules de plafond (Lot 4 — extension) ───────────────
//
// Permet d'exprimer un plafond dans le référentiel sous forme de
// formule simple à base de variables réglementaires :
//
//   "1.4 * SMIC_mensuel * 3 / 91.25 * 0.5"
//
// Le SMIC peut être revalorisé en cours d'année — avec une formule,
// la mise à jour de smicMensuelReference dans pass-{N}.json se
// propage automatiquement à tous les plafonds qui en dépendent,
// sans toucher au moteur.
//
// Restrictions volontaires (sécurité) :
//   - opérateurs : * et / uniquement
//   - pas de parenthèses, pas de + ni -, pas d'exposant
//   - évaluation strictement gauche à droite (pas de précédence)
//   - variable inconnue → retourne null (pas de fallback silencieux)

import type { Referentiels } from "../../data/prevoyance";

export type PlafondVariables = Record<string, number>;

export function buildPlafondVariables(ref: Referentiels): PlafondVariables {
  const p = ref.pass as any;
  const smicMensuel =
    typeof p?.smicMensuelReference === "number" ? p.smicMensuelReference : 0;
  return {
    SMIC_mensuel: smicMensuel,
    // SMIC_horaire dérivé : SMIC_mensuel × 12 / (35 × 52).
    // Cohérent avec le commentaire de pass-2026.json (12,02 € × 35 h × 52/12).
    SMIC_horaire: smicMensuel > 0 ? (smicMensuel * 12) / (35 * 52) : 0,
    PASS_annuel: typeof p?.pass?.annuel === "number" ? p.pass.annuel : 0,
    PASS_mensuel: typeof p?.pass?.mensuel === "number" ? p.pass.mensuel : 0,
  };
}

// Caractères autorisés dans la formule : chiffres, point, underscore,
// lettres, espace, * et /. Tout autre caractère est rejeté.
const FORMULA_REGEX = /^[\d\s.*/_A-Za-z]+$/;
// Tokens : nombre (entier ou décimal), identifiant (variable) ou opérateur.
const TOKEN_REGEX = /\d+\.?\d*|[A-Za-z_]\w*|[*/]/g;

export function evalFormulaPlafond(
  formula: string,
  variables: PlafondVariables
): number | null {
  if (typeof formula !== "string" || !FORMULA_REGEX.test(formula)) return null;
  const tokens = formula.match(TOKEN_REGEX);
  if (!tokens || tokens.length === 0) return null;

  let result: number | null = null;
  let op: "*" | "/" = "*";

  for (const t of tokens) {
    if (t === "*" || t === "/") {
      op = t;
      continue;
    }
    let value: number;
    if (/^[\d.]+$/.test(t)) {
      value = parseFloat(t);
      if (!Number.isFinite(value)) return null;
    } else if (Object.prototype.hasOwnProperty.call(variables, t)) {
      value = variables[t];
    } else {
      // variable inconnue → on refuse plutôt que d'inventer une valeur
      return null;
    }
    if (result === null) {
      result = value;
    } else if (op === "*") {
      result *= value;
    } else {
      if (value === 0) return null;
      result /= value;
    }
  }

  if (result === null || !Number.isFinite(result)) return null;
  return result;
}
