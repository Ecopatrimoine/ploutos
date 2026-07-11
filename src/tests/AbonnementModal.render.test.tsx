// @vitest-environment jsdom
//
// AbonnementModal — rendu des CINQ états de licence (fixtures). Vérifie que le
// modal affiche l'identité (email + cabinet), le bon statut et la bonne zone
// d'actions selon l'état. Supabase mocké : aucun appel réseau.

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AbonnementModal from "../components/AbonnementModal";
import type { LicenceInfo } from "../hooks/useLicense";

// Le composant importe @/lib/supabase (throw si .env absent) — on le neutralise.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
  },
  SUPABASE_FUNCTIONS_URL: "https://example.test/functions/v1",
}));

function licence(over: Partial<LicenceInfo>): LicenceInfo {
  return {
    type: null, status: "none", trialEnd: null, trialDaysLeft: 0,
    cancelAt: null, isValid: false, loading: false, ...over,
  };
}

const TRIAL_END = new Date("2026-07-20T12:00:00Z");
const CANCEL_AT = new Date("2026-08-15T12:00:00Z");

function renderModal(lic: LicenceInfo) {
  return render(
    <AbonnementModal
      open
      onClose={() => {}}
      licence={lic}
      userEmail="david@ecopatrimoine.fr"
      cabinetName="Ecopatrimoine Conseil"
      userId="user-42"
    />,
  );
}

describe("AbonnementModal — identité (commune à tous les états)", () => {
  it("affiche l'email de session et le nom du cabinet en lecture seule", () => {
    renderModal(licence({ type: "paid", status: "active", isValid: true }));
    expect(screen.getByText("david@ecopatrimoine.fr")).toBeInTheDocument();
    expect(screen.getByText("Ecopatrimoine Conseil")).toBeInTheDocument();
    // Zone identité : pas de champ éditable.
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("AbonnementModal — état TRIAL", () => {
  it("statut essai + jours restants + Payment Links", () => {
    renderModal(licence({ type: "trial", status: "active", trialEnd: TRIAL_END, trialDaysLeft: 9, isValid: true }));
    expect(screen.getByText("Essai gratuit")).toBeInTheDocument();
    expect(screen.getByText("9 jours restants")).toBeInTheDocument();
    expect(screen.getByText(/Fin de l'essai le 20 juillet 2026/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Plan Solo/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Plan Annuel/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gérer mon abonnement/ })).toBeNull();
  });
});

describe("AbonnementModal — état PAID actif", () => {
  it("statut actif + bouton portail, pas de Payment Links", () => {
    renderModal(licence({ type: "paid", status: "active", isValid: true }));
    expect(screen.getByText("Abonnement actif")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gérer mon abonnement/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Plan Solo/ })).toBeNull();
  });
});

describe("AbonnementModal — état PAID + cancel_at (résiliation programmée)", () => {
  it("mentionne la date de résiliation + bouton portail", () => {
    renderModal(licence({ type: "paid", status: "cancelling", cancelAt: CANCEL_AT }));
    expect(screen.getByText(/Résiliation programmée le 15 août 2026/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gérer mon abonnement/ })).toBeInTheDocument();
  });
});

describe("AbonnementModal — état LIFETIME", () => {
  it("licence à vie, aucune action", () => {
    renderModal(licence({ type: "lifetime", status: "active", isValid: true }));
    expect(screen.getByText("Licence à vie")).toBeInTheDocument();
    expect(screen.getByText(/Aucune action requise/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Plan Solo/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Gérer mon abonnement/ })).toBeNull();
  });
});

describe("AbonnementModal — état EXPIRE (essai terminé)", () => {
  it("statut terminé + Payment Links", () => {
    renderModal(licence({ type: "trial", status: "expired", trialEnd: TRIAL_END }));
    expect(screen.getByText("Période d'essai terminée")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Plan Solo/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Plan Annuel/ })).toBeInTheDocument();
  });
});
