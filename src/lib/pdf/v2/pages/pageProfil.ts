// ─── Lot 9 — Page Profil & conformité v2 (4 niveaux + ESG) ──────────────
//
// Reproduit la maquette refonte_pdf_profil_conformite_4niveaux_esg, avec
// 2 itérations validées par le user pour le rapport patrimonial :
//   • Le tableau détaillé des réponses MIF II est REMPLACÉ par un résumé
//     court qui renvoie à la déclaration d'adéquation (document opposable
//     qui contient le détail) — évite la redondance documentaire.
//   • Ajout d'un encart de SIGNATURE (client + conseiller) — sans signature,
//     le profil n'est pas opposable au regard de la DDA / RG AMF.

import {
  header,
  bandeKPI,
  sousTitreSection,
  echelleSegments,
  encartAdequation,
  encartSignature,
  piedPage,
  coquillePage,
  type QAItem,
} from "../primitives";
import type { Tokens } from "../tokens";

export type ProfilNiveau = "prudent" | "équilibré" | "dynamique" | "offensif";

export type ProfilPageData = {
  // En-tête
  clientName: string;       // "Dubreuil"
  dateStr: string;          // "25 mai 2026"
  // KPI
  profilRisque: string;     // "Équilibré"
  scoreMifII: string;       // "38 / 66"
  horizonPlacement: string; // "8 ans"
  capacitePerte: string;    // "Modérée"
  // Note sous KPI
  noteKpi: string;
  // Échelle 4 niveaux
  niveauActif: ProfilNiveau;
  // Questionnaire MIF II complet (6 lignes) — rappelé dans le rapport, le
  // détail opposable vit dans la Déclaration d'adéquation (mention de renvoi
  // affichée en tête de l'encadré).
  questionnaire: QAItem[];
  // Adéquation
  adequationTitre: string;        // "Adéquation MIF II"
  adequationTexte: string;
  // Signature (Lot 9 — ajout opposabilité)
  nomClientSignature: string;     // "Hélène & Marc Dubreuil"
  nomConseiller: string;          // "David Perry"
  villeSignature?: string;        // pré-rempli depuis cabinet.ville
  dateSignature?: string;         // pré-rempli depuis la date du rapport
  signatureConseillerSrc?: string;
  // Pied
  pagePosition: string;           // "6 / 8"
  cabinetLibellePied: string;
};

const NIVEAUX_ORDRE: ProfilNiveau[] = ["prudent", "équilibré", "dynamique", "offensif"];
const NIVEAUX_LABELS = ["Prudent", "Équilibré", "Dynamique", "Offensif"];

export function pageProfil(t: Tokens, d: ProfilPageData): string {
  // ─── KPI band (compact, 4 KPI ; valueFontSize pour libellés textuels) ──
  const kpis = [
    { label: "Profil de risque",            value: d.profilRisque,     type: "main"   as const, valueFontSize: "16px" },
    { label: "Score MIF II",                value: d.scoreMifII,       type: "normal" as const },
    { label: "Horizon de placement",        value: d.horizonPlacement, type: "normal" as const },
    { label: "Capacité à subir des pertes", value: d.capacitePerte,    type: "normal" as const, valueFontSize: "13px" },
  ];

  const activeIndex = NIVEAUX_ORDRE.indexOf(d.niveauActif);

  // ─── Questionnaire MIF II — 6 lignes complètes + mention de renvoi ────
  // La mention « voir Déclaration d'adéquation jointe » reste affichée en
  // tête de l'encadré (hiérarchie des documents : rapport = présentation,
  // déclaration d'adéquation = document opposable).
  const renderQA = (it: QAItem, isLast: boolean) => {
    const border = isLast ? "border-bottom:none" : `border-bottom:1px solid ${t.bordureClaire}`;
    const colorR = it.reponseCouleur || t.texte;
    return `<div style="display:flex;justify-content:space-between;gap:14px;padding:6.5px 0;${border}">
      <span class="lt" style="font-size:11px;color:${t.texteFaible}">${it.question}</span>
      <span class="lt" style="font-size:11px;color:${colorR};font-weight:700;text-align:right">${it.reponse}</span>
    </div>`;
  };
  const syntheseHtml = `
    <div style="border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:5px 16px 7px;margin-top:11px">
      <div class="lt" style="font-size:10.5px;color:${t.texteFaible};line-height:1.55;padding:8px 0 9px;border-bottom:1px solid ${t.bordureClaire};margin-bottom:2px">
        Questionnaire MIF II complet : voir <strong style="color:${t.navy}">Déclaration d'adéquation</strong> jointe.
      </div>
      ${d.questionnaire.map((it, i) => renderQA(it, i === d.questionnaire.length - 1)).join("")}
    </div>
  `;

  // ─── Assemblage ──
  const contenu = `
    ${header(t, {
      eyebrow: "Conformité",
      titre: "Profil investisseur",
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    })}

    ${bandeKPI(t, kpis)}
    <div class="lt" style="font-size:9px;color:${t.texteFaibleClair};margin-top:6px;line-height:1.4">${d.noteKpi}</div>

    <div style="margin-top:18px">
      ${sousTitreSection(t, "Profil sur l'échelle de risque")}
      ${echelleSegments(t, {
        segments: NIVEAUX_LABELS,
        activeIndex: activeIndex >= 0 ? activeIndex : 1,
        labelCurseur: "▲ votre profil",
      })}
    </div>

    <div style="margin-top:14px">
      ${sousTitreSection(t, "Synthèse du questionnaire MIF II")}
      ${syntheseHtml}
    </div>

    ${encartAdequation(t, {
      titre: d.adequationTitre,
      texte: d.adequationTexte,
    })}
  `;

  // Lot 9 — la signature est calée en BAS DE PAGE (slot absolu de coquillePage),
  // toujours au même endroit quel que soit le volume du contenu au-dessus.
  const signature = encartSignature(t, {
    nomClient: d.nomClientSignature,
    nomConseiller: d.nomConseiller,
    ville: d.villeSignature,
    date: d.dateSignature,
    signatureConseillerSrc: d.signatureConseillerSrc,
  });

  const pied = piedPage(t, {
    gauche: d.cabinetLibellePied,
    droite: d.pagePosition,
  });

  return coquillePage(t, { contenu, pied, signature });
}
