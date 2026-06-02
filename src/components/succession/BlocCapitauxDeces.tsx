// ─── BlocCapitauxDeces — affichage des capitaux décès dans la succession ───
//
// Composant PRÉSENTATIONNEL PUR (aucun calcul) : lit les champs exposés par
// computeSuccession (Lot 3) et les rend en DEUX sous-blocs distincts :
//   (1) Régimes obligatoires — capitaux EXONÉRÉS + rentes survie/éducation
//       (montants ANNUELS, jamais sommés aux capitaux).
//   (2) Contrats de prévoyance décès (privés) — détail fiscal 990 I calqué sur
//       le bloc AV (assiette, abattement 152 500 €, base taxable, droits).
//
// Les capitaux décès sont HORS actif successoral : ce bloc n'influence aucun
// total de l'actif/droits (purement informatif). Cf. Lot 3.

import { BRAND, SURFACE } from "../../constants";
import { euro } from "../../lib/calculs/utils";
import type {
  CapitalDecesCaisseLine,
  CapitalDecesPriveLine,
  RenteSurvieAnnuelle,
} from "../../lib/calculs/succession";

const ABATTEMENT_990I = 152500;

type Props = {
  caisses: CapitalDecesCaisseLine[];
  prives: CapitalDecesPriveLine[];
  rentes: RenteSurvieAnnuelle[];
  totalCaisseExonere: number;
  totalPriveCapital: number;
  totalPriveDuties: number;
};

function relationLabel(rel: string): string {
  switch (rel) {
    case "conjoint": return "conjoint";
    case "pacs_partner": return "partenaire PACS";
    case "enfant": return "enfant";
    case "ascendant": return "ascendant";
    default: return "bénéficiaire désigné";
  }
}

function renteLabel(type: RenteSurvieAnnuelle["type"]): string {
  switch (type) {
    case "conjoint": return "Rente de survie du conjoint";
    case "education": return "Rente éducation";
    case "survie_orphelin": return "Rente survie / orphelin";
  }
}

function natureLabel(nature: CapitalDecesPriveLine["natureAssiette"]): string {
  return nature === "capital"
    ? "Assiette 990 I : capital transmis"
    : "Assiette 990 I : primes versées avant 70 ans";
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0] || "").join("").toUpperCase().slice(0, 2) || "?";
}

