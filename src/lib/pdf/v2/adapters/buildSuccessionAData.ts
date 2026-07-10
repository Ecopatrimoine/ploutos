// ─── Lot Dossier client — Adapter Succession A v2 ────────────────────
//
// Mappe `computeSuccession()` vers SuccessionAPageData. Le moteur calcule
// la masse civile, les droits par héritier, les abattements.

import type { SuccessionAPageData } from "../pages/pageSuccessionA";
import { euro, pct, plur } from "../../../calculs/utils";

export type BuildSuccessionADataParams = {
  succession: any;
  data: Record<string, any>;
  cabinet: Record<string, any>;
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
  notreLecture?: string;
};

export function buildSuccessionAData(p: BuildSuccessionADataParams): SuccessionAPageData {
  const s = p.succession || {};
  const cabinet = p.cabinet || {};
  const data = p.data || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2 ? `${p1} & ${p2}` : (data.person1LastName || p1)) || "Client";

  // ─── Héritiers — mapping trivial sur les champs dérivés du moteur ──
  // SOURCE UNIQUE : computeSuccession() expose déjà partRecueFiscale, netFiscal
  // et compositionFiscale (cf. succession.ts ligne ~699-713). Aucun recalcul
  // ici → impossible que le PDF diverge de l'UI.
  const heritiersRaw: any[] = Array.isArray(s.results) ? s.results : [];
  const heritiers = heritiersRaw.map(h => {
    const partRecue = num(h.partRecueFiscale ?? 0);
    const abattement = num(h.allowance ?? 0);
    const droits = num(h.successionDuties ?? 0);
    const droitsExonere = droits === 0 && (h.relation === "conjoint" || h.relation === "pacs_partner") && isCouple;
    const net = Math.max(0, partRecue - droits);
    // Rappel fiscal des donations < 15 ans (Lot D) — SOURCE UNIQUE h.rappelApplique
    // (moteur). Detail affiche en mode auto uniquement (abattement residuel).
    const ra = h.rappelApplique || null;
    const rappelAuto = !!ra && ra.mode === "auto" && num(ra.abattementConsomme) > 0;
    return {
      nom: h.name || "Héritier",
      lien: relationLabel(h.relation),
      partRecue,
      abattement: abattement > 0 ? abattement : undefined,
      rappel: rappelAuto ? {
        plein: abattement,
        consomme: num(ra.abattementConsomme),
        residuel: Math.max(0, abattement - num(ra.abattementConsomme)),
        reprise: num(ra.baseTaxeeAnterieure) > 0 ? num(ra.baseTaxeeAnterieure) : undefined,
      } : undefined,
      aVerifier: (!!ra && ra.aVerifier) || undefined,
      droits,
      droitsExonere: droitsExonere || undefined,
      net,
      composition: h.compositionFiscale || undefined,
    };
  });

  // ─── KPI dérivés des héritiers (cohérence garantie avec le tableau) ──
  // Les totaux affichés en KPI haut de page = SOMME des valeurs par héritier.
  // Évite l'écart entre KPI (clé succession.activeNet = économique brute) et
  // tableau héritier (formule fiscale). Si les héritiers sont vides, fallback
  // sur les clés succession globales.
  const masseSuccessoraleNette = heritiers.length > 0
    ? heritiers.reduce((sum, h) => sum + h.partRecue, 0)
    : num(s.activeNet ?? s.netCivil ?? 0);
  const droitsSuccession = heritiers.length > 0
    ? heritiers.reduce((sum, h) => sum + h.droits, 0)
    : num(s.totalRights ?? s.totalTax ?? 0);
  const netTransmis = masseSuccessoraleNette - droitsSuccession;
  const tauxMoyenPct = masseSuccessoraleNette > 0
    ? (droitsSuccession / masseSuccessoraleNette) * 100
    : 0;
  const tauxMoyen = pct(tauxMoyenPct / 100, 1);

  // Dévolution — SOURCE = sorties MOTEUR (les MÊMES que l'écran : encart conjoint + camembert
  // « Cadre légal »), JAMAIS data.childrenData. Les RÉSERVATAIRES DU DÉFUNT (reserveChildrenCount,
  // filtrés sur parentLink = défunt), la quotité disponible et l'option conjoint CHOISIE viennent
  // de computeSuccession. (Bug G5-A : le PDF comptait les enfants du foyer + option légale figée.)
  const reservataires = num(s.reserveChildrenCount ?? 0);
  const quotiteFallback = reservataires === 1 ? 0.5 : reservataires === 2 ? 1 / 3 : reservataires >= 3 ? 0.25 : 1;
  const quotiteFrac = typeof s.quotiteDisponible === "number" ? s.quotiteDisponible : quotiteFallback;
  const quotitePct = Math.round(quotiteFrac * 100);
  const reservePct = 100 - quotitePct;
  const reserveMontant = num(s.legalReserveAmount ?? Math.round(masseSuccessoraleNette * reservePct / 100));
  const quotiteMontant = num(s.legalDisposableAmount ?? (masseSuccessoraleNette - reserveMontant));
  const reserveFraction = reservataires === 1 ? "1/2" : reservataires === 2 ? "2/3" : reservataires >= 3 ? "3/4" : "—";
  const quotiteFraction = reservataires === 1 ? "1/2" : reservataires === 2 ? "1/3" : reservataires >= 3 ? "1/4" : "totale";

  // Badge + description dévolution composés depuis l'option MOTEUR choisie (DDV vs légale).
  const devolutionBadge = String(s.spouseOption || "").startsWith("ddv") ? "Donation au dernier vivant" : "Dévolution légale";
  const devolutionDescription = describeDevolution(s, data, reservataires);

  return {
    clientName,
    dateStr,
    masseSuccessoraleNette,
    droitsSuccession,
    netTransmis,
    tauxMoyen,
    noteKpi: "Masse civile, hors assurance-vie et PER (transmis hors succession — voir page suivante).",
    devolutionBadge,
    devolutionDescription,
    reservePct,
    reserveLabel: `Réserve héréditaire · ${reserveFraction}`,
    reserveMontant,
    quotitePct,
    quotiteLabel: `Quotité dispo. · ${quotiteFraction}`,
    quotiteMontant,
    heritiers,
    notreLecture: p.notreLecture || (() => {
      const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
      const hasConjoint = isCouple;

      // Leviers contextuels
      const leviers: string[] = [];
      if (reservataires > 0 && droitsSuccession > 0) {
        leviers.push("donation-partage de la quotité disponible (figure les valeurs, évite les conflits ultérieurs)");
        leviers.push("démembrement temporaire (donation de nue-propriété, conjoint usufruitier) — abat la base taxable selon le barème de l'usufruit (art. 669 CGI)");
      }
      if (hasConjoint) {
        leviers.push("option du conjoint à arbitrer (¼ PP / usufruit total / ¼ PP + ¾ usufruit) selon objectif protection vs transmission rapide");
      }
      if (masseSuccessoraleNette > 500_000 && reservataires > 0) {
        leviers.push("AV avec clause bénéficiaire structurée (transmission hors succession civile, abattement 152 500 € par bénéficiaire avant 70 ans)");
      }
      if (leviers.length === 0) {
        leviers.push("Aucun levier prioritaire — situation simple, à revoir lors d'événements familiaux ou patrimoniaux");
      }

      return `
        <p style="margin:0 0 10px 0">La transmission civile dépend du <strong>régime matrimonial</strong>, du <strong>nombre d'enfants</strong> et de l'<strong>option du conjoint</strong>. Le conjoint marié ou pacsé est exonéré de droits (CGI art. 796-0 bis) ; chaque enfant bénéficie d'un abattement de 100 000 €.</p>
        <ul style="margin:0 0 10px 0;padding-left:18px;line-height:1.7">
          <li><strong>Masse civile nette</strong> — ${euro(masseSuccessoraleNette)} (hors assurance-vie, voir page suivante).</li>
          <li><strong>Droits estimés</strong> — ${droitsSuccession > 0
            ? `${euro(droitsSuccession)} (taux moyen ${tauxMoyen}). Net transmis : ${euro(netTransmis)}.`
            : `Aucun droit dû (exonération conjoint/PACS ou base sous abattements).`}</li>
          <li><strong>Quotité civile</strong> — ${reservataires > 0
            ? `Réserve héréditaire ${reserveFraction} = ${euro(reserveMontant)} (bloquée pour les enfants). Quotité disponible ${quotiteFraction} = ${euro(quotiteMontant)} (libre allocation).`
            : `Pas d'enfant : quotité disponible = totalité du patrimoine.`}</li>
        </ul>
        <p style="margin:0;font-style:italic;color:#6B6353"><strong>Leviers à étudier :</strong> ${leviers.join(" ; ")}.</p>
      `.trim();
    })(),
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied: `${cabinet.cabinetName || cabinet.nom || "Cabinet"} · Transmission — confidentiel`,
  };
}

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v.replace(/\s/g, "").replace(",", ".")) : (v || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}


function relationLabel(r: any): string {
  if (!r) return "Héritier";
  const map: Record<string, string> = {
    "conjoint": "Conjoint",
    "enfant": "Enfant",
    "petit-enfant": "Petit-enfant",
    "frere-soeur": "Frère/Sœur",
    "parent": "Parent",
    "autre": "Autre",
  };
  return map[String(r).toLowerCase()] || String(r);
}

// Description dévolution = réservataires du DÉFUNT + option conjoint CHOISIE (label moteur,
// même source que le select écran) + démembrement US/NP (art. 669) si l'option est en usufruit.
function describeDevolution(s: Record<string, any>, data: Record<string, any>, reservataires: number): string {
  const parts: string[] = [];
  if (reservataires > 0) parts.push(plur(reservataires, "enfant réservataire"));
  if (s.spouseEligible) {
    const opt = Array.isArray(s.spouseOptions) ? s.spouseOptions.find((o: any) => o?.value === s.spouseOption) : null;
    let txt = "conjoint";
    if (opt?.label) txt += ` — ${opt.label}`;
    const dem = s.demembrementPct;
    if (dem && typeof dem.usufruct === "number" && opt?.label && /usufruit/i.test(opt.label)) {
      txt += ` (US ${pct(dem.usufruct, 0)} / NP ${pct(dem.nuePropriete, 0)})`;
    }
    parts.push(txt);
  } else if (data.coupleStatus === "cohab") {
    parts.push("concubin (non héritier légal — taxation 60 %)");
  }
  return parts.join(" · ") || "Dévolution à préciser";
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
