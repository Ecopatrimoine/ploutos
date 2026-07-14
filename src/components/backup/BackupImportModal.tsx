// ─── C7 — Modal d'import : restauration d'une sauvegarde chiffree ───────────
//
// Point d'entree unique (header + Parametres). Etapes :
//   1. lecture + validation de l'enveloppe (format + format_version connus) ;
//   2. saisie du mot de passe -> dechiffrement ;
//   3. dedup PAR ID contre les dossiers existants : les nouveaux ids sont
//      importes, les ids deja presents sont IGNORES par defaut et l'ecrasement
//      n'est possible que par choix EXPLICITE, dossier par dossier ;
//   4. rapport final ("X importes, Y ignores car deja presents : [noms]").
//
// L'import N'OUVRE PAS de dossier : il alimente la couche useClients (upsert +
// sync). Si l'utilisateur ouvre ensuite un dossier, c'est par le chemin normal
// (etat reinitialise) — le bug de fuite de l'ancien importDataFile disparait.

import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, AlertTriangle, Loader2, Check, FileWarning } from "lucide-react";
import { SURFACE, BRAND } from "../../constants";
import type { ClientRecord } from "../../useClients";
import { decryptBackup } from "../../lib/backup/crypto";
import { parseBackupFile, BackupError, type BackupFile } from "../../lib/backup/format";

type Props = {
  open: boolean;
  file: File | null;
  existing: ClientRecord[];
  onClose: () => void;
  onImport: (records: ClientRecord[]) => Promise<void>;
};

type Stage = "reading" | "password" | "report" | "importing" | "done" | "error";

type Summary = { imported: number; overwritten: number; ignored: string[] };

// Nom lisible d'un dossier importe (fallback si displayName vide).
function labelOf(r: ClientRecord): string {
  return r.displayName || (r.payload?.clientName as string) || "Dossier sans nom";
}

