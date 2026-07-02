import { describe, it, expect } from "vitest";
import { resolvePlacementRef, resolvePropertyRef } from "./refs";
import type { Placement, Property } from "../../types/patrimoine";

const P = (id: string | undefined, name: string) => ({ id, name } as unknown as Placement);
const B = (id: string | undefined, name: string) => ({ id, name } as unknown as Property);

describe("resolvePlacementRef / resolvePropertyRef", () => {
  it("id prioritaire : resout par id meme si l'index pointe ailleurs", () => {
    const placements = [P("a", "AV"), P("b", "PEA")];
    // index 0 pointerait sur AV, mais l'id "b" fait foi -> PEA
    expect(resolvePlacementRef(placements, { id: "b", index: 0 })?.name).toBe("PEA");
  });

  it("repli index legacy en l'absence d'id", () => {
    const placements = [P(undefined, "AV"), P(undefined, "PEA")];
    expect(resolvePlacementRef(placements, { index: 1 })?.name).toBe("PEA");
    expect(resolvePlacementRef(placements, { index: "0" })?.name).toBe("AV");
  });

  it("id fourni mais introuvable -> null (pas de repli sur l'index)", () => {
    const placements = [P("a", "AV"), P("b", "PEA")];
    expect(resolvePlacementRef(placements, { id: "zzz", index: 0 })).toBeNull();
  });

  it('index hors bornes / "-1" / vide -> null', () => {
    const placements = [P(undefined, "AV")];
    expect(resolvePlacementRef(placements, { index: 5 })).toBeNull();
    expect(resolvePlacementRef(placements, { index: "-1" })).toBeNull();
    expect(resolvePlacementRef(placements, { index: "" })).toBeNull();
    expect(resolvePlacementRef(placements, {})).toBeNull();
  });

  it("resolvePropertyRef : meme comportement (id prioritaire, repli, null)", () => {
    const properties = [B("x", "RP"), B("y", "SCPI")];
    expect(resolvePropertyRef(properties, { id: "y", index: 0 })?.name).toBe("SCPI");
    const legacy = [B(undefined, "RP"), B(undefined, "SCPI")];
    expect(resolvePropertyRef(legacy, { index: 1 })?.name).toBe("SCPI");
    expect(resolvePropertyRef(properties, { id: "nope" })).toBeNull();
  });
});
