// BUGFIX signature conseiller (A1 + B) — chaine reelle, HTML rendu (pas de snapshot).
// A1 : buildProfilData lit cabinet.signatureSrc -> signatureConseillerSrc.
// B  : cadresSignatureDocReg rend l'img (cadre cabinet) ; les 4 doc reg la propagent.
// Retrocompat : sans signature, aucune <img> (rendu inchange).
import { describe, it, expect } from "vitest";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { cadresSignatureDocReg } from "../lib/pdf/v2/primitives";
import { buildProfilData } from "../lib/pdf/v2/adapters/buildProfilData";
import { pageProfil } from "../lib/pdf/v2/pages/pageProfil";
import { buildDerData } from "../lib/pdf/v2/adapters/buildDerData";
import { pageDer } from "../lib/pdf/v2/pages/pageDer";
import { buildLettreMissionData } from "../lib/pdf/v2/adapters/buildLettreMissionData";
import { pageLettreMission } from "../lib/pdf/v2/pages/pageLettreMission";
import { buildFicheDDAData } from "../lib/pdf/v2/adapters/buildFicheDDAData";
import { pageFicheDDA } from "../lib/pdf/v2/pages/pageFicheDDA";
import { buildAdequationData } from "../lib/pdf/v2/adapters/buildDeclarationAdequationData";
import { pageDeclarationAdequation } from "../lib/pdf/v2/pages/pageDeclarationAdequation";

const t = buildTokens("encreOr");
const SIG = "data:image/png;base64,SIGTEST123";
const cab = (withSig: boolean) => ({ cabinetName: "EcoPatrimoine Conseil", conseiller: "David Perry", conseillerNom: "David Perry", orias: "25006907", ...(withSig ? { signatureSrc: SIG } : {}) });
const hasImg = (html: string) => html.includes(SIG);

describe("signature — A1 : buildProfilData (Profil)", () => {
  it("cabinet.signatureSrc enregistree -> signatureConseillerSrc non-undefined", () => {
    const d = buildProfilData({ mission: {}, data: {} as any, cabinet: cab(true), clientName: "Test" });
    expect(d.signatureConseillerSrc).toBe(SIG);
    expect(hasImg(pageProfil(t, d))).toBe(true);
  });
  it("sans signature -> signatureConseillerSrc undefined, aucune img", () => {
    const d = buildProfilData({ mission: {}, data: {} as any, cabinet: cab(false), clientName: "Test" });
    expect(d.signatureConseillerSrc).toBeUndefined();
    expect(hasImg(pageProfil(t, d))).toBe(false);
  });
});

describe("signature — B : primitive cadresSignatureDocReg", () => {
  const base = { cabinetNomConseiller: "David Perry", cabinetNom: "EcoPatrimoine Conseil", ville: "Perpignan", date: "07/07/2026" };
  it("avec signatureConseillerSrc -> <img> dans le cadre cabinet", () => {
    const out = cadresSignatureDocReg(t, { ...base, signatureConseillerSrc: SIG });
    expect(out).toContain(SIG);
    expect(out).toContain('alt="Signature"');
  });
  it("sans signature -> AUCUNE img (retrocompat : identique a l'appel sans le champ)", () => {
    const sansChamp = cadresSignatureDocReg(t, base);
    const champUndef = cadresSignatureDocReg(t, { ...base, signatureConseillerSrc: undefined });
    expect(sansChamp).not.toContain("<img");
    expect(champUndef).toBe(sansChamp); // byte-identique
  });
});

describe("signature — B : les 4 adapters exposent cabinet.signatureSrc", () => {
  it("buildDerData", () => {
    expect(buildDerData({ cabinet: cab(true) }).signatureConseillerSrc).toBe(SIG);
    expect(buildDerData({ cabinet: cab(false) }).signatureConseillerSrc).toBeUndefined();
  });
  it("buildLettreMissionData", () => {
    expect(buildLettreMissionData({ cabinet: cab(true), mission: {}, data: {} }).signatureConseillerSrc).toBe(SIG);
    expect(buildLettreMissionData({ cabinet: cab(false), mission: {}, data: {} }).signatureConseillerSrc).toBeUndefined();
  });
  it("buildFicheDDAData", () => {
    expect(buildFicheDDAData({ cabinet: cab(true), mission: {} }).signatureConseillerSrc).toBe(SIG);
    expect(buildFicheDDAData({ cabinet: cab(false), mission: {} }).signatureConseillerSrc).toBeUndefined();
  });
  it("buildAdequationData", () => {
    expect(buildAdequationData({ cabinet: cab(true), data: {} as any, mission: {} }).signatureConseillerSrc).toBe(SIG);
    expect(buildAdequationData({ cabinet: cab(false), data: {} as any, mission: {} }).signatureConseillerSrc).toBeUndefined();
  });
});

describe("signature — B : chaine reelle, les 4 documents reglementaires rendent l'img", () => {
  it("DER", () => {
    expect(hasImg(pageDer(t, buildDerData({ cabinet: cab(true) })))).toBe(true);
    expect(hasImg(pageDer(t, buildDerData({ cabinet: cab(false) })))).toBe(false);
  });
  it("Lettre de mission", () => {
    expect(hasImg(pageLettreMission(t, buildLettreMissionData({ cabinet: cab(true), mission: {}, data: {} })))).toBe(true);
    expect(hasImg(pageLettreMission(t, buildLettreMissionData({ cabinet: cab(false), mission: {}, data: {} })))).toBe(false);
  });
  it("Fiche DDA", () => {
    expect(hasImg(pageFicheDDA(t, buildFicheDDAData({ cabinet: cab(true), mission: {} })))).toBe(true);
    expect(hasImg(pageFicheDDA(t, buildFicheDDAData({ cabinet: cab(false), mission: {} })))).toBe(false);
  });
  it("Declaration d'adequation", () => {
    expect(hasImg(pageDeclarationAdequation(t, buildAdequationData({ cabinet: cab(true), data: {} as any, mission: {} })))).toBe(true);
    expect(hasImg(pageDeclarationAdequation(t, buildAdequationData({ cabinet: cab(false), data: {} as any, mission: {} })))).toBe(false);
  });
});
