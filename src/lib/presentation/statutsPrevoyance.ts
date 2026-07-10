// LOT 11 — SOURCE UNIQUE des libellés de STATUT professionnel (présentation).
// Ce libellé était re-tapé à l'identique dans TabPrevoyancePerso (écran) ET dans
// buildPrevoyancePersoData (PDF) — deux copies byte-à-byte. On le rapatrie ici, dans
// la couche de présentation (zéro moteur), consommé par les deux surfaces.
import type { StatutPro } from "../../types/patrimoine";

// Libellé long affiché (KPI PDF, ligne « Statut : » écran). Inconnu → « — ».
const LIBELLE_STATUT: Record<string, string> = {
  salarie_non_cadre: "Salarié non-cadre",
  salarie_cadre: "Salarié cadre",
  tns_liberal: "TNS — profession libérale",
  tns_commercant: "TNS — commerçant",
  tns_artisan: "TNS — artisan",
  gerant_majoritaire: "Gérant majoritaire",
  president_sas: "Président SAS / SASU",
  eurl_unique: "EURL gérant non majoritaire",
  fonctionnaire: "Fonctionnaire",
  retraite: "Retraité",
  sans_activite: "Sans activité",
};

export function libelleStatut(statut: StatutPro | "" | string | null | undefined): string {
  return (statut && LIBELLE_STATUT[statut]) || "—";
}
