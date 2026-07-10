// ─── LOT 11 — Harnais local : page Prévoyance perso (P1/P2) + LISTE DE PREUVE des ticks ─
//
// Usage :
//   npx tsx scripts/prevoyancePersoLocal.ts "chemin/vers/dossier.json"
//
// Le dossier attendu est un EXPORT Ploutos ({ version, clientName, data, ... }) : le
// harnais lit le payload sous `.data` (repli : l'objet lui-même). Pour chaque personne
// (P1, P2) dont la projection est disponible, il :
//   1. imprime la LISTE DE PREUVE des ticks du graphe PDF (jour · libellé · niveau · pt),
//      issue de la MÊME fonction que le rendu (ticksPdf), + l'écrit dans out/prevoyance-perso/,
//   2. génère le PDF de la page (coquilleDocument + pagePrevoyancePerso) via Playwright,
//      avec les mêmes marges @page que la prod (15 mm haut/bas, 0 latéral).
//
// C'est la PREUVE que David vérifie sur papier avant les captures (doctrine maison).

import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { buildTokens } from "../src/lib/pdf/v2/tokens";
import { coquilleDocument } from "../src/lib/pdf/v2/primitives";
import { pagePrevoyancePerso } from "../src/lib/pdf/v2/pages/pagePrevoyancePerso";
import { buildPrevoyancePersoData } from "../src/lib/pdf/v2/adapters/buildPrevoyancePersoData";
import { ticksPdf } from "../src/lib/pdf/v2/prevoyanceChart";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "out", "prevoyance-perso");
mkdirSync(outDir, { recursive: true });

// Marges @page de PROD (feeder.ts) — page de contenu (pas de couverture).
const MARGE_HAUT_MM = 15;
const MARGE_BAS_MM = 15;

async function genererPdf(htmlContent: string, outPath: string): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const htmlMargesPage = htmlContent.replace(/@page\s*\{[^}]*\}/, "");
    await page.setContent(htmlMargesPage, { waitUntil: "networkidle" });
    await page.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      margin: { top: `${MARGE_HAUT_MM}mm`, right: "0", bottom: `${MARGE_BAS_MM}mm`, left: "0" },
    });
    console.log(`  ✓ PDF : ${outPath}`);
  } finally {
    await browser.close();
  }
}

// Liste de preuve d'une personne : une ligne par tick, séparée par niveau.
function listePreuve(personneLibelle: string, ticks: ReturnType<typeof ticksPdf>): string {
  const lignes: string[] = [];
  lignes.push(`### ${personneLibelle}`);
  const n1 = ticks.filter((t) => t.niveau === 1);
  const n2 = ticks.filter((t) => t.niveau === 2);
  lignes.push(`Niveau 1 — ruptures libellées (${n1.length}) :`);
  for (const t of n1) {
    lignes.push(`  J${t.jour} · ${t.label} · niveau ${t.niveau} · ${t.xPt.toFixed(1)} pt · ligne ${t.ligne}`);
  }
  lignes.push(`Niveau 2 — repères discrets (${n2.length}) :`);
  for (const t of n2) {
    lignes.push(`  J${t.jour} · ${t.label} · niveau ${t.niveau} · ${t.xPt.toFixed(1)} pt`);
  }
  lignes.push(`Synthèse niveau 1 : ${n1.map((t) => t.label).join(" · ") || "(aucune)"}`);
  return lignes.join("\n");
}

async function main(): Promise<void> {
  const dossierPath = process.argv[2];
  if (!dossierPath) {
    console.error('Usage : npx tsx scripts/prevoyancePersoLocal.ts "chemin/vers/dossier.json"');
    process.exit(1);
  }
  const brut = JSON.parse(readFileSync(dossierPath, "utf-8"));
  const payload = brut.data ?? brut;
  const clientName: string | undefined = brut.clientName || undefined;
  const cabinet = { cabinetName: "EcoPatrimoine Conseil", orias: "25006907" };
  const dateLettre = "10 juillet 2026";
  const stem = basename(dossierPath).replace(/\.json$/i, "");

  const t = buildTokens("encreOr");
  const preuves: string[] = [`# Liste de preuve — ticks du graphe Prévoyance PDF`, `Dossier : ${dossierPath}`, ""];

  for (const which of ["p1", "p2"] as const) {
    const d = buildPrevoyancePersoData({ data: payload, cabinet, which, clientName, dateLettre });
    console.log(`\n── ${which.toUpperCase()} — ${d.personneLibelle} ──`);
    if (!d.disponible || !d.projection) {
      console.log("  (projection non disponible — personne absente ou données Travail manquantes)");
      preuves.push(`### ${which.toUpperCase()} — ${d.personneLibelle} : projection non disponible`, "");
      continue;
    }
    console.log(`  Statut : ${d.statutLibelle} · Caisse : ${d.caisseLibelle} · Réf : ${d.revenuReference}`);
    const ticks = ticksPdf(d.projection);
    const bloc = listePreuve(`${which.toUpperCase()} — ${d.personneLibelle} (${d.statutLibelle}, ${d.caisseLibelle})`, ticks);
    console.log(bloc.split("\n").map((l) => "  " + l).join("\n"));
    preuves.push(bloc, "");

    const html = coquilleDocument(t, {
      titre: `Prévoyance personnelle — ${d.personneLibelle}`,
      body: pagePrevoyancePerso(t, d),
    });
    // La liste de preuve prime : une panne Playwright (navigateur absent) ne doit pas
    // faire perdre la preuve déjà calculée.
    try {
      await genererPdf(html, join(outDir, `${stem}-${which}.pdf`));
    } catch (e) {
      console.warn(`  ⚠ PDF non généré (${(e as Error).message.split("\n")[0]}) — liste de preuve conservée.`);
      writeFileSync(join(outDir, `${stem}-${which}.html`), html, "utf-8");
      console.warn(`  → HTML de repli écrit : ${join(outDir, `${stem}-${which}.html`)}`);
    }
  }

  const preuvePath = join(outDir, `${stem}-preuve-ticks.txt`);
  writeFileSync(preuvePath, preuves.join("\n"), "utf-8");
  console.log(`\n✓ Liste de preuve écrite : ${preuvePath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
