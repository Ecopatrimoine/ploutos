// ─── Lot Dossier client — Pop-card universelle d'impression ───────────
//
// Composant React qui implémente la maquette validée
// (revue-preview/dossier_client_v2_lot.html — pop-card section).
//
// Workflow en 3 étapes :
//  1. Panier multi-sélection : 14 sections bilan patrimonial (toggles gold)
//     + 4 docs réglementaires (toggles couleurs propres au doc)
//  2. Overrides per-dossier (palette PDF, lieu signature, justifs LCB-FT,
//     pièces jointes) — sections filtrées selon les docs cochés
//  3. Vérification de complétude avant génération → si manques, 2ème pop-card
//     d'alerte (« Compléter d'abord » / « Continuer quand même »)
//
// Sortie : 1 PDF unique concaténé, ordre = bilan AVANT docs réglementaires.

import React, { useState, useMemo } from "react";
import { checkCompletude, sortPack, type PackItem, type CompletudeManque } from "../../lib/pdf/v2/popcard/checkCompletude";
import { generatePack, type PackOverrides } from "../../lib/pdf/v2/popcard/concatPack";

export type PopcardImpressionProps = {
  open: boolean;
  onClose: () => void;
  cabinet: Record<string, any>;
  mission: Record<string, any>;
  data: Record<string, any>;
  updateMission?: (key: string, val: any) => void;
  recommandations?: ReadonlyArray<any>;
  piecesJointes?: ReadonlyArray<any>;
  ir?: any;
  ifi?: any;
  succession?: any;
  irOptions?: { expenseMode1?: string; expenseMode2?: string };
  recipient?: "person1" | "person2" | "couple";
  hypothesisResults?: any;
  clientName?: string;
};

type PackItemDef = {
  key: PackItem;
  label: string;
  desc: string;
  group: "bilan" | "regl";
  subgroup?: string;
  bar: string;       // couleur barre verticale gauche
  toggle: string;    // couleur toggle ON
  badgeV1?: boolean; // section pas encore refaite en v2
};

