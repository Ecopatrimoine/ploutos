// @vitest-environment jsdom
//
// LOT 2quater point C — fenetre "Plus-value de cession" du foncier nu. Le calcul
// est couvert par pvImmobiliere.test.ts ; ici on verifie l'affichage (detail,
// net vendeur, moins-value, alerte Jeanbrun, alerte annee absente).
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { PvCessionModal } from "../components/PvCessionModal";
import refMeuble from "../data/location-meublee.json";
import type { Property } from "../types/patrimoine";

const bien = (over: any): Property => ({ id: "b", name: "Bien nu", type: "Location nue", value: "300000", ...over } as unknown as Property);
const MILLESIME = refMeuble.millesime;
const noop = () => {};

describe("PvCessionModal — foncier nu", () => {
  it("prix + annee saisis : detail impot IR/PS + net vendeur", () => {
    render(<PvCessionModal property={bien({ prixAcquisition: "200000", anneeAcquisition: String(MILLESIME - 10), value: "300000" })} updateProperty={noop} onClose={noop} />);
    expect(screen.getByText(/Impôt IR \(19 %\)/)).toBeTruthy();
    expect(screen.getByText(/Prélèvements sociaux \(17,2 %\)/)).toBeTruthy();
    expect(screen.getByText("Net vendeur indicatif")).toBeTruthy();
  });
  it("moins-value : aucun impot", () => {
    render(<PvCessionModal property={bien({ prixAcquisition: "300000", anneeAcquisition: String(MILLESIME - 2), value: "250000" })} updateProperty={noop} onClose={noop} />);
    expect(screen.getByText(/Moins-value — aucun impôt/)).toBeTruthy();
  });
  it("Jeanbrun : alerte reintegration des amortissements", () => {
    render(<PvCessionModal property={bien({ prixAcquisition: "200000", anneeAcquisition: String(MILLESIME - 10), dispositifFiscal: "jeanbrunRelanceLogement" })} updateProperty={noop} onClose={noop} />);
    expect(screen.getByText(/amortissements à réintégrer à la cession/)).toBeTruthy();
  });
  it("annee d'acquisition absente : alerte de saisie", () => {
    render(<PvCessionModal property={bien({ prixAcquisition: "200000", value: "300000" })} updateProperty={noop} onClose={noop} />);
    expect(screen.getByText(/Renseignez l'année d'acquisition/)).toBeTruthy();
  });
});
