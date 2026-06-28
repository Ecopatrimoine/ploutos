// ─── Contrat de page — drapeau queue solidaireAvecPrecedent (Lot 4-bis) ──────
//
// Verrouille le RAYON du nouveau drapeau opt-in sur kind:"queue" :
//   - SANS drapeau  -> chaine de style STRICTEMENT identique a l'historique
//     (break-inside seul, AUCUN break-before) -> les ~9 "Notre lecture" + succession
//     ne bougent pas d'un octet ;
//   - AVEC drapeau  -> break-before:avoid AJOUTE (queue soudee au bloc precedent).

import { describe, it, expect } from "vitest";
import { compilerBloc } from "../lib/pdf/v2/engine/contrat";

describe("compilerBloc — queue : drapeau solidaireAvecPrecedent (opt-in)", () => {
  it("queue SANS drapeau : style historique inchange (break-inside:avoid seul)", () => {
    const html = compilerBloc({ kind: "queue", html: "<p>X</p>" });
    expect(html).toBe('<div class="pdf-queue" style="break-inside:avoid"><p>X</p></div>');
    expect(html).not.toContain("break-before");
  });

  it("queue secableEnDernierRecours SANS drapeau : break-inside:auto seul (inchange)", () => {
    const html = compilerBloc({ kind: "queue", html: "<p>X</p>", secableEnDernierRecours: true });
    expect(html).toBe('<div class="pdf-queue" style="break-inside:auto"><p>X</p></div>');
    expect(html).not.toContain("break-before");
  });

  it("queue solidaireAvecPrecedent:false : equivaut a l'absence (defaut inchange)", () => {
    const html = compilerBloc({ kind: "queue", html: "<p>X</p>", solidaireAvecPrecedent: false });
    expect(html).toBe('<div class="pdf-queue" style="break-inside:avoid"><p>X</p></div>');
    expect(html).not.toContain("break-before");
  });

  it("queue AVEC drapeau : break-before:avoid AJOUTE (soude au bloc precedent)", () => {
    const html = compilerBloc({ kind: "queue", html: "<p>X</p>", solidaireAvecPrecedent: true });
    expect(html).toBe('<div class="pdf-queue" style="break-inside:avoid;break-before:avoid"><p>X</p></div>');
  });

  it("queue AVEC drapeau + secable : break-inside:auto;break-before:avoid", () => {
    const html = compilerBloc({ kind: "queue", html: "<p>X</p>", secableEnDernierRecours: true, solidaireAvecPrecedent: true });
    expect(html).toBe('<div class="pdf-queue" style="break-inside:auto;break-before:avoid"><p>X</p></div>');
  });
});
