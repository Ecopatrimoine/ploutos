// ─── LOT 3 — PDF de contrôle défiscalisation financière ──────────────────────
//
// Génère DEUX PDF de contrôle depuis des dossiers de test RÉELS, via la vraie
// chaîne moteur : computeIR -> buildIRData -> renderIR -> Chromium (Playwright).
// Sortie : livraison-defisc-lot3/ (comparaison visuelle par David).
//
//   Dossier A : FCPI 12 000 € (15/01/2026) + Pinel -> deux réductions, PAS d'écrêtement.
//   Dossier B : SOFICA 18 000 € + 2 Pinel (communs saturés) -> écrêtement DOUBLE enveloppe.
//
// Usage :  npx tsx scripts/generateDefiscControlPdfs.ts
//
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { computeIR } from "../src/lib/calculs/ir";
import { buildIRData } from "../src/lib/pdf/v2/adapters/buildIRData";
import { renderIR } from "../src/lib/pdf/v2/renderIR";
import { EMPTY_CHARGES_DETAIL } from "../src/constants";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "livraison-defisc-lot3");
mkdirSync(outDir, { recursive: true });

const MARGE_HAUT_MM = 15;
const MARGE_BAS_MM = 15;

const BASE = {
  person1FirstName: "David", person1LastName: "Perry", person1BirthDate: "1975-01-01", person1JobTitle: "Consultant", person1Csp: "47", person1PcsGroupe: "4",
  person2FirstName: "", person2LastName: "", person2BirthDate: "", person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
  coupleStatus: "single", matrimonialRegime: "communaute_legale", singleParent: false, person1Handicap: false, person2Handicap: false,
  childrenData: [], salary1: "100000", salary2: "0", pensions: "0", perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "", chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "", chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [], placements: [], otherLoans: [],
} as any;
const MICRO = { expenseMode1: "standard", expenseMode2: "standard", km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9", km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9", foncierRegime: "micro", other1: "0", other2: "0" } as any;

const prop = (o: any) => ({
  id: "b", name: "Bien", type: "Location nue", ownership: "person1", propertyRight: "full", usufructAge: "", value: "300000",
  propertyTaxAnnual: "", rentGrossAnnual: "", insuranceAnnual: "", worksAnnual: "", otherChargesAnnual: "", loanEnabled: false,
  loanType: "amortissable", loanAmount: "", loanRate: "", loanDuration: "", loanStartDate: "", loanCapitalRemaining: "", loanInterestAnnual: "",
  loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc", loanInsuranceRate: "", loanInsuranceRate1: "",
  loanInsuranceRate2: "", loanInsurancePremium: "", loanInsuranceCoverage: "banque", indivisionShare1: "", indivisionShare2: "", loans: [], ...o,
});
const plac = (o: any) => ({
  id: "x", name: "P", type: "Compte-titres", ownership: "person1", value: "0", annualIncome: "", taxableIncome: "", deathValue: "", openDate: "",
  pfuEligible: false, pfuOptOut: false, totalPremiumsNet: "", premiumsBefore70: "", premiumsAfter70: "", exemptFromSuccession: "", ucRatio: "",
  annualWithdrawal: "", annualContribution: "", perDeductible: true, perWithdrawal: "", perWithdrawalCapital: "", perWithdrawalInterest: "", perAnticiped: false, beneficiaries: [], ...o,
});
const pinel = (id: string, annee: string) => prop({ id, type: "Location nue", dispositifFiscal: "pinel", dispositifAnnee: annee, dispositifBase: "300000", dispositifEngagementAns: "9" });

const dossierA = {
  ...BASE, salary1: "100000",
  properties: [prop({ id: "p", type: "Location nue", dispositifFiscal: "pinel", dispositifAnnee: "2023", dispositifBase: "250000", dispositifEngagementAns: "9" })],
  placements: [plac({ id: "f", name: "FCPI Innovation", type: "FCPI", defiscalisation: { dispositif: "fcpi", montantSouscrit: "12000", dateInvestissement: "2026-01-15" } })],
};
const dossierB = {
  ...BASE, salary1: "200000",
  properties: [pinel("pa", "2020"), pinel("pb", "2020")],
  placements: [plac({ id: "s", name: "SOFICA 2026", type: "SOFICA", defiscalisation: { dispositif: "sofica", montantSouscrit: "18000", dateInvestissement: "2026-06-01", tauxSofica: "48" } })],
};

function irDataOf(data: any, clientName: string) {
  const ir = computeIR(data, MICRO);
  return { ir, irData: buildIRData({ ir, data, cabinet: { cabinetName: "EcoPatrimoine Conseil" }, clientName, dateLettre: "06 juillet 2026" }) };
}

async function genererPdf(htmlContent: string, outPath: string): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const htmlMargesPage = htmlContent.replace(/@page\s*\{[^}]*\}/, "");
    await page.setContent(htmlMargesPage, { waitUntil: "networkidle" });
    await page.pdf({ path: outPath, format: "A4", printBackground: true, margin: { top: `${MARGE_HAUT_MM}mm`, right: "0", bottom: `${MARGE_BAS_MM}mm`, left: "0" } });
    console.log(`  PDF : ${outPath}`);
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const cases = [
    { data: dossierA, name: "A-fcpi-pinel-sans-ecretement", client: "Dossier A — FCPI + Pinel" },
    { data: dossierB, name: "B-sofica-pinel-ecretement-double", client: "Dossier B — SOFICA + Pinel (écrêtement)" },
  ];
  for (const c of cases) {
    const { ir, irData } = irDataOf(c.data, c.client);
    const df: any = ir.dispositifsFiscaux;
    console.log(`\n[${c.name}] réductions imputées : ${(df.reductions || []).filter((r: any) => r.id !== "forfait_scolaire" && r.impute > 0).map((r: any) => `${r.id}=${Math.round(r.impute)}`).join(", ")}`);
    console.log(`  écrêtement : total ${Math.round(df.ecretementNiches)} (commun ${Math.round(df.ecretementCommun)} / majoré ${Math.round(df.ecretementMajore)})`);
    const html = renderIR({ theme: "encreOr", data: irData });
    writeFileSync(join(outDir, `${c.name}.html`), html, "utf8");
    console.log(`  HTML : ${join(outDir, `${c.name}.html`)}`);
    try {
      await genererPdf(html, join(outDir, `${c.name}.pdf`));
    } catch (e) {
      console.warn(`  ⚠ PDF non généré (${(e as Error).message}). Ouvrir le .html dans un navigateur.`);
    }
  }
  console.log(`\n→ Dossier de livraison : ${outDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
