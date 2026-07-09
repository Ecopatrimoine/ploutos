// @vitest-environment jsdom
//
// ADDENDUM Lot 9 — le CTA des empty states doit VRAIMENT naviguer. Le clic DOM
// simulé échouait car le sous-onglet (Revenus/Immobilier/…) n'est pas monté tant
// que l'onglet principal « Collecte » n'est pas actif. Fix : navigation par ÉTAT
// React (onglets contrôlés). Ce harness reproduit la structure d'onglets imbriqués
// de App.tsx et vérifie qu'un clic sur le CTA bascule principal→collecte ET active
// le bon sous-onglet, alors qu'il n'était pas monté au départ.
import { describe, it, expect } from "vitest";
import { useState, useCallback } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "../components/shared";

const SOUS_ONGLETS = ["famille", "travail", "revenus", "immobilier", "placements", "credits"] as const;

function Harness({ ctaSub, ctaLabel }: { ctaSub: string; ctaLabel: string }) {
  const [mainTab, setMainTab] = useState("ir"); // on démarre sur un onglet d'analyse
  const [collecteSubTab, setCollecteSubTab] = useState("famille");
  const goToCollecteSub = useCallback((sub: string) => {
    setMainTab("collecte");
    setCollecteSubTab(sub);
  }, []);
  return (
    <Tabs value={mainTab} onValueChange={setMainTab}>
      <TabsList>
        <TabsTrigger value="collecte">Collecte</TabsTrigger>
        <TabsTrigger value="ir">IR</TabsTrigger>
      </TabsList>
      <TabsContent value="collecte">
        <Tabs value={collecteSubTab} onValueChange={setCollecteSubTab}>
          <TabsList>
            {SOUS_ONGLETS.map((s) => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}
          </TabsList>
          {SOUS_ONGLETS.map((s) => <TabsContent key={s} value={s}>PANEL {s}</TabsContent>)}
        </Tabs>
      </TabsContent>
      <TabsContent value="ir">
        <EmptyState title="Vide" ctaLabel={ctaLabel} onCta={() => goToCollecteSub(ctaSub)} />
      </TabsContent>
    </Tabs>
  );
}

describe("addendum Lot 9 — CTA des empty states navigue par état React", () => {
  const cas: Array<[string, string, string]> = [
    ["IR → Revenus", "revenus", "Compléter l'onglet Revenus"],
    ["IFI → Immobilier", "immobilier", "Compléter l'onglet Immobilier"],
    ["Succession → Placements", "placements", "Compléter le patrimoine"],
    ["Prévoyance → Travail", "travail", "Compléter l'onglet Travail"],
  ];

  for (const [nom, sub, label] of cas) {
    it(`${nom} : le clic sur le CTA active le sous-onglet ${sub}`, () => {
      render(<Harness ctaSub={sub} ctaLabel={label} />);
      // Au départ : onglet IR actif, le panneau du sous-onglet cible n'est PAS monté.
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.queryByText(`PANEL ${sub}`)).toBeNull();
      // Clic sur le CTA -> bascule principal + sous-onglet en une action d'état.
      fireEvent.click(screen.getByText(label));
      expect(screen.getByText(`PANEL ${sub}`)).toBeInTheDocument();
    });
  }
});
