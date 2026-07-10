// LOT 11 G5-B — le flag "rattache" du PDF Famille suit la MEME convention que le moteur :
// un enfant est rattache SAUF si rattached === false (defaut absent = rattache). Le PDF
// lisait `!!c.rattached` (truthy) -> les enfants sans champ explicite tombaient a tort
// "non rattaches" (Perry : riri/nono sans `rattached` -> "1 rattache" au lieu de 3, alors
// que parts=4 en compte 3). Cf. ir.ts:671/694-695, utils.ts:352, succession.ts:1325.
import { describe, it, expect } from "vitest";
import { buildFamilleData } from "../lib/pdf/v2/adapters/buildFamilleData";

// Reproduction fidele du dossier Perry : meme rattache explicitement, riri/nono SANS champ.
const data = {
  person1FirstName: "David", person1LastName: "Perry",
  person2FirstName: "Erika", person2LastName: "Perry",
  coupleStatus: "married", matrimonialRegime: "communaute_legale",
  childrenData: [
    { firstName: "meme", parentLink: "person1_only", custody: "full", rattached: true, birthDate: "2009-04-03" },
    { firstName: "riri", parentLink: "person2_only", custody: "full", birthDate: "2001-05-12" }, // pas de rattached
    { firstName: "nono", parentLink: "person2_only", custody: "full", birthDate: "2005-07-06" }, // pas de rattached
  ],
};

describe("Famille — rattachement fiscal (meme convention que le moteur : !== false)", () => {
  const d = buildFamilleData({ data, cabinet: { cabinetName: "C" }, ir: { parts: 4 }, clientName: "David Perry" });

  it("les 3 enfants sont rattaches (defaut absent = rattache, pas truthy)", () => {
    expect(d.enfants.map(e => e.rattache)).toEqual([true, true, true]);
  });

  it("un enfant explicitement detache (rattached === false) reste non rattache", () => {
    const d2 = buildFamilleData({
      data: { ...data, childrenData: [{ firstName: "x", rattached: false }] },
      cabinet: {}, ir: { parts: 2 },
    });
    expect(d2.enfants[0].rattache).toBe(false);
  });

  it("coherence interne : 3 rattaches <-> 4 parts (couple marie)", () => {
    const nbRattaches = d.enfants.filter(e => e.rattache).length;
    expect(nbRattaches).toBe(3);
    expect(d.parts).toBe(4);
    // le narratif "Notre lecture" annonce bien 3 rattaches (pluriel), pas 1
    expect(d.notreLecture).toContain("3 rattach");
    expect(d.notreLecture).not.toMatch(/1 rattach[eé]\b/);
  });
});
