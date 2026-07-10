// LOT 11 G5-A — le bloc Dévolution du PDF consomme les MÊMES sorties moteur que l'écran
// (réservataires du DÉFUNT, quotité disponible, option conjoint choisie, démembrement 669),
// JAMAIS data.childrenData ni une option légale figée.
import { describe, it, expect } from "vitest";
import { buildSuccessionAData } from "../lib/pdf/v2/adapters/buildSuccessionAData";

// Moteur synthétique = décès de David : 1 réservataire (meme), quotité 50 %, option DDV usufruit
// total (US 60 / NP 40). Le foyer déclare 3 enfants (2 sont ceux du conjoint) → piège.
const succession = {
  activeNet: 1_974_000,
  results: [{ name: "meme", relation: "enfant", partRecueFiscale: 1_974_000, successionDuties: 149_842, allowance: 100_000, compositionFiscale: "" }],
  avLines: [],
  reserveChildrenCount: 1,
  quotiteDisponible: 0.5,
  legalReserveAmount: 987_000,
  legalDisposableAmount: 987_000,
  spouseEligible: true,
  spouseOption: "ddv_usufruct_total",
  spouseOptions: [
    { value: "legal_quarter_full", label: "Dévolution légale : 1/4 en pleine propriété" },
    { value: "ddv_usufruct_total", label: "Donation au dernier vivant : totalité en usufruit" },
  ],
  demembrementPct: { usufruct: 0.6, nuePropriete: 0.4 },
  usufruitierAge: 49,
};
const data = {
  person1FirstName: "David", person1LastName: "Perry", coupleStatus: "married",
  childrenData: [
    { firstName: "meme", parentLink: "person1_only" },
    { firstName: "riri", parentLink: "person2_only" },
    { firstName: "nono", parentLink: "person2_only" },
  ],
};

describe("Succession A — dévolution depuis le moteur (pas les enfants du foyer)", () => {
  const d = buildSuccessionAData({ succession, data, cabinet: { cabinetName: "C" }, clientName: "David Perry" });

  it("réservataires du défunt (1) → réserve 1/2, quotité 1/2, montants moteur (pas 3/4 sur 3 enfants foyer)", () => {
    expect(d.reservePct).toBe(50);
    expect(d.quotitePct).toBe(50);
    expect(d.reserveLabel).toBe("Réserve héréditaire · 1/2");
    expect(d.quotiteLabel).toBe("Quotité dispo. · 1/2");
    expect(d.reserveMontant).toBe(987_000);
    expect(d.quotiteMontant).toBe(987_000);
  });

  it("option conjoint CHOISIE = label moteur + démembrement 669 ; badge DDV", () => {
    expect(d.devolutionBadge).toBe("Donation au dernier vivant");
    expect(d.devolutionDescription).toContain("1 enfant réservataire");
    expect(d.devolutionDescription).toContain("Donation au dernier vivant : totalité en usufruit");
    expect(d.devolutionDescription).toMatch(/US 60.%.*NP 40.%/);        // art. 669 (nbsp toléré)
    expect(d.devolutionDescription).not.toContain("¼ en pleine propriété"); // plus l'option figée
    expect(d.devolutionDescription).not.toContain("3 enfant");             // plus le compte foyer
  });
});
