// ─── Lot 9 — Script local de génération PDF v2 ──────────────────────────
//
// Pipeline : HTML (renderIFI) → Chromium headless (Playwright) → PDF.
//
// Usage :
//   npm run pdf:ifi          → génère out/ifi-encreOr.pdf + out/ifi-cabinet.pdf
//
// Critère d'acceptation = VISUEL : comparer les PDF générés à la maquette
//   revue-preview/pdf/refonte_pdf_page_theme_ifi_A4.html
//
// Données IFI figées dans ce script (correspondent à la maquette : assiette
// 588 400 €, seuil 1 300 000 €, marge 711 600 €, IFI dû 0 €). Plus tard,
// quand la page IFI v2 sera branchée dans l'app, ces données viendront du
// dossier client courant via computeIFI().

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { renderIFI } from "../src/lib/pdf/v2/renderIFI";
import type { IFIPageData } from "../src/lib/pdf/v2/pages/pageIFI";
import { renderIR } from "../src/lib/pdf/v2/renderIR";
import type { IRPageData } from "../src/lib/pdf/v2/pages/pageIR";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "out");
mkdirSync(outDir, { recursive: true });

// ─── Données figées correspondant à la maquette ────────────────────────
const dataMaquette: IFIPageData = {
  clientName: "Dubreuil",
  dateStr: "25 mai 2026",
  assietteNette: 588_400,
  seuilIFI: 1_300_000,
  margeSousSeuil: 711_600,
  ifiDu: 0,
  biens: [
    {
      nom: "Maison · résidence principale",
      valeurBrute: 600_000,
      abattementRP: 180_000,
      dette: 185_000,
      netTaxable: 235_000,
    },
    {
      nom: "Appartement locatif",
      valeurBrute: 353_400,
      abattementRP: 0,
      dette: 0,
      netTaxable: 353_400,
    },
  ],
  notreLecture:
    "Votre patrimoine immobilier net taxable s'établit à 588 400 €, après l'abattement de 30 % sur la résidence principale et la déduction du crédit en cours. Il reste très en deçà du seuil de 1 300 000 € : vous n'êtes pas redevable de l'IFI cette année, avec une marge de 711 600 €.",
  pagePosition: "3 / 8",
  cabinetLibellePied: "EcoPatrimoine Conseil · Fiscalité — confidentiel",
};

async function genererPdf(htmlContent: string, outPath: string): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    await page.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    console.log(`✓ Généré : ${outPath}`);
  } finally {
    await browser.close();
  }
}

// ─── Données figées pour la page IR (correspondent à la maquette) ────
const dataMaquetteIR: IRPageData = {
  clientName: "Dubreuil",
  dateStr: "25 mai 2026",
  impotNetDu: 14_320,
  trancheMarginale: "30 %",
  tauxMoyen: "7,8 %",
  quotient: "3 parts",
  salaires:        74_000,
  fonciers:        11_000,
  mobiliers:        4_500,
  pensionsAutres:   2_500,
  revenusBruts:    92_000,
  abattement10pct:  9_200,
  revenuNetImposable: 82_800,
  notreLecture:
    "Avec 3 parts de quotient familial, l'impôt du foyer atteint 14 320 €, soit un taux moyen de 7,8 % — bien en deçà de votre tranche marginale à 30 %. Vos revenus d'activité en concentrent 80 % ; à ce niveau de tranche, chaque euro versé en épargne retraite déductible allégerait l'impôt de 30 centimes (piste chiffrée au chapitre Recommandations).",
  pagePosition: "2 / 8",
  cabinetLibellePied: "EcoPatrimoine Conseil · Fiscalité — confidentiel",
};

// Couleurs cabinet de test — identiques à l'IFI pour la cohérence d'évaluation.
const cabinetColorsTest = {
  navy:  "#1B3550",   // bleu profond
  or:    "#A8763B",   // bronze
  cream: "#F6F1E6",
  sky:   "#5B7089",
};

async function main(): Promise<void> {
  const cible = process.argv[2] || "ifi";
  if (cible !== "ifi" && cible !== "ir") {
    console.error(`Cible inconnue : "${cible}". Cibles disponibles : ifi, ir`);
    process.exit(1);
  }

  if (cible === "ifi") {
    // Thème 1 : Encre & Or (valeurs maquette exactes)
    const htmlEncreOr = renderIFI({ theme: "encreOr", data: dataMaquette });
    await genererPdf(htmlEncreOr, join(outDir, "ifi-encreOr.pdf"));
    // Thème 2 : Cabinet (couleurs de test)
    const htmlCabinet = renderIFI({ theme: "cabinet", cabinetColors: cabinetColorsTest, data: dataMaquette });
    await genererPdf(htmlCabinet, join(outDir, "ifi-cabinet.pdf"));
    console.log("\n→ Compare les PDFs générés (dossier out/) à la maquette :");
    console.log("  revue-preview/pdf/refonte_pdf_page_theme_ifi_A4.html");
  }

  if (cible === "ir") {
    const htmlEncreOr = renderIR({ theme: "encreOr", data: dataMaquetteIR });
    await genererPdf(htmlEncreOr, join(outDir, "ir-encreOr.pdf"));
    const htmlCabinet = renderIR({ theme: "cabinet", cabinetColors: cabinetColorsTest, data: dataMaquetteIR });
    await genererPdf(htmlCabinet, join(outDir, "ir-cabinet.pdf"));
    console.log("\n→ Compare les PDFs générés (dossier out/) à la maquette :");
    console.log("  revue-preview/pdf/refonte_pdf_page_fiscalite_A4_graphique_corrige.html");
  }
}

main().catch(err => {
  console.error("Erreur :", err);
  process.exit(1);
});
