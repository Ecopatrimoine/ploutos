// ─── Textes legaux partages (PDF v2) ──────────────────────────────────────────
//
// Source UNIQUE des mentions reglementaires reutilisees par plusieurs documents,
// pour eviter toute divergence de formulation.
//
// 🔴 ZONE SENSIBLE (conformite) : ne pas modifier le TEXTE sans validation. Toute
// retouche de formulation doit etre intentionnelle et revue.

// Mention DDA / non-contractuelle du module Prevoyance (perso + collective).
// Texte STRICTEMENT identique a celui historiquement code en dur dans
// buildPrevoyancePersoData.ts et buildPrevoyanceCollData.ts — centralise ici sans
// changer un seul caractere (deduplication). `cabinet` = denomination du cabinet ;
// `orias` = numero ORIAS. Interpolation finale : "<cabinet> — ORIAS n° <orias>.".
export function mentionDDAPrevoyance(cabinet: string, orias: string): string {
  return (
    `Document remis à titre indicatif — analyse non contractuelle. Ne constitue ni un conseil en ` +
    `investissement au sens de l'art. L.541-1 et s. CMF, ni un conseil en distribution d'assurance au ` +
    `sens de l'art. L.521-4 C. ass. Toute mise en place de couverture doit faire l'objet d'un devoir de ` +
    `conseil formalisé et d'une recommandation personnalisée par un intermédiaire habilité. ` +
    `${cabinet} — ORIAS n° ${orias}.`
  );
}
