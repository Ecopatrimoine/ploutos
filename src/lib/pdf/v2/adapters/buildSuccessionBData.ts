// ─── Lot Dossier client — Adapter Succession B (AV & transmission) ───
//
// Reprend les bénéficiaires de l'assurance-vie depuis le résultat
// succession + computeSuccession (volet AV/PER) et calcule le total
// consolidé transmis (succession + AV).

import type { SuccessionBPageData, BeneficiaireAV } from "../pages/pageSuccessionB";

const ABATTEMENT_990I = 152_500;

export type BuildSuccessionBDataParams = {
  succession: any;
  data: Record<string, any>;
  cabinet: Record<string, any>;
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
  notreLecture?: string;
};

export function buildSuccessionBData(p: BuildSuccessionBDataParams): SuccessionBPageData {
  const s = p.succession || {};
  const cabinet = p.cabinet || {};
  const data = p.data || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2 ? `${p1} & ${p2}` : (data.person1LastName || p1)) || "Client";

  // ─── Bénéficiaires AV ─────────────────────────────────────────────
  // Clé réelle : succession.avLines[] = lignes individuelles (1 par contrat
  // × bénéficiaire). On agrège par bénéficiaire pour la page (un même nom
  // peut avoir plusieurs contrats AV/PER).
  const avLines: any[] = Array.isArray(s.avLines) ? s.avLines : [];

  const benefMap = new Map<string, { amount: number; capitalAvant70: number; tax990I: number; tax757B: number; tax: number; relation: string }>();
  for (const line of avLines) {
    const key = String(line.beneficiary || "Bénéficiaire");
    if (!benefMap.has(key)) {
      benefMap.set(key, { amount: 0, capitalAvant70: 0, tax990I: 0, tax757B: 0, tax: 0, relation: line.relation || "—" });
    }
    const agg = benefMap.get(key)!;
    agg.amount += num(line.amount ?? 0);
    agg.capitalAvant70 += num(line.amountBefore70Capital ?? 0);   // base 990 I (versements avant 70 ans)
    agg.tax990I += num(line.before70Tax ?? 0);
    agg.tax757B += num(line.after70Tax ?? 0);
    // Fiscalité totale : totalTax si fourni (avLines réels + fixtures legacy), sinon la somme
    // des deux régimes — n'altère JAMAIS le net déjà testé (successionB-pdf.coherence).
    agg.tax += num(line.totalTax ?? ((line.before70Tax ?? 0) + (line.after70Tax ?? 0)));
  }

  const beneficiaires: BeneficiaireAV[] = Array.from(benefMap.entries()).map(([nom, agg]) => ({
    nom,
    lien: relationLabel(agg.relation),
    capital: agg.amount,
    // Abattement 990 I INDIVIDUEL (152 500 €) uniquement si part avant 70 ans ; sinon 0
    // (le 757 B est un abattement GLOBAL de 30 500 €, jamais par bénéficiaire — cf. note).
    abattement990I: agg.capitalAvant70 > 0 ? ABATTEMENT_990I : 0,
    tax990I: agg.tax990I,
    tax757B: agg.tax757B,
    fiscalite: agg.tax,
    net: agg.amount - agg.tax,
  }));

  // KPI
  const capitauxTransmis = beneficiaires.reduce((s, b) => s + b.capital, 0);
  const fiscaliteTotale = beneficiaires.reduce((s, b) => s + b.fiscalite, 0);
  const netAuxBeneficiaires = capitauxTransmis - fiscaliteTotale;

  // Abattement restant : approximation par bénéficiaire (152 500 € × nb − capital cumulé)
  const abattementTotal = ABATTEMENT_990I * Math.max(1, beneficiaires.length);
  const abattementRestant = Math.max(0, abattementTotal - capitauxTransmis);

  // Total consolidé succession + AV
  const masseSuccessoraleCivile = num(s.activeNet ?? s.netCivil ?? 0);
  // LOT 3 — droits CIVILS uniquement (totalSuccessionRights). totalRights inclut
  // aussi les droits AV des héritiers ; or la fiscalité AV est déjà retranchée via
  // netAuxBeneficiaires (somme sur avLines). Utiliser totalRights ici soustrairait
  // deux fois la fiscalité AV des héritiers. Fallback conservé pour données legacy.
  const droitsSuccession = num(s.totalSuccessionRights ?? s.totalRights ?? s.totalTax ?? 0);
  const netCivilTransmis = masseSuccessoraleCivile - droitsSuccession;
  const totalNetTransmis = netCivilTransmis + netAuxBeneficiaires;

  return {
    clientName,
    dateStr,
    capitauxTransmis,
    fiscaliteTotale,
    netAuxBeneficiaires,
    abattementRestant,
    noteKpi: "Régime : 990 I pour les versements avant 70 ans (abattement de 152 500 € par bénéficiaire) ; 757 B après 70 ans (abattement global de 30 500 €).",
    beneficiaires,
    clauseBeneficiaireHtml: data.clauseBeneficiaire || "Clause bénéficiaire retenue : <em>mes enfants vivants ou représentés, par parts égales</em>.",
    totalNetTransmis,
    // Bandeau consolidé = MÊME chiffre et MÊME nom que le KPI net global de l'écran.
    totalLabelHaut: "Net transmis — tous bénéficiaires",
    totalLabelBas: "(succession + assurance-vie)",
    notreLecture: p.notreLecture || (() => {
      const nbBenefs = Math.max(0, beneficiaires.length);
      const aucunBenef = nbBenefs === 0;
      const fiscaliteNulle = fiscaliteTotale === 0;

      // Leviers contextuels
      const leviers: string[] = [];
      if (aucunBenef) {
        leviers.push("rédiger une clause bénéficiaire structurée (ne JAMAIS laisser 'mes héritiers' — perte de l'avantage 990 I)");
      } else {
        if (fiscaliteTotale > 0) {
          leviers.push("compléter la clause bénéficiaire pour répartir entre plus de bénéficiaires (chaque abattement de 152 500 € est par bénéficiaire)");
          leviers.push("démembrement de la clause (usufruitier conjoint + nu-propriétaires enfants) pour optimiser fiscalement");
        }
        if (capitauxTransmis > 0 && fiscaliteNulle && abattementRestant > 0) {
          leviers.push(`marge d'abattement restante : ${formatEuro(abattementRestant)} — capacité de versement avant 70 ans à utiliser`);
        }
        leviers.push("arbitrage avant/après 70 ans : versements avant 70 ans = 990 I (152 500 € par bénéf.) ; après 70 ans = 757 B (abattement global 30 500 €, plus-values exonérées)");
      }

      return `
        <p style="margin:0 0 10px 0">L'assurance-vie et le PER échappent à la succession civile et bénéficient d'un <strong>régime fiscal dédié</strong> : abattement de 152 500 € par bénéficiaire (versements avant 70 ans, CGI art. 990 I) et abattement global de 30 500 € après 70 ans (art. 757 B). La clause bénéficiaire est le levier central.</p>
        <ul style="margin:0 0 10px 0;padding-left:18px;line-height:1.7">
          <li><strong>Capitaux décès AV/PER</strong> — ${aucunBenef
            ? `Aucun bénéficiaire renseigné.`
            : `${formatEuro(capitauxTransmis)} pour ${nbBenefs} bénéficiaire${nbBenefs > 1 ? "s" : ""}.`}</li>
          <li><strong>Fiscalité 990 I</strong> — ${fiscaliteNulle
            ? `Aucune fiscalité due — abattements (152 500 € par bénéficiaire) absorbent l'intégralité. Marge restante : ${formatEuro(abattementRestant)}.`
            : `${formatEuro(fiscaliteTotale)} dus (dépassement des abattements). Net aux bénéficiaires : ${formatEuro(netAuxBeneficiaires)}.`}</li>
          <li><strong>Transmission consolidée</strong> — Civil + AV/PER = <strong>${formatEuro(totalNetTransmis)}</strong> reçus net par vos proches.</li>
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
  if (!r) return "Bénéficiaire";
  const map: Record<string, string> = { conjoint: "Conjoint", enfant: "Enfant", parent: "Parent", autre: "Autre" };
  return map[String(r).toLowerCase()] || String(r);
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
