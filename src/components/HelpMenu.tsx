// src/components/HelpMenu.tsx
import { useState, useRef, useEffect } from "react";

interface HelpMenuProps {
  colorNavy: string;
  colorGold: string;
  colorSky: string;
  cabinetName?: string;
  appVersion?: string;
}

type ModalType = "bug" | "suggestion" | null;

export function HelpMenu({ colorNavy, colorGold, colorSky, cabinetName = "Utilisateur", appVersion = "web" }: HelpMenuProps) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);
  const [dropPos, setDropPos] = useState({ top: 90, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 8, left: r.left - 170 });
    }
    setOpen(o => !o);
  };

  const openModal = (type: ModalType) => {
    setModal(type);
    setOpen(false);
  };

  return (
    <>
      {/* Bouton ? dans le header */}
      <div style={{ position: "relative" }}>
        <button
          ref={btnRef}
          onClick={handleOpen}
          title="Aide"
          style={{
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: "10px",
            padding: "6px 12px",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Lato', sans-serif",
          }}
        >
          ?
        </button>

        {/* Dropdown — position fixed pour éviter le clip du header */}
        {open && (
          <>
            {/* Overlay transparent pour fermer */}
            <div
              style={{ position: "fixed", inset: 0, zIndex: 999 }}
              onClick={() => setOpen(false)}
            />
            <div style={{
              position: "fixed",
              top: `${dropPos.top}px`,
              left: `${dropPos.left}px`,
              zIndex: 1000,
              background: "#fff",
              borderRadius: "14px",
              boxShadow: "0 8px 32px rgba(16,27,59,0.18)",
              overflow: "hidden",
              minWidth: "210px",
              border: "1px solid rgba(227,175,100,0.2)",
            }}>
              <button
                onClick={() => openModal("bug")}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  width: "100%", padding: "12px 16px", border: "none",
                  background: "transparent", cursor: "pointer", textAlign: "left",
                  fontSize: "13px", fontFamily: "'Lato', sans-serif", fontWeight: 600,
                  color: colorNavy, transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(16,27,59,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                🐛 Signaler un bug
              </button>
              <div style={{ height: "1px", background: "rgba(0,0,0,0.06)", margin: "0 12px" }} />
              <button
                onClick={() => openModal("suggestion")}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  width: "100%", padding: "12px 16px", border: "none",
                  background: "transparent", cursor: "pointer", textAlign: "left",
                  fontSize: "13px", fontFamily: "'Lato', sans-serif", fontWeight: 600,
                  color: colorNavy, transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(16,27,59,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                💡 Faire une suggestion
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modales */}
      {modal && (
        <BugSuggestionModal
          type={modal}
          onClose={() => setModal(null)}
          colorNavy={colorNavy}
          colorGold={colorGold}
          colorSky={colorSky}
          cabinetName={cabinetName}
          appVersion={appVersion}
        />
      )}
    </>
  );
}

// ── Modale Bug / Suggestion ─────────────────────────────────────────
interface ModalProps {
  type: "bug" | "suggestion";
  onClose: () => void;
  colorNavy: string;
  colorGold: string;
  colorSky: string;
  cabinetName: string;
  appVersion: string;
}

function BugSuggestionModal({ type, onClose, colorNavy, colorGold, colorSky, cabinetName, appVersion }: ModalProps) {
  const isBug = type === "bug";

  const defaultBody = isBug
    ? `Bonjour,

Je souhaite signaler un bug sur l'application Ploutos.

────────────────────────────────
Description du bug :
[Décrivez ici le problème rencontré]

Étapes pour reproduire :
1. 
2. 
3. 

Page / module concerné :
[Ex : Collecte patrimoniale, Immobilier, Succession, PDF...]

Comportement observé :
[Ce qui se passe actuellement]

Comportement attendu :
[Ce qui devrait se passer]
────────────────────────────────

Version : ${appVersion}
Plateforme : Web (${navigator.userAgent.includes("Windows") ? "Windows" : navigator.userAgent.includes("Mac") ? "Mac" : "Autre"})

Cordialement,
${cabinetName}`
    : `Bonjour,

Je souhaite soumettre une suggestion d'amélioration pour Ploutos.

────────────────────────────────
Ma suggestion :
[Décrivez ici votre idée]

Module / fonctionnalité concerné(e) :
[Ex : Collecte patrimoniale, Immobilier, Succession, PDF...]

Pourquoi cette amélioration serait utile :
[Expliquez le bénéfice attendu]

Contexte d'utilisation :
[Dans quelle situation avez-vous ressenti ce besoin ?]
────────────────────────────────

Version : ${appVersion}
Plateforme : Web (${navigator.userAgent.includes("Windows") ? "Windows" : navigator.userAgent.includes("Mac") ? "Mac" : "Autre"})

Cordialement,
${cabinetName}`;

  const [subject, setSubject] = useState(
    isBug ? `Bug signalé par ${cabinetName}` : `Suggestion de ${cabinetName}`
  );
  const [body, setBody] = useState(defaultBody);
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    window.location.href = `mailto:contact@ecopatrimoine-conseil.com?subject=${encodedSubject}&body=${encodedBody}`;
    setSent(true);
    setTimeout(onClose, 1500);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(16,27,59,0.45)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
    }}>
      <div style={{
        background: "#fff", borderRadius: "24px", width: "100%", maxWidth: "560px",
        boxShadow: "0 24px 64px rgba(16,27,59,0.25)",
        overflow: "hidden",
        fontFamily: "'Lato', sans-serif",
      }}>
        {/* Header modale */}
        <div style={{
          padding: "20px 24px 16px",
          background: `linear-gradient(135deg, ${colorNavy} 0%, ${colorSky} 100%)`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "16px" }}>
              {isBug ? "🐛 Signaler un bug" : "💡 Faire une suggestion"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", marginTop: "2px" }}>
              Envoi à contact@ecopatrimoine-conseil.com
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px",
            color: "#fff", width: "30px", height: "30px", cursor: "pointer",
            fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Corps modale */}
        <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Sujet */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, color: colorSky, letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              Sujet
            </label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: "12px",
                border: "1px solid rgba(227,175,100,0.35)", fontSize: "13px",
                fontFamily: "'Lato', sans-serif", color: colorNavy,
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Corps */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, color: colorSky, letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              Message
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={14}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: "12px",
                border: "1px solid rgba(227,175,100,0.35)", fontSize: "12px",
                fontFamily: "monospace", color: "#374151", resize: "vertical",
                outline: "none", boxSizing: "border-box", lineHeight: "1.6",
              }}
            />
          </div>

          {/* Boutons */}
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{
              padding: "10px 20px", borderRadius: "12px",
              border: "1px solid rgba(0,0,0,0.1)", background: "#fff",
              fontSize: "13px", fontWeight: 600, cursor: "pointer",
              fontFamily: "'Lato', sans-serif", color: "#6b7280",
            }}>
              Annuler
            </button>
            <button
              onClick={handleSend}
              disabled={!subject || !body || sent}
              style={{
                padding: "10px 24px", borderRadius: "12px", border: "none",
                background: sent ? "#10b981" : `linear-gradient(135deg, ${colorNavy} 0%, ${colorSky} 100%)`,
                color: "#fff", fontSize: "13px", fontWeight: 700, cursor: sent ? "default" : "pointer",
                fontFamily: "'Lato', sans-serif",
                transition: "background 0.3s",
                boxShadow: "0 4px 16px rgba(16,27,59,0.25)",
              }}
            >
              {sent ? "✓ Ouverture du client mail..." : "Envoyer →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
