// ─── Helper conformité — vocabulaire réglementaire écran (Lot 5) ─────────────
//
// Renvoie le vocabulaire réglementaire à employer dans les LIBELLÉS ÉCRAN
// selon les statuts ORIAS actifs du cabinet.
//
// Source unique du vocabulaire réglementaire écran ET PDF v2.
// Exemple : un cabinet COA seul n'exerce pas le conseil en investissements
// financiers et ne cite donc pas « MIF II ». Le terme « MIF II » affiché à
// l'écran (profil, adéquation) doit être remplacé par « assurance-vie / DDA ».
// Un cabinet cochant aussi CIF garde « MIF II ».

import type { StatutFlags } from "./referencesLegales";

export type VocabulaireReglementaire = {
  /** Comment nommer le cadre réglementaire (MIF II / DDA / les deux / —). */
  cadreReglementaire: string;
  /** Comment nommer la pratique d'investissement principale. */
  investissementPrincipal: string;
  /** Référence à employer pour le profil investisseur / l'adéquation. */
  reglementationProfil: string;
};

export function vocabulaireReglementaire(statuts: StatutFlags): VocabulaireReglementaire {
  // Un cabinet CIF (avec ou sans COA/MIA) cite MIF II.
  if (statuts.cif) {
    if (statuts.coa || statuts.mia) {
      return {
        cadreReglementaire: "MIF II + DDA",
        investissementPrincipal: "instruments financiers et assurance-vie",
        reglementationProfil: "MIF II + DDA",
      };
    }
    return {
      cadreReglementaire: "MIF II",
      investissementPrincipal: "instruments financiers",
      reglementationProfil: "MIF II",
    };
  }
  // Pas de CIF → on ne cite ni MIF II ni RG AMF.
  if (statuts.coa || statuts.mia) {
    return {
      cadreReglementaire: "DDA",
      investissementPrincipal: "assurance-vie",
      reglementationProfil: "assurance-vie / DDA",
    };
  }
  // Aucun statut assurance ni CIF — fallback neutre, aucune mention MIF.
  return {
    cadreReglementaire: "—",
    investissementPrincipal: "—",
    reglementationProfil: "—",
  };
}