const PACK_ITEMS: PackItemDef[] = [
  // ─── Bilan patrimonial — toggles GOLD (couleur logiciel) ──────────
  { key: "couverture", label: "Page de couverture", desc: "v2", group: "bilan", subgroup: "Préambule", bar: "var(--cab-gold)", toggle: "var(--cab-gold)" },
  { key: "cabinet", label: "Présentation cabinet", desc: "v1 — pas encore refait v2", group: "bilan", subgroup: "Préambule", bar: "var(--cab-gold)", toggle: "var(--cab-gold)", badgeV1: true },
  { key: "famille", label: "Composition familiale", desc: "v1 — pas encore refait v2", group: "bilan", subgroup: "Préambule", bar: "var(--cab-gold)", toggle: "var(--cab-gold)", badgeV1: true },
  { key: "travail", label: "Situation professionnelle", desc: "v1 — pas encore refait v2", group: "bilan", subgroup: "Préambule", bar: "var(--cab-gold)", toggle: "var(--cab-gold)", badgeV1: true },
  { key: "bilanEndettement", label: "Bilan & endettement", desc: "v2", group: "bilan", subgroup: "Synthèse fiscale", bar: "var(--cab-gold)", toggle: "var(--cab-gold)" },
  { key: "ir", label: "Impôt sur le revenu (IR)", desc: "v2", group: "bilan", subgroup: "Synthèse fiscale", bar: "var(--cab-gold)", toggle: "var(--cab-gold)" },
  { key: "ifi", label: "IFI", desc: "v2", group: "bilan", subgroup: "Synthèse fiscale", bar: "var(--cab-gold)", toggle: "var(--cab-gold)" },
  { key: "successionA", label: "Succession civile", desc: "v2 — dévolution + héritiers", group: "bilan", subgroup: "Transmission", bar: "var(--cab-gold)", toggle: "var(--cab-gold)" },
  { key: "successionB", label: "Assurance-vie & transmission", desc: "v2 — clause bénéficiaire", group: "bilan", subgroup: "Transmission", bar: "var(--cab-gold)", toggle: "var(--cab-gold)" },
  { key: "profil", label: "Profil & adéquation MIF II", desc: "v2", group: "bilan", subgroup: "Profil & protection", bar: "var(--cab-gold)", toggle: "var(--cab-gold)" },
  { key: "prevoyanceInd", label: "Prévoyance individuelle", desc: "v2", group: "bilan", subgroup: "Profil & protection", bar: "var(--cab-gold)", toggle: "var(--cab-gold)" },
  { key: "prevoyanceColl", label: "Prévoyance collective", desc: "v2 — si dirigeant", group: "bilan", subgroup: "Profil & protection", bar: "var(--cab-gold)", toggle: "var(--cab-gold)" },
  { key: "hypos", label: "Hypothèses et conséquences", desc: "v1 — scénarios d'optimisation (PER, donation, AV…) + impacts IR/IFI/Succession", group: "bilan", subgroup: "Plan d'action & mentions", bar: "var(--cab-gold)", toggle: "var(--cab-gold)", badgeV1: true },
  { key: "recommandations", label: "Recommandations & plan d'action", desc: "v1 — pas encore refait v2", group: "bilan", subgroup: "Plan d'action & mentions", bar: "var(--cab-gold)", toggle: "var(--cab-gold)", badgeV1: true },
  { key: "mentions", label: "Mentions légales", desc: "v1 — pas encore refait v2", group: "bilan", subgroup: "Plan d'action & mentions", bar: "var(--cab-gold)", toggle: "var(--cab-gold)", badgeV1: true },
  // ─── Documents réglementaires — toggles couleurs propres ─────────
  { key: "lettre", label: "Lettre de mission", desc: "Contrat préalable à la mission", group: "regl", bar: "#0F172A", toggle: "#0F172A" },
  { key: "der", label: "DER", desc: "Document d'entrée en relation", group: "regl", bar: "#26428B", toggle: "#26428B" },
  { key: "dda", label: "Fiche conseil DDA", desc: "Besoins · garanties · IPID", group: "regl", bar: "var(--cab-gold)", toggle: "var(--cab-gold)" },
  { key: "adequation", label: "Déclaration d'adéquation", desc: "Justification du conseil · MIF II", group: "regl", bar: "#166534", toggle: "#166534" },
];

const SUBGROUPS_BILAN = ["Préambule", "Synthèse fiscale", "Transmission", "Profil & protection", "Plan d'action & mentions"];

// Couleur unique pour les toggles app (cohérent TabFamiliale BRAND.gold)
const CAB_GOLD = "#C4973D";

