// ─── C7 — Modal d'export : sauvegarde locale chiffree ───────────────────────
//
// Double saisie du mot de passe + regles affichees + avertissements. A la
// confirmation : chiffrement AES-GCM du lot de ClientRecord (crypto.ts) et
// enregistrement du fichier .ploutosbackup (showSaveFilePicker sinon <a>).
// Le meme modal sert l'archive de 1 dossier (header) et de tous (Parametres) —
// seuls `records`, `filenameBase` et `scopeLabel` changent.

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldCheck, AlertTriangle, Loader2, Check, X } from "lucide-react";
import { SURFACE, BRAND } from "../../constants";
import type { ClientRecord } from "../../useClients";
import { encryptBackup } from "../../lib/backup/crypto";
import { serializeBackup, buildBackupFileName, BACKUP_EXTENSION } from "../../lib/backup/format";
import { validatePassword } from "../../lib/backup/password";

type Props = {
  open: boolean;
  onClose: () => void;
  records: ClientRecord[];
  filenameBase: string; // base du nom de fichier (nom du dossier, ou "tous mes dossiers")
  scopeLabel: string;   // ex : "ce dossier" / "vos 12 dossiers"
};

// Ecrit le blob : File System Access API si dispo, sinon <a download>. Un
// abandon utilisateur (AbortError) n'est pas une erreur. Retourne true si le
// fichier a ete propose/ecrit, false si l'utilisateur a annule.
async function saveBackupBlob(text: string, fileName: string): Promise<boolean> {
  const blob = new Blob([text], { type: "application/octet-stream" });
  const picker = window as unknown as {
    showSaveFilePicker?: (o: unknown) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }>;
  };
  if (picker.showSaveFilePicker) {
    try {
      const handle = await picker.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: "Sauvegarde Ploutos chiffree", accept: { "application/octet-stream": [BACKUP_EXTENSION] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return false; // annulation
      // Autre echec (permission, apercu qui bloque…) -> repli <a download>.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => { a.parentNode?.removeChild(a); URL.revokeObjectURL(url); }, 500);
  return true;
}

const RULES = [
  "Au moins 12 caracteres",
  "Au moins une majuscule",
  "Au moins un caractere special",
];

export default function BackupExportModal({ open, onClose, records, filenameBase, scopeLabel }: Props) {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Reinitialiser a chaque ouverture (jamais conserver un mot de passe en memoire
  // du composant apres fermeture).
  useEffect(() => {
    if (open) { setPw1(""); setPw2(""); setBusy(false); setError(null); setDone(false); }
  }, [open]);

  const check = validatePassword(pw1);
  const match = pw1.length > 0 && pw1 === pw2;
  const canSubmit = check.ok && match && records.length > 0 && !busy;

  const ruleSatisfied = (label: string): boolean => {
    if (pw1.length === 0) return false;
    // Une regle est tenue si aucun message d'erreur ne la vise (password.ts = autorite).
    const key = label.toLowerCase().includes("12") ? "12"
      : label.toLowerCase().includes("majuscule") ? "majuscule" : "special";
    return !check.errors.some((e) => e.toLowerCase().includes(key));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const envelope = await encryptBackup(records, pw1);
      const fileName = buildBackupFileName(filenameBase, envelope.exportedAt);
      const saved = await saveBackupBlob(serializeBackup(envelope), fileName);
      if (saved) setDone(true);
      else setBusy(false); // annulation : rester sur le formulaire
    } catch (e) {
      console.error("Sauvegarde chiffree — echec:", e);
      setError("La sauvegarde a echoue. Reessayez.");
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent aria-describedby="backup-export-desc" className="max-w-lg rounded-2xl" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}>
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2" style={{ color: BRAND.navy }}>
            <ShieldCheck className="h-5 w-5" aria-hidden="true" /> Sauvegarde chiffree
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div id="backup-export-desc" className="text-sm text-slate-600 leading-relaxed space-y-3">
            <p className="inline-flex items-center gap-2 font-semibold text-emerald-700">
              <Check className="h-4 w-4" aria-hidden="true" /> Sauvegarde de {scopeLabel} enregistree.
            </p>
            <p>Conservez le fichier <strong>et</strong> son mot de passe en lieu sur. Sans le mot de passe, la sauvegarde est <strong>definitivement illisible</strong>.</p>
            <div className="flex justify-end">
              <button onClick={onClose} className="text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg px-3 py-2 transition-colors">Fermer</button>
            </div>
          </div>
        ) : (
          <div id="backup-export-desc" className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Chiffre <strong>{scopeLabel}</strong> ({records.length} dossier{records.length > 1 ? "s" : ""}) dans un fichier <code>{BACKUP_EXTENSION}</code> protege par mot de passe.
            </p>

            {/* Avertissements */}
            <div className="text-[12px] leading-snug rounded-lg px-3 py-2.5 space-y-1.5" style={{ background: BRAND.warningBg, color: BRAND.warning, border: `1px solid ${BRAND.warningBorder}` }}>
              <p className="inline-flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" /> <span><strong>Mot de passe perdu = sauvegarde definitivement illisible.</strong> Aucune recuperation possible.</span></p>
              <p className="pl-5">N'utilisez <strong>pas</strong> votre mot de passe de connexion Ploutos.</p>
            </div>

            {/* Saisie */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600">Mot de passe</label>
              <input
                type="password" autoComplete="new-password" value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                className="ploutos-field w-full" placeholder="Mot de passe de la sauvegarde"
              />
              <div className="grid grid-cols-1 gap-1 pt-1">
                {RULES.map((r) => {
                  const ok = ruleSatisfied(r);
                  return (
                    <div key={r} className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: ok ? BRAND.success : BRAND.muted }}>
                      {ok ? <Check className="h-3 w-3" aria-hidden="true" /> : <X className="h-3 w-3" aria-hidden="true" />} {r}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600">Confirmez le mot de passe</label>
              <input
                type="password" autoComplete="new-password" value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) handleSubmit(); }}
                className="ploutos-field w-full" placeholder="Ressaisissez le mot de passe"
              />
              {pw2.length > 0 && !match && (
                <p className="text-[11px] text-red-600">Les deux mots de passe ne correspondent pas.</p>
              )}
            </div>

            {error && (
              <div role="alert" className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5 leading-snug">{error}</div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="text-xs font-bold text-slate-700 border border-[#D8D2C6] bg-white hover:border-[#C4973D] rounded-lg px-3 py-2 transition-colors">Annuler</button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg px-3 py-2 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Chiffrement…</>
                  : <><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Chiffrer et enregistrer</>}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