export default function BackupImportModal({ open, file, existing, onClose, onImport }: Props) {
  const [stage, setStage] = useState<Stage>("reading");
  const [fatal, setFatal] = useState<string>("");   // erreur bloquante (parse/format)
  const [parsed, setParsed] = useState<BackupFile | null>(null);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [decrypted, setDecrypted] = useState<ClientRecord[]>([]);
  const [overwrite, setOverwrite] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<Summary | null>(null);

  // Lecture + validation de l'enveloppe a l'ouverture.
  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    setStage("reading");
    setFatal(""); setParsed(null); setPw(""); setPwError(null); setBusy(false);
    setDecrypted([]); setOverwrite(new Set()); setSummary(null);
    file.text()
      .then((text) => {
        if (cancelled) return;
        try {
          setParsed(parseBackupFile(text));
          setStage("password");
        } catch (e) {
          setFatal(e instanceof BackupError ? e.message : "Fichier illisible.");
          setStage("error");
        }
      })
      .catch(() => { if (!cancelled) { setFatal("Impossible de lire le fichier."); setStage("error"); } });
    return () => { cancelled = true; };
  }, [open, file]);

  const existingIds = useMemo(() => new Set(existing.map((c) => c.id)), [existing]);
  const newRecords = useMemo(() => decrypted.filter((r) => !existingIds.has(r.id)), [decrypted, existingIds]);
  const conflicts = useMemo(() => decrypted.filter((r) => existingIds.has(r.id)), [decrypted, existingIds]);

  const handleDecrypt = async () => {
    if (!parsed || busy) return;
    setBusy(true);
    setPwError(null);
    try {
      const records = await decryptBackup(parsed, pw);
      setDecrypted(records);
      setStage("report");
    } catch (e) {
      setPwError(e instanceof BackupError ? e.message : "Dechiffrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const toggleOverwrite = (id: string) => {
    setOverwrite((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (busy) return;
    setBusy(true);
    setStage("importing");
    // Ecrasement = choix explicite : on re-date le record importe (updatedAt) pour
    // qu'il gagne deterministe la reconciliation de synchro et remplace l'existant.
    const nowIso = new Date().toISOString();
    const chosenOverwrites = conflicts
      .filter((r) => overwrite.has(r.id))
      .map((r) => ({ ...r, updatedAt: nowIso }));
    const finalRecords = [...newRecords, ...chosenOverwrites];
    const ignored = conflicts.filter((r) => !overwrite.has(r.id)).map(labelOf);
    try {
      await onImport(finalRecords);
      setSummary({ imported: finalRecords.length, overwritten: chosenOverwrites.length, ignored });
      setStage("done");
    } catch (e) {
      console.error("Import sauvegarde — echec:", e);
      setFatal("L'import a echoue. Reessayez.");
      setStage("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent aria-describedby="backup-import-desc" className="max-w-lg rounded-2xl" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}>
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2" style={{ color: BRAND.navy }}>
            <Upload className="h-5 w-5" aria-hidden="true" /> Importer une sauvegarde
          </DialogTitle>
        </DialogHeader>

        {/* ── Erreur bloquante ── */}
        {stage === "error" && (
          <div id="backup-import-desc" className="text-sm text-slate-600 leading-relaxed space-y-3">
            <p className="inline-flex items-start gap-2 text-red-700 font-semibold">
              <FileWarning className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" /> {fatal}
            </p>
            <div className="flex justify-end">
              <button onClick={onClose} className="text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg px-3 py-2 transition-colors">Fermer</button>
            </div>
          </div>
        )}

        {/* ── Lecture ── */}
        {stage === "reading" && (
          <div id="backup-import-desc" className="text-sm text-slate-500 inline-flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Lecture du fichier…
          </div>
        )}

        {/* ── Mot de passe ── */}
        {stage === "password" && (
          <div id="backup-import-desc" className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Saisissez le mot de passe de cette sauvegarde{parsed ? <> ({parsed.count} dossier{parsed.count > 1 ? "s" : ""})</> : null}.
            </p>
            <input
              type="password" autoComplete="off" value={pw} autoFocus
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && pw.length > 0 && !busy) handleDecrypt(); }}
              className="ploutos-field w-full" placeholder="Mot de passe de la sauvegarde"
            />
            {pwError && (
              <div role="alert" className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5 leading-snug">{pwError}</div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="text-xs font-bold text-slate-700 border border-[#D8D2C6] bg-white hover:border-[#C4973D] rounded-lg px-3 py-2 transition-colors">Annuler</button>
              <button
                onClick={handleDecrypt}
                disabled={pw.length === 0 || busy}
                className="text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg px-3 py-2 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Dechiffrement…</> : "Dechiffrer"}
              </button>
            </div>
          </div>
        )}

        {/* ── Rapport / choix ── */}
        {stage === "report" && (
          <div id="backup-import-desc" className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              <strong>{newRecords.length}</strong> nouveau{newRecords.length > 1 ? "x" : ""} dossier{newRecords.length > 1 ? "s" : ""} sera importe{newRecords.length > 1 ? "s" : ""}.
            </p>

            {conflicts.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold tracking-wide text-slate-600 inline-flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" style={{ color: BRAND.warning }} aria-hidden="true" />
                  {conflicts.length} dossier{conflicts.length > 1 ? "s" : ""} deja present{conflicts.length > 1 ? "s" : ""}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Ignore{conflicts.length > 1 ? "s" : ""} par defaut. Cochez pour <strong>ecraser</strong> la version existante par celle de la sauvegarde (irreversible).
                </p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {conflicts.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 bg-white border border-[#E8E3D9] rounded-xl px-3 py-2 cursor-pointer">
                      <input type="checkbox" checked={overwrite.has(r.id)} onChange={() => toggleOverwrite(r.id)} className="accent-slate-900" />
                      <span className="text-xs text-slate-700 truncate">{labelOf(r)}</span>
                      {overwrite.has(r.id) && <span className="ml-auto text-[10px] font-bold text-red-600">ECRASER</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="text-xs font-bold text-slate-700 border border-[#D8D2C6] bg-white hover:border-[#C4973D] rounded-lg px-3 py-2 transition-colors">Annuler</button>
              <button
                onClick={handleImport}
                disabled={busy || (newRecords.length === 0 && overwrite.size === 0)}
                className="text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg px-3 py-2 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" /> Importer{overwrite.size > 0 ? ` (dont ${overwrite.size} ecrase${overwrite.size > 1 ? "s" : ""})` : ""}
              </button>
            </div>
          </div>
        )}

        {/* ── Import en cours ── */}
        {stage === "importing" && (
          <div id="backup-import-desc" className="text-sm text-slate-500 inline-flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Import en cours…
          </div>
        )}

        {/* ── Rapport final ── */}
        {stage === "done" && summary && (
          <div id="backup-import-desc" className="text-sm text-slate-600 leading-relaxed space-y-3">
            <p className="inline-flex items-center gap-2 font-semibold text-emerald-700">
              <Check className="h-4 w-4" aria-hidden="true" /> {summary.imported} dossier{summary.imported > 1 ? "s" : ""} importe{summary.imported > 1 ? "s" : ""}
              {summary.overwritten > 0 ? <> (dont {summary.overwritten} ecrase{summary.overwritten > 1 ? "s" : ""})</> : null}.
            </p>
            {summary.ignored.length > 0 && (
              <div className="text-xs text-slate-500 leading-snug">
                {summary.ignored.length} ignore{summary.ignored.length > 1 ? "s" : ""} car deja present{summary.ignored.length > 1 ? "s" : ""} :{" "}
                <span className="text-slate-700">{summary.ignored.join(", ")}</span>
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={onClose} className="text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg px-3 py-2 transition-colors">Fermer</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
