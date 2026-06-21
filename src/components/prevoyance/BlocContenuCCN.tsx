import React from "react";
import { BookOpen, ChevronDown, ChevronRight, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { VueObligationsFusionnee, ValeurFusionnee } from "../../lib/prevoyance/comparaison-branche-vue";
import { referentiels } from "../../data/prevoyance";
import { BRAND, SURFACE } from "../../constants";

type Props = { vue: VueObligationsFusionnee };

// Libelles accentues LOCAUX au helper (surface pedagogique soignee). Le tableau des
// obligations garde GARANTIE_LABEL (ASCII) de la vue ; reaccentuer la source partagee
// toucherait tests + PDF -> micro-correctif separe.
const LABEL: Record<string, string> = {
  capitalDC: "Capital décès",
  renteEducation: "Rente éducation",
  renteConjoint: "Rente de conjoint",
  ij: "Indemnités journalières",
  invalidite: "Invalidité",
  maintienEmployeur: "Maintien de salaire employeur",
  santeMinimum: "Complémentaire santé",
};

type Explication = { enClair: string; quiConcerne: string };

function renderValeur(v: ValeurFusionnee): React.ReactNode {
  if ("commun" in v) return v.commun;
  return (
    <>
      <div><span className="font-semibold" style={{ color: BRAND.muted }}>Cadres :</span> {v.cadres}</div>
      <div><span className="font-semibold" style={{ color: BRAND.muted }}>Non-cadres :</span> {v.nonCadres}</div>
    </>
  );
}

export function BlocContenuCCN({ vue }: Props) {
  const [open, setOpen] = React.useState(false);
  const [ouvert, setOuvert] = React.useState<string | null>(vue.lignes[0]?.garantie ?? null);

  const idcc = vue.idcc;
  const hasContent = idcc != null && (vue.lignes.length > 0 || vue.nonPrevues.length > 0);
  if (!hasContent) return null;

  // Acces fiche CCN par idcc dynamique : meme cast local que obligations-branche.ts.
  const conv = (referentiels.ccn as {
    conventions?: Record<string, { nom?: string; champApplication?: string; accordPrevoyanceReference?: string } | undefined>;
  }).conventions?.[idcc];

  const explications = referentiels.explicationsGaranties as unknown as Record<string, Explication | undefined>;
  const titre = conv?.nom ?? vue.nomCCN ?? `IDCC ${idcc}`;

  return (
    <>
      <Button variant="outline" className="h-9 text-xs shrink-0" onClick={() => setOpen(true)}>
        <BookOpen className="w-4 h-4 mr-1.5" />
        Contenu CCN
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl rounded-2xl" style={{ background: SURFACE.card }}>
          <DialogHeader>
            <DialogTitle style={{ color: BRAND.navy }}>
              Contenu CCN — {titre}{" "}
              <span className="text-xs font-normal" style={{ color: BRAND.muted }}>· IDCC {idcc}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            {conv?.champApplication && (
              <p className="text-base leading-relaxed" style={{ color: BRAND.navy }}>{conv.champApplication}</p>
            )}

            {conv?.accordPrevoyanceReference && (
              <div className="text-sm flex items-center gap-1.5 pb-2"
                   style={{ color: BRAND.muted, borderBottom: `1px solid ${SURFACE.border}` }}>
                <Scale className="w-3.5 h-3.5" />
                Base légale de la branche : {conv.accordPrevoyanceReference}
              </div>
            )}

            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${SURFACE.border}` }}>
              {vue.lignes.map((l) => {
                const isOpen = ouvert === l.garantie;
                const exp = explications[l.garantie];
                return (
                  <div key={l.garantie} style={{ borderBottom: `1px solid ${SURFACE.border}` }}>
                    <button type="button"
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                      style={{ background: isOpen ? SURFACE.cardSoft : "transparent" }}
                      onClick={() => setOuvert(isOpen ? null : l.garantie)}>
                      <span className="text-base font-semibold" style={{ color: BRAND.navy }}>
                        {LABEL[l.garantie] ?? l.garantieLabel}
                      </span>
                      {isOpen
                        ? <ChevronDown className="w-4 h-4" style={{ color: BRAND.muted }} />
                        : <ChevronRight className="w-4 h-4" style={{ color: BRAND.muted }} />}
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 space-y-2">
                        {exp && (
                          <div>
                            <div className="text-sm font-bold" style={{ color: BRAND.navy }}>En clair</div>
                            <div className="text-base" style={{ color: BRAND.navy }}>{exp.enClair}</div>
                          </div>
                        )}
                        {exp && (
                          <div>
                            <div className="text-sm font-bold" style={{ color: BRAND.navy }}>Qui est concerné</div>
                            <div className="text-base" style={{ color: BRAND.navy }}>{exp.quiConcerne}</div>
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-bold" style={{ color: BRAND.navy }}>La règle / le seuil (cette CCN)</div>
                          <div className="text-base" style={{ color: BRAND.navy }}>{renderValeur(l.obligation)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {vue.nonPrevues.map((n) => (
                <div key={n.garantie}
                     className="px-3 py-2.5 flex items-center justify-between"
                     style={{ borderBottom: `1px solid ${SURFACE.border}`, opacity: 0.6 }}>
                  <span className="text-base" style={{ color: BRAND.muted }}>{LABEL[n.garantie] ?? n.garantieLabel}</span>
                  <span className="text-sm italic" style={{ color: BRAND.muted }}>non prévue par cette CCN</span>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

BlocContenuCCN.displayName = "BlocContenuCCN";