export function PopcardImpression(p: PopcardImpressionProps) {
  const [pack, setPack] = useState<Set<PackItem>>(new Set());
  const [paletteOverride, setPaletteOverride] = useState<"" | "cabinet" | "encre_or">(
    (p.mission?.pdfPaletteOverride as any) || "",
  );
  const [lieuOverride, setLieuOverride] = useState("");
  const [checkOpen, setCheckOpen] = useState(false);
  const [missing, setMissing] = useState<CompletudeManque[]>([]);
  // Destinataire — pertinent uniquement en concubinage (foyers fiscaux séparés).
  const [recipientChoice, setRecipientChoice] = useState<"couple" | "person1" | "person2">(p.recipient || "couple");

  // ─── Reset à chaque ouverture ─────────────────────────────────────
  React.useEffect(() => {
    if (p.open) {
      setPack(new Set());
      setLieuOverride("");
      setCheckOpen(false);
      setPaletteOverride((p.mission?.pdfPaletteOverride as any) || "");
      setRecipientChoice(p.recipient || "couple");
    }
  }, [p.open, p.mission?.pdfPaletteOverride, p.recipient]);

  if (!p.open) return null;

  // ─── Manipulation du panier ───────────────────────────────────────
  const togglePack = (item: PackItem) => {
    setPack(prev => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };
  const toggleAllBilan = (val: boolean) => {
    setPack(prev => {
      const next = new Set(prev);
      PACK_ITEMS.filter(i => i.group === "bilan").forEach(i => {
        if (val) next.add(i.key);
        else next.delete(i.key);
      });
      return next;
    });
  };

  // ─── Sections d'overrides à afficher selon docs cochés ────────────
  const showLieu = ["lettre", "der", "adequation", "couverture", "cabinet", "mentions"].some(k => pack.has(k as PackItem));
  const showRemu = pack.has("lettre");
  const showLcbft = pack.has("lettre");
  const showIpid = pack.has("dda");
  // Destinataire — pertinent uniquement en concubinage (foyers fiscaux séparés).
  const isCohab = p.data?.coupleStatus === "cohab";
  const showDestinataire = isCohab && pack.has("couverture");
  const p1Label = [p.data?.person1FirstName, p.data?.person1LastName].filter(Boolean).join(" ") || "Personne 1";
  const p2Label = [p.data?.person2FirstName, p.data?.person2LastName].filter(Boolean).join(" ") || "Personne 2";

  // ─── Récap pack ────────────────────────────────────────────────────
  const packArr = Array.from(pack);
  const count = packArr.length;
  const hasBilan = packArr.some(k => PACK_ITEMS.find(i => i.key === k)?.group === "bilan");
  const hasRegl = packArr.some(k => PACK_ITEMS.find(i => i.key === k)?.group === "regl");
  const orderNote = hasBilan && hasRegl ? "Ordre du PDF : Bilan patrimonial → Documents réglementaires" : "";

  // ─── Génération + vérification ────────────────────────────────────
  const handleGenerate = () => {
    const ordered = sortPack(packArr);
    const manques = checkCompletude(ordered, {
      cabinet: p.cabinet,
      mission: p.mission,
      data: p.data,
      recommandations: p.recommandations,
      piecesJointes: p.piecesJointes,
    });
    if (manques.length === 0) {
      doGenerate();
    } else {
      setMissing(manques);
      setCheckOpen(true);
    }
  };
  const doGenerate = () => {
    const overrides: PackOverrides = {
      pdfPaletteOverride: paletteOverride,
      lieuSignatureOverride: lieuOverride || undefined,
    };
    // Persiste l'override palette dans mission (si updateMission fourni)
    if (p.updateMission && paletteOverride !== (p.mission?.pdfPaletteOverride || "")) {
      p.updateMission("pdfPaletteOverride", paletteOverride);
    }
    generatePack(packArr, overrides, {
      cabinet: p.cabinet,
      mission: { ...p.mission, lieuSignature: lieuOverride || p.mission.lieuSignature },
      data: p.data,
      recommandations: p.recommandations,
      piecesJointes: p.piecesJointes,
      ir: p.ir,
      ifi: p.ifi,
      succession: p.succession,
      irOptions: p.irOptions,
      recipient: isCohab ? recipientChoice : "couple",
      hypothesisResults: p.hypothesisResults,
      clientName: p.clientName,
    });
    setCheckOpen(false);
    p.onClose();
  };

  return (
    <>
      {/* ─── Backdrop + pop-card principale ─── */}
      <div
        onClick={p.onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 30, backdropFilter: "blur(3px)" }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: "#fff", borderRadius: 24, maxWidth: 720, width: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 30px 80px rgba(15,23,42,.4)", ["--cab-gold" as any]: CAB_GOLD }}
        >
          {/* Header */}
          <div style={{ padding: "22px 28px 14px", borderBottom: "1px solid #D8D2C6", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>Générer un document PDF</h2>
              <div style={{ fontSize: 12, color: "#637896", marginTop: 4, lineHeight: 1.5 }}>
                Choisissez les éléments à inclure dans le PDF généré. Vous pouvez combiner librement docs réglementaires + sections du bilan patrimonial. <strong>1 seul PDF</strong> final contenant tous les éléments cochés.
              </div>
            </div>
            <button onClick={p.onClose} style={{ background: "transparent", border: "none", fontSize: 22, color: "#637896", cursor: "pointer", padding: 0, lineHeight: 1, flex: "none" }}>×</button>
          </div>

          {/* Body */}
          <div style={{ padding: "18px 28px" }}>
            {/* ─── Section panier ─── */}
            <PackPicker pack={pack} togglePack={togglePack} toggleAllBilan={toggleAllBilan} />

            {/* Récap */}
            <div style={{
              marginTop: 12, padding: "9px 13px", borderRadius: 10, textAlign: "center",
              background: count === 0 ? "#F4F2EC" : "rgba(124,58,237,.06)",
              border: count === 0 ? "1px solid #D8D2C6" : "1px solid rgba(124,58,237,.2)",
              color: count === 0 ? "#637896" : "#7C3AED",
              fontSize: 11.5, fontWeight: 700,
            }}>
              <div><span style={{ fontSize: 14, fontWeight: 800 }}>{count}</span> élément(s) sélectionné(s) — {count === 0 ? "aucun" : `1 PDF contenant ${count} élément(s)`}</div>
              {orderNote && <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 4, opacity: .8 }}>{orderNote}</div>}
            </div>

            {/* ─── Sections d'overrides (visibles après ≥ 1 sélection) ─── */}
            {count > 0 && (
              <div style={{ marginTop: 18 }}>
                <OverrideSection title="Palette PDF">
                  <DefaultBox text="Défaut cabinet" value="Couleurs du cabinet" />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                    {([
                      ["", "Défaut cabinet"],
                      ["cabinet", "Forcer Couleurs du cabinet"],
                      ["encre_or", "Forcer Encre & Or"],
                    ] as [any, string][]).map(([v, l]) => (
                      <label
                        key={v}
                        onClick={() => setPaletteOverride(v)}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 11px",
                          borderRadius: 9, fontSize: 11.5, color: "#0F172A",
                          background: paletteOverride === v ? "rgba(124,58,237,.08)" : "#F4F2EC",
                          cursor: "pointer", border: paletteOverride === v ? "1.5px solid #7C3AED" : "1.5px solid transparent",
                          fontWeight: paletteOverride === v ? 700 : 400,
                        }}
                      >
                        <input type="radio" checked={paletteOverride === v} onChange={() => {}} style={{ accentColor: "#7C3AED", width: 13, height: 13 }} />
                        {l}
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#7E8F9F", marginTop: 6, fontStyle: "italic" }}>
                    Stocké sous <code style={{ fontFamily: "monospace", fontSize: 10, background: "rgba(15,23,42,.05)", padding: "1px 4px", borderRadius: 3 }}>mission.pdfPaletteOverride</code> — vide = suit cabinet.
                  </div>
                </OverrideSection>

                {showLieu && (
                  <OverrideSection title="Lieu de signature">
                    <DefaultBox text="Défaut dossier" value={p.mission.lieuSignature || "—"} />
                    <input
                      type="text"
                      value={lieuOverride}
                      onChange={e => setLieuOverride(e.target.value)}
                      placeholder="ex: Lyon — laisser vide pour utiliser le défaut"
                      style={{ width: "100%", fontFamily: "inherit", fontSize: 12.5, color: "#0F172A", padding: "8px 12px", border: "1px solid #E8E3D9", borderRadius: 10, background: "#fff" }}
                    />
                  </OverrideSection>
                )}

                {showDestinataire && (
                  <OverrideSection title="Destinataire (concubinage)">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {([
                        ["couple",  `Couple — ${p1Label} & ${p2Label}`],
                        ["person1", p1Label],
                        ["person2", p2Label],
                      ] as ["couple" | "person1" | "person2", string][]).map(([v, l]) => (
                        <label
                          key={v}
                          onClick={() => setRecipientChoice(v)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 11px",
                            borderRadius: 9, fontSize: 11.5, color: "#0F172A",
                            background: recipientChoice === v ? "rgba(196,151,61,.10)" : "#F4F2EC",
                            cursor: "pointer", border: recipientChoice === v ? `1.5px solid ${CAB_GOLD}` : "1.5px solid transparent",
                            fontWeight: recipientChoice === v ? 700 : 400,
                          }}
                        >
                          <input type="radio" checked={recipientChoice === v} onChange={() => {}} style={{ accentColor: CAB_GOLD, width: 13, height: 13 }} />
                          {l}
                        </label>
                      ))}
                    </div>
                    <div style={{ fontSize: 10.5, color: "#7E8F9F", marginTop: 6, fontStyle: "italic" }}>
                      En concubinage, chaque personne a son propre foyer fiscal. Le destinataire détermine le nom affiché sur la couverture (et, à terme, le routage par section).
                    </div>
                  </OverrideSection>
                )}

                {showRemu && (
                  <OverrideSection title="Mode de rémunération mission">
                    <div style={{ background: "rgba(196,151,61,.06)", borderLeft: "3px solid #C4973D", borderRadius: 8, padding: "9px 13px", fontSize: 11.5, color: "#0F172A", lineHeight: 1.5 }}>
                      <strong>Coché actuellement</strong> dans Tab Dossier client : {summarizeRemu(p.mission)}
                      <br />
                      <a onClick={p.onClose} style={{ color: "#26428B", fontWeight: 700, textDecoration: "none", fontSize: 10.5, display: "inline-block", marginTop: 4, cursor: "pointer" }}>
                        → Modifier dans le tab Dossier client
                      </a>
                    </div>
                  </OverrideSection>
                )}

                {showLcbft && (
                  <OverrideSection title="Justificatifs LCB-FT (KYC ce dossier)">
                    {([
                      ["justifDomicile", "Justificatif de domicile collecté"],
                      ["justifOrigineFonds", "Justificatif d'origine des fonds"],
                    ] as [string, string][]).map(([key, label]) => (
                      <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "6px 0", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={!!p.mission[key]}
                          onChange={e => p.updateMission && p.updateMission(key, e.target.checked)}
                          style={{ marginTop: 3, accentColor: "#7C3AED", width: 14, height: 14 }}
                        />
                        <span style={{ fontSize: 12, color: "#0F172A", fontWeight: 600 }}>{label}<br/>
                          <span style={{ fontSize: 10.5, color: "#637896", fontWeight: 400 }}>Persisté dans <code style={{ fontFamily: "monospace", fontSize: 9.5 }}>mission.{key}</code></span>
                        </span>
                      </label>
                    ))}
                    {p.mission.ppe && (
                      <div style={{ marginTop: 10 }}>
                        <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#637896", marginBottom: 5, letterSpacing: ".02em" }}>Détails PPE</label>
                        <input
                          type="text"
                          value={p.mission.ppeDetails || ""}
                          onChange={e => p.updateMission && p.updateMission("ppeDetails", e.target.value)}
                          placeholder="ex: maire, mandat national, conjoint d'élu…"
                          style={{ width: "100%", fontFamily: "inherit", fontSize: 12.5, color: "#0F172A", padding: "8px 12px", border: "1px solid #E8E3D9", borderRadius: 10, background: "#fff" }}
                        />
                      </div>
                    )}
                  </OverrideSection>
                )}

                {showIpid && (
                  <OverrideSection title="Pièces jointes IPID / DIC">
                    <div style={{ background: "rgba(196,151,61,.06)", borderLeft: "3px solid #C4973D", borderRadius: 8, padding: "9px 13px", fontSize: 11.5, color: "#0F172A", lineHeight: 1.5 }}>
                      <strong>{(p.piecesJointes || []).length} pièce(s) rattachée(s)</strong> à ce dossier.
                      <br />
                      <a onClick={p.onClose} style={{ color: "#26428B", fontWeight: 700, textDecoration: "none", fontSize: 10.5, display: "inline-block", marginTop: 4, cursor: "pointer" }}>
                        → Gérer les pièces dans le tab Dossier client
                      </a>
                    </div>
                  </OverrideSection>
                )}
              </div>
            )}

            {count === 0 && (
              <div style={{ padding: "30px 20px", textAlign: "center", background: "#FDFCFA", border: "1.5px dashed #D8D2C6", borderRadius: 12, marginTop: 18 }}>
                <div style={{ fontSize: 34, marginBottom: 8 }}>📄</div>
                <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Cochez au moins un élément ci-dessus</div>
                <div style={{ fontSize: 11.5, color: "#637896" }}>Les options de surcharge s'afficheront selon les documents sélectionnés.</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "16px 28px 24px", borderTop: "1px solid #D8D2C6", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 10.5, color: "#7E8F9F", fontStyle: "italic" }}>Overrides persistés dans le dossier client</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={p.onClose} style={{ background: "transparent", color: "#637896", border: "1px solid #D8D2C6", padding: "9px 16px", borderRadius: 10, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Annuler</button>
              <button
                onClick={handleGenerate}
                disabled={count === 0}
                style={{
                  background: count === 0 ? "#E2E8F0" : "#7C3AED",
                  color: count === 0 ? "#7E8F9F" : "#fff",
                  border: "none", padding: "9px 18px", borderRadius: 10, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700,
                  cursor: count === 0 ? "not-allowed" : "pointer",
                  boxShadow: count === 0 ? "none" : "0 1px 3px rgba(124,58,237,.4)",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                <span>↓</span>{count === 0 ? "Cocher au moins 1 élément" : "Générer le pack PDF"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2ème pop-card : vérification de complétude ─── */}
      {checkOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110, padding: 30, backdropFilter: "blur(3px)" }}>
          <div style={{ background: "#fff", borderRadius: 24, maxWidth: 580, width: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 30px 80px rgba(15,23,42,.4)" }}>
            <div style={{ padding: "22px 28px 14px", borderBottom: "1px solid #F5D78E", background: "linear-gradient(180deg,#FEF9EE 0%,#fff 100%)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#92400E", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>⚠ Données incomplètes</h2>
                <div style={{ fontSize: 12, color: "#637896", marginTop: 4, lineHeight: 1.5 }}>
                  Certains champs nécessaires aux documents cochés ne sont pas renseignés. Vous pouvez compléter d'abord ou continuer quand même (les champs vides apparaîtront en « à confirmer » sur le PDF).
                </div>
              </div>
              <button onClick={() => setCheckOpen(false)} style={{ background: "transparent", border: "none", fontSize: 22, color: "#637896", cursor: "pointer", padding: 0, lineHeight: 1, flex: "none" }}>×</button>
            </div>
            <div style={{ padding: "18px 28px" }}>
              {missing.map(m => (
                <div key={m.pack} style={{ background: "#FDFCFA", border: "1px solid #D8D2C6", borderRadius: 10, padding: "11px 13px", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#92400E", fontSize: 8 }}>●</span>{m.packLabel}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: "#637896", lineHeight: 1.55 }}>
                    {m.fields.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <div style={{ padding: "16px 28px 24px", borderTop: "1px solid #D8D2C6", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 10.5, color: "#7E8F9F", fontStyle: "italic" }}>{missing.reduce((s, m) => s + m.fields.length, 0)} champ(s) manquant(s)</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setCheckOpen(false)} style={{ background: "transparent", color: "#637896", border: "1px solid #D8D2C6", padding: "9px 16px", borderRadius: 10, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>← Compléter d'abord</button>
                <button onClick={doGenerate} style={{ background: "#92400E", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 10, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 1px 3px rgba(146,64,14,.4)" }}>Continuer quand même →</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Sub-composants ──────────────────────────────────────────────────
function PackPicker({ pack, togglePack, toggleAllBilan }: { pack: Set<PackItem>; togglePack: (i: PackItem) => void; toggleAllBilan: (v: boolean) => void }) {
  return (
    <div>
      {/* Group 1 : Bilan patrimonial (en premier) */}
      <div style={{ background: "#FDFCFA", border: "1px solid #D8D2C6", borderRadius: 14, padding: "12px 14px" }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#0F172A", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
          Bilan patrimonial — sections
          <button onClick={() => toggleAllBilan(true)} style={{ background: "transparent", border: "1px solid #D8D2C6", color: "#637896", fontSize: 9.5, fontWeight: 700, padding: "3px 8px", borderRadius: 6, cursor: "pointer", marginLeft: "auto" }}>Tout cocher</button>
          <button onClick={() => toggleAllBilan(false)} style={{ background: "transparent", border: "1px solid #D8D2C6", color: "#637896", fontSize: 9.5, fontWeight: 700, padding: "3px 8px", borderRadius: 6, cursor: "pointer" }}>Tout décocher</button>
        </div>
        {SUBGROUPS_BILAN.map(sg => (
          <div key={sg} style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#637896", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 5, paddingLeft: 2 }}>{sg}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {PACK_ITEMS.filter(i => i.group === "bilan" && i.subgroup === sg).map(item => (
                <PackToggle key={item.key} item={item} checked={pack.has(item.key)} onToggle={() => togglePack(item.key)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Group 2 : Documents réglementaires (en bas) */}
      <div style={{ background: "#FDFCFA", border: "1px solid #D8D2C6", borderRadius: 14, padding: "12px 14px", marginTop: 12 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#0F172A", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 8 }}>Documents réglementaires</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {PACK_ITEMS.filter(i => i.group === "regl").map(item => (
            <PackToggle key={item.key} item={item} checked={pack.has(item.key)} onToggle={() => togglePack(item.key)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PackToggle({ item, checked, onToggle }: { item: PackItemDef; checked: boolean; onToggle: () => void }) {
  return (
    <label
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        background: checked ? "rgba(124,58,237,.04)" : "#fff",
        border: checked ? "1px solid #7C3AED" : "1px solid #D8D2C6",
        boxShadow: checked ? "0 0 0 1.5px rgba(124,58,237,.1)" : "none",
        borderRadius: 9, padding: "8px 11px", cursor: "pointer", transition: "all .12s",
      }}
    >
      <span style={{ position: "relative", width: 30, height: 17, flex: "none", display: "inline-block" }}>
        <input type="checkbox" checked={checked} onChange={() => {}} style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", margin: 0, left: 0, top: 0, zIndex: 1, cursor: "pointer" }} />
        <span style={{ position: "absolute", inset: 0, background: checked ? item.toggle : "#CBD5E1", borderRadius: 10, transition: "background .2s" }}>
          <span style={{ position: "absolute", left: 2, top: 2, width: 13, height: 13, background: "#fff", borderRadius: "50%", transition: "transform .2s", transform: checked ? "translateX(13px)" : "translateX(0)", boxShadow: "0 1px 2px rgba(15,23,42,.25)" }} />
        </span>
      </span>
      <span style={{ width: 3, height: 28, borderRadius: 1.5, flex: "none", opacity: checked ? 1 : 0.7, background: item.bar }} />
      <span style={{ flex: 1, lineHeight: 1.3, minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</strong>
        <span style={{ display: "block", fontSize: 9.5, color: item.badgeV1 ? "#7A3608" : "#637896", marginTop: 1, fontWeight: item.badgeV1 ? 600 : 400 }}>{item.desc}</span>
      </span>
    </label>
  );
}

function OverrideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: "#7C3AED", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#7C3AED" }} />
        {title}
      </div>
      {children}
    </div>
  );
}

function DefaultBox({ text, value }: { text: string; value: string }) {
  return (
    <div style={{ background: "rgba(38,66,139,.05)", borderRadius: 10, padding: "9px 13px", fontSize: 11.5, color: "#26428B", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontWeight: 700, color: "#26428B" }}>⊕</span>
      {text} : <strong style={{ color: "#0F172A", marginLeft: "auto" }}>{value}</strong>
    </div>
  );
}

function summarizeRemu(mission: any): string {
  const items = [];
  if (mission.remuCommission) items.push("Commission");
  if (mission.remuHonoraire) items.push(`Honoraire${mission.remuHonoraireMontant ? ` (${mission.remuHonoraireMontant})` : ""}`);
  if (mission.remuMixte) items.push("Mixte");
  return items.length > 0 ? items.join(" + ") : "Aucun mode coché";
}
