// LOT 10a — couche de PRÉSENTATION de l'analyse succession. Fonction PURE : elle
// ne fait qu'AGRÉGER les sorties déjà calculées par computeSuccession (jamais de
// recalcul d'une base fiscale). Décision David : périmètre Acte 1 = succession + AV
// seuls (les capitaux décès des régimes restent strictement en Acte 3 §3).
//
// Garantie de réconciliation (testée à l'euro) :
//   net = (activeNet − totalSuccessionRights) + (avCapital − totalAvRights)
//   Σ (net par personne) = net           [Duvergier US%+NP% = 100 % -> Σ partRecueFiscale = activeNet]
//   camembert cadre légal = 100 % · camembert répartition simulée = 100 %

export type SuccessionAvPart = {
  capital: number;      // capital AV reçu (€)
  tax990I: number;      // fiscalité avant 70 ans (art. 990 I)
  tax757B: number;      // fiscalité après 70 ans (art. 757 B)
  fiscalite: number;    // 990 I + 757 B
  net: number;          // capital − fiscalité
};

export type SuccessionSuccessionPart = {
  part: number;         // part reçue en valeur fiscale (PP + NP + US Duvergier)
  droits: number;       // droits de succession
  net: number;          // part − droits
  composition: string;  // "PP … + NP … + US …" (usufruit/NP le cas échéant)
};

export type SuccessionPersonRow = {
  name: string;
  relation: string;                 // libellé de lien (conjoint / enfant / bénéficiaire AV…)
  isHeir: boolean;
  heirIndex: number | null;         // index dans succession.results (pour la modale "Voir le détail")
  succession: SuccessionSuccessionPart | null;
  av: SuccessionAvPart | null;
  net: number;                      // net total reçu (succession + AV)
};

export type PiePart = { name: string; value: number };

export type SuccessionPresentation = {
  kpis: { brut: number; fiscalite: number; net: number };
  persons: SuccessionPersonRow[];
  cadreLegalPie: PiePart[];         // réserve par enfant + quotité disponible (succession civile)
  repartitionSimuleePie: PiePart[]; // partRecueFiscale par personne (succession civile)
  reserveWarning: string | null;    // alerte réserve UNIQUEMENT si le moteur la détecte
};

type AvLine = { beneficiary: string; relation?: string; amount: number; before70Tax: number; after70Tax: number };
type HeirResult = {
  name: string; relation: string; partRecueFiscale: number; successionDuties: number;
  compositionFiscale: string; grossReceived: number; nueValue: number; usufructFiscalValue: number;
};

export type SuccessionLike = {
  activeNet: number;
  totalSuccessionRights: number;
  totalAvRights: number;
  results: HeirResult[];
  avLines: AvLine[];
  reserveChildrenCount: number;
  legalReserveAmount: number;
  legalDisposableAmount: number;
  quotiteDisponible: number;
  spouseEligible?: boolean;
  warnings?: string[];
};

function round(n: number): number { return Math.round(n); }

export function buildSuccessionPresentation(s: SuccessionLike): SuccessionPresentation {
  const avCapital = s.avLines.reduce((t, l) => t + (l.amount || 0), 0);
  const avTax = s.totalAvRights;
  const brut = s.activeNet + avCapital;
  const fiscalite = s.totalSuccessionRights + avTax;
  const net = brut - fiscalite;

  // AV par bénéficiaire (source unique = avLines, couvre héritiers ET non-héritiers).
  const avByBenef = new Map<string, SuccessionAvPart & { relation: string }>();
  for (const l of s.avLines) {
    const key = l.beneficiary;
    const prev = avByBenef.get(key) || { capital: 0, tax990I: 0, tax757B: 0, fiscalite: 0, net: 0, relation: l.relation || "bénéficiaire AV" };
    prev.capital += l.amount || 0;
    prev.tax990I += l.before70Tax || 0;
    prev.tax757B += l.after70Tax || 0;
    prev.fiscalite = prev.tax990I + prev.tax757B;
    prev.net = prev.capital - prev.fiscalite;
    avByBenef.set(key, prev);
  }

  const persons: SuccessionPersonRow[] = [];
  const heirNames = new Set<string>();

  // 1) Héritiers (results) — succession + éventuelle AV.
  s.results.forEach((r, i) => {
    heirNames.add(r.name);
    const succNet = r.partRecueFiscale - r.successionDuties;
    const avPart = avByBenef.get(r.name) || null;
    const avNet = avPart ? avPart.net : 0;
    const rowNet = succNet + avNet;
    // On n'affiche que les personnes qui reçoivent réellement quelque chose.
    if (Math.abs(r.partRecueFiscale) < 0.5 && avNet === 0) return;
    persons.push({
      name: r.name,
      relation: r.relation,
      isHeir: true,
      heirIndex: i,
      succession: r.partRecueFiscale > 0 || r.successionDuties > 0
        ? { part: r.partRecueFiscale, droits: r.successionDuties, net: succNet, composition: r.compositionFiscale }
        : null,
      av: avPart ? { capital: avPart.capital, tax990I: avPart.tax990I, tax757B: avPart.tax757B, fiscalite: avPart.fiscalite, net: avPart.net } : null,
      net: rowNet,
    });
  });

  // 2) Bénéficiaires AV NON-héritiers (aujourd'hui invisibles) — AV seule.
  for (const [name, avPart] of avByBenef) {
    if (heirNames.has(name)) continue;
    if (avPart.capital === 0) continue;
    persons.push({
      name,
      relation: avPart.relation,
      isHeir: false,
      heirIndex: null,
      succession: null,
      av: { capital: avPart.capital, tax990I: avPart.tax990I, tax757B: avPart.tax757B, fiscalite: avPart.fiscalite, net: avPart.net },
      net: avPart.net,
    });
  }

  // Camembert « Cadre légal » : réserve par enfant réservataire + quotité disponible.
  const cadreLegalPie: PiePart[] = [];
  if (s.reserveChildrenCount > 0 && s.legalReserveAmount > 0) {
    const partReserve = s.legalReserveAmount / s.reserveChildrenCount;
    for (let i = 0; i < s.reserveChildrenCount; i++) {
      cadreLegalPie.push({ name: `Réserve enfant ${i + 1}`, value: partReserve });
    }
  }
  if (s.legalDisposableAmount > 0) {
    cadreLegalPie.push({ name: s.reserveChildrenCount > 0 ? "Quotité disponible" : "Masse disponible", value: s.legalDisposableAmount });
  }

  // Camembert « Répartition simulée » : parts fiscales civiles (partRecueFiscale), AV EXCLUE.
  const repartitionSimuleePie: PiePart[] = s.results
    .filter((r) => r.partRecueFiscale > 0)
    .map((r) => ({ name: r.name, value: r.partRecueFiscale }));

  // Alerte réserve : UNIQUEMENT si le moteur l'a émise (jamais déduite des parts).
  const reserveWarning = (s.warnings || []).find((w) => /réserve/i.test(w) && /(spoli|atteinte|devraient)/i.test(w)) || null;

  return {
    kpis: { brut: round(brut), fiscalite: round(fiscalite), net: round(net) },
    persons,
    cadreLegalPie,
    repartitionSimuleePie,
    reserveWarning,
  };
}