export function BlocCapitauxDeces({
  caisses,
  prives,
  rentes,
  totalCaisseExonere,
  totalPriveCapital,
  totalPriveDuties,
}: Props) {
  // Rétro-compat : rien à afficher pour un dossier sans capitaux décès.
  if (caisses.length === 0 && prives.length === 0) return null;

  const priveNet = totalPriveCapital - totalPriveDuties;

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: BRAND.sky }}>
        Capitaux décès (hors actif successoral)
      </div>

      <div className="grid gap-4">
        {/* ════════ Sous-bloc 1 : Régimes obligatoires ════════ */}
        {caisses.length > 0 && (
          <div style={{ borderRadius: "18px", overflow: "hidden", border: "1px solid rgba(227,175,100,0.4)", boxShadow: "0 2px 12px rgba(16,27,59,0.07)" }}>
            {/* Header */}
            <div style={{ background: `linear-gradient(120deg, ${BRAND.navy} 0%, ${BRAND.sky} 100%)`, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>Régimes obligatoires</div>
                {/* 0 € serait trompeur quand le seul capital est indisponible → tiret neutre. */}
                <div style={{ color: "#fff", fontSize: "20px", fontWeight: 700, marginTop: "2px" }}>{totalCaisseExonere > 0 ? euro(totalCaisseExonere) : "—"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ background: "rgba(134,239,172,0.2)", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", color: "#86efac", fontWeight: 600 }}>
                  Exonéré · hors succession
                </div>
              </div>
            </div>

            {/* Corps : une ligne par caisse */}
            <div style={{ background: SURFACE.card, padding: "12px 18px" }}>
              {caisses.map((l, i) => (
                <div key={i} style={{ paddingBottom: "10px", marginBottom: "10px", borderBottom: i < caisses.length - 1 ? `1px solid ${SURFACE.border}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: BRAND.navy }}>{l.source}</div>
                    {l.donneeIndisponible || l.capital == null ? (
                      <div style={{ fontSize: "12px", fontStyle: "italic", color: BRAND.muted }}>
                        Donnée régime non disponible
                      </div>
                    ) : (
                      <div style={{ fontSize: "14px", fontWeight: 700, color: BRAND.navy }}>
                        {euro(l.capital)}{" "}
                        <span style={{ fontSize: "11px", fontWeight: 600, color: BRAND.success }}>exonéré</span>
                      </div>
                    )}
                  </div>
                  {/* Capital orphelin (SSI) — exonéré, par enfant à charge */}
                  {l.capitalParEnfant != null && !l.donneeIndisponible && (
                    <div style={{ fontSize: "11px", color: BRAND.muted, marginTop: "3px" }}>
                      Capital orphelin : {euro(l.capitalParEnfant)} par enfant à charge
                      {l.nbEnfants > 0 && l.capitalOrphelinTotal != null && (
                        <> · {l.nbEnfants} enfant{l.nbEnfants > 1 ? "s" : ""} → {euro(l.capitalOrphelinTotal)}</>
                      )}
                    </div>
                  )}
                  {/* Dévolution (P3) — QUI perçoit (cascade légale L361-4 CSS ou
                      surcharge manuelle). Exonéré : aucun droit. */}
                  {!l.donneeIndisponible && l.capital != null && (() => {
                    const rep = l.repartition ?? [];
                    if (rep.length === 0) {
                      return (
                        <div style={{ fontSize: "11px", fontStyle: "italic", color: BRAND.warning, marginTop: "5px" }}>
                          Bénéficiaire à déterminer — aucun ayant droit automatique (désignation manuelle requise).
                        </div>
                      );
                    }
                    const manuel = rep.some((r) => r.source === "manuel");
                    return (
                      <div style={{ marginTop: "5px", display: "flex", flexDirection: "column", gap: "2px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 600, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Bénéficiaires {manuel ? "(désignation manuelle)" : "(dévolution légale)"}
                        </div>
                        {rep.map((r, ri) => (
                          <div key={ri} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: BRAND.muted }}>
                            <span>
                              {r.beneficiaire}{" "}
                              <span>({relationLabel(r.relation)}{r.origine === "capital_orphelin" ? " · orphelin" : ""})</span>
                            </span>
                            <span style={{ color: BRAND.navy, fontWeight: 600 }}>
                              {euro(r.montant)} <span style={{ color: BRAND.success }}>exonéré</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ))}

              {/* Rentes de survie / éducation — montants ANNUELS, distincts des capitaux */}
              {rentes.length > 0 && (
                <div style={{ marginTop: "4px", borderRadius: "10px", border: `1px solid ${SURFACE.border}`, background: SURFACE.app, padding: "10px 12px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                    Rentes de survie / éducation (annuelles)
                  </div>
                  <div style={{ fontSize: "11px", color: BRAND.muted, marginBottom: "8px" }}>
                    Versées chaque année aux ayants droit — distinctes des capitaux, jamais additionnées à ceux-ci.
                  </div>
                  {rentes.map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "2px 0" }}>
                      <span style={{ color: BRAND.navy }}>{renteLabel(r.type)} <span style={{ color: BRAND.muted }}>({r.source})</span></span>
                      <span style={{ fontWeight: 600, color: BRAND.navy }}>{euro(r.montantAnnuel)} /an</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════ Sous-bloc 2 : Contrats de prévoyance décès (privés) ════════ */}
        {prives.length > 0 && (
          <div style={{ borderRadius: "18px", overflow: "hidden", border: "1px solid rgba(227,175,100,0.4)", boxShadow: "0 2px 12px rgba(16,27,59,0.07)" }}>
            {/* Header — calqué sur la card AV */}
            <div style={{ background: `linear-gradient(120deg, ${BRAND.navy} 0%, ${BRAND.navy} 100%)`, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>Contrats de prévoyance décès</div>
                <div style={{ color: "#fff", fontSize: "20px", fontWeight: 700, marginTop: "2px" }}>{euro(totalPriveCapital)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "11px" }}>Net transmis</div>
                <div style={{ color: priveNet >= totalPriveCapital * 0.85 ? "#86efac" : "#fcd34d", fontSize: "16px", fontWeight: 700 }}>{euro(priveNet)}</div>
              </div>
            </div>

            {/* Body : récap fiscalité 990 I */}
            <div style={{ background: SURFACE.card, padding: "12px 18px", display: "flex", gap: "0" }}>
              {[
                { label: "Capital transmis", value: euro(totalPriveCapital), color: BRAND.navy },
                { label: "Droits 990 I", value: totalPriveDuties > 0 ? "−" + euro(totalPriveDuties) : "Exonéré", color: totalPriveDuties > 0 ? BRAND.warning : BRAND.success },
                { label: "Net transmis", value: euro(priveNet), color: BRAND.success },
              ].map((item, i) => (
                <div key={i} style={{ flex: 1, padding: "6px 10px", borderLeft: i > 0 ? "1px solid rgba(0,0,0,0.07)" : "none" }}>
                  <div style={{ fontSize: "11px", color: BRAND.muted, marginBottom: "3px" }}>{item.label}</div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Détail par bénéficiaire (cards, comme le bloc AV) */}
            <div style={{ background: SURFACE.card, padding: "0 18px 14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "10px" }}>
                {prives.map((l, li) => {
                  const abattUsed = Math.max(0, l.assiette990I - l.before70Taxable);
                  const abattPct = Math.min(100, (abattUsed / ABATTEMENT_990I) * 100);
                  const netLine = l.montant - l.duties;
                  return (
                    <div key={li} style={{ borderRadius: "12px", border: `1px solid ${SURFACE.border}`, padding: "12px", background: SURFACE.card }}>
                      {/* Avatar + nom + contrat */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                        <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: BRAND.navy + "18", color: BRAND.navy, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>{initials(l.beneficiary)}</div>
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: BRAND.navy }}>{l.beneficiary}</div>
                          <div style={{ fontSize: "11px", color: BRAND.muted }}>{l.contrat} · {l.sharePct}%</div>
                        </div>
                      </div>
                      {/* Capital + net */}
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <div>
                          <div style={{ fontSize: "11px", color: BRAND.muted }}>Capital</div>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: BRAND.navy }}>{euro(l.montant)}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "11px", color: BRAND.muted }}>Net reçu</div>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: BRAND.success }}>{euro(netLine)}</div>
                        </div>
                      </div>
                      {/* Assiette + base taxable + droits */}
                      <div style={{ fontSize: "11px", color: BRAND.muted, marginBottom: "2px" }}>{natureLabel(l.natureAssiette)} : {euro(l.assiette990I)}</div>
                      <div style={{ fontSize: "11px", color: BRAND.muted, marginBottom: "6px" }}>Base taxable : <strong style={{ color: BRAND.navy }}>{euro(l.before70Taxable)}</strong></div>
                      {l.duties > 0 ? (
                        <div style={{ fontSize: "11px", color: BRAND.warning, marginBottom: "8px" }}>Droits 990 I : −{euro(l.duties)}</div>
                      ) : (
                        <div style={{ fontSize: "11px", color: BRAND.success, marginBottom: "8px" }}>Exonéré</div>
                      )}
                      {/* Barre abattement 990 I */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: BRAND.muted, marginBottom: "3px" }}>
                          <span>Abatt. 990 I utilisé</span>
                          <span style={{ color: BRAND.navy }}>{euro(abattUsed)}</span>
                        </div>
                        <div style={{ height: "4px", borderRadius: "2px", background: SURFACE.border, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: abattPct + "%", background: abattPct < 100 ? BRAND.success : BRAND.navy, borderRadius: "2px" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
