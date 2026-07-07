// @vitest-environment jsdom
//
// LOT 2bis point C — colonne plus-value brute + avertissement dans le modal
// Projection sur 10 ans. Le calcul est couvert par projectionMeuble.test.ts ;
// ici on verifie la conditionnalite d'affichage (colonne / avertissement / note Censi).
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { ProjectionMeubleModal } from "../components/ProjectionMeubleModal";
import refMeuble from "../data/location-meublee.json";
import type { Property } from "../types/patrimoine";

const bien = (over: any): Property => ({ id: "b", name: "Appart", type: "LMNP", regimeMeuble: "reel", ...over } as unknown as Property);
const MILLESIME = refMeuble.millesime;
const noop = () => {};

describe("ProjectionMeubleModal — volet plus-value", () => {
  it("prix d'acquisition saisi : colonne PV + avertissement presents", () => {
    render(<ProjectionMeubleModal property={bien({ recettesAnnuelles: "18000", chargesReelles: "8000", prixAcquisition: "300000", partTerrain: "0.15", valeurMobilier: "10000", value: "300000" })} updateProperty={noop} onClose={noop} />);
    expect(screen.getByText("PV brute si vente")).toBeTruthy();
    expect(screen.getByText(/Plus-value BRUTE avant abattements/)).toBeTruthy();
  });
  it("sans prix d'acquisition (manuel) : pas de colonne PV ni avertissement", () => {
    render(<ProjectionMeubleModal property={bien({ recettesAnnuelles: "18000", chargesReelles: "8000", amortissementAnnuelManuel: "5000" })} updateProperty={noop} onClose={noop} />);
    expect(screen.queryByText("PV brute si vente")).toBeNull();
    expect(screen.queryByText(/Plus-value BRUTE avant abattements/)).toBeNull();
  });
  it("Censi-Bouvard : note residence de services (reintegration non applicable)", () => {
    render(<ProjectionMeubleModal property={bien({ recettesAnnuelles: "18000", chargesReelles: "8000", prixAcquisition: "300000", value: "300000", dispositifFiscal: "censiBouvard" })} updateProperty={noop} onClose={noop} />);
    expect(screen.getByText(/résidence de services probable/)).toBeTruthy();
  });
});

describe("ProjectionMeubleModal — Lot 2ter situation de depart", () => {
  it("bandeau Situation de depart present (annee acquisition + stock ARD)", () => {
    render(<ProjectionMeubleModal property={bien({ recettesAnnuelles: "18000", chargesReelles: "8000", prixAcquisition: "300000", value: "300000" })} updateProperty={noop} onClose={noop} />);
    expect(screen.getByText("Situation de départ")).toBeTruthy();
    expect(screen.getByText("Année d'acquisition")).toBeTruthy();
    expect(screen.getByText("Stock ARD antérieur")).toBeTruthy();
  });
  it("annee acquisition saisie : colonne detention en age reel + mention 'depuis YYYY'", () => {
    const an = String(MILLESIME - 5);
    render(<ProjectionMeubleModal property={bien({ recettesAnnuelles: "18000", chargesReelles: "8000", prixAcquisition: "300000", value: "300000", anneeAcquisition: an })} updateProperty={noop} onClose={noop} />);
    expect(screen.getByText("6e année")).toBeTruthy(); // age 6 en 1re ligne (anneesEcoulees 5)
    expect(screen.getByText(new RegExp(`détention décomptée depuis ${an}`))).toBeTruthy();
  });
});
