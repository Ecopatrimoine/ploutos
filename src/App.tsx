declare const __ANTHROPIC_KEY__: string;
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, Plus, Trash2, Database, FileText, Settings } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid
} from "recharts";
import { useClients, ClientManager } from "./useClients";
import type { ClientRecord, ClientPayload } from "./useClients";
import { useAuth } from "./hooks/useAuth";
import { useLicense } from "./hooks/useLicense";
import { useAdmin } from "./hooks/useAdmin";
import { AdminDashboard } from "./components/AdminDashboard";
import { LicenceGate } from "./components/LicenceGate";
import { LicenceBanner } from "./components/LicenceBanner";
import { AuthGate } from "./components/AuthGate";
import { LoginTransition } from "./components/LoginTransition";
import { LoanModal } from "./components/LoanModal";
import { HelpMenu } from "./components/HelpMenu";
import { HelpTooltip, Field, MoneyField, MetricCard, BracketFillChart, SectionTitle, DifferenceBadge } from "./components/shared";
import { supabase } from "./lib/supabase";
import { buildAndPrintPdf as _buildAndPrintPdf } from "./lib/pdf/pdfReport";
import { buildAndPrintMission as _buildAndPrintMission } from "./lib/pdf/pdfMission";

// ── Imports modules refactorisés ──────────────────────────────────────────────
import { BRAND, SURFACE, EMPTY_CHARGES_DETAIL, PLACEMENT_TYPES_BY_FAMILY, ALL_PLACEMENTS, PLACEMENT_FAMILIES, PROPERTY_TYPES, PROPERTY_RIGHTS, CHILD_LINKS, CUSTODY_OPTIONS, COUPLE_STATUS_OPTIONS, MATRIMONIAL_OPTIONS, CHART_COLORS, RECEIVED_COLORS, LEGUE_COLORS, TESTAMENT_RELATION_OPTIONS, BENEFICIARY_RELATION_OPTIONS, PCS_GROUPES, PCS_CATEGORIES, SEUIL_MICRO_BA } from "./constants";
import type {
  Child, Property, Placement, PatrimonialData, IrOptions,
  SuccessionData, Heir, TestamentHeir, LegsPrecisItem,
  DemembrementContrepartie, OtherLoan, PERRente, Hypothesis,
  BaseSnapshot, ChargesDetail,
  Beneficiary, DifferenceLine
} from "./types/patrimoine";
import { n, euro, deepClone, isAV, isPERType, getDemembrementPercentages, computeTaxFromBrackets,
  personLabel, fractionRVTO, childMatchesDeceased, getAgeFromBirthDate, buildCollectedHeirs,
  getFamilyBeneficiaries, isSpouseHeirEligible, getAvailableSpouseOptions, computeKilometricAllowance,
  isIndependant, isProfessionLiberale, isRetraite, isSansActivite, isFonctionnaire,
  getGroupeLabel, getCategorieLabel, sumChargesDetail, getBaseFiscalParts, getChildrenFiscalParts,
  placementFiscalSummary, placementNeedsTaxableIncome, placementNeedsDeathValue, placementNeedsOpenDate,
  placementNeedsPFU, isCashPlacement, propertyNeedsRent, propertyNeedsPropertyTax, propertyNeedsInsurance,
  propertyNeedsWorks, propertyNeedsLoan, safeFilePart, buildExportFileName
} from "./lib/calculs/utils";
import { resolveLoanValues, resolveLoanValuesMulti, resolveOneLoan, calcMonthlyPayment } from "./lib/calculs/credit";
import type { Loan } from "./types/patrimoine";
import { computeIR } from "./lib/calculs/ir";
import { computeIFI } from "./lib/calculs/ifi";
import { computeSuccession } from "./lib/calculs/succession";
import { buildHypothesisDifferenceLines } from "./lib/hypotheses";
import { runSelfChecks } from "./lib/selfChecks";

// ── Composants onglets (React.memo — re-render uniquement si leurs données changent) ──
import { TabFamiliale } from "./components/tabs/TabFamiliale";
import { TabTravail } from "./components/tabs/TabTravail";
import { TabRevenus } from "./components/tabs/TabRevenus";
import { TabImmobilier } from "./components/tabs/TabImmobilier";
import { TabPlacements } from "./components/tabs/TabPlacements";
import { TabCredits } from "./components/tabs/TabCredits";
import { TabIR } from "./components/tabs/TabIR";
import { TabIFI } from "./components/tabs/TabIFI";
import { TabSuccession } from "./components/tabs/TabSuccession";
import { TabHypotheses } from "./components/tabs/TabHypotheses";
import { TabMission } from "./components/tabs/TabMission";
import { TabParametres } from "./components/tabs/TabParametres";

// ─── APP ──────────────────────────────────────────────────────────────────────

// Logo chargé dynamiquement — remplacez ce placeholder par votre fichier PNG via l'interface
const DEFAULT_LOGO_SRC = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUxIiBoZWlnaHQ9IjI3NiIgdmlld0JveD0iMCAwIDI1MSAyNzYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF8xNjdfMTA0KSI+CjxwYXRoIGQ9Ik0xMDAuMjMgMjIwLjA4Qzg5LjAyMDEgMjIwLjA4IDc5LjYzMDEgMjE0Ljg3IDc0LjQ2MDEgMjA1Ljc5QzY1LjcxMDEgMTkwLjQxIDc0LjYzMDEgMTc3LjI4IDgxLjgwMDEgMTY2LjcyQzg2Ljk2MDEgMTU5LjEyIDkyLjgxMDEgMTUwLjUxIDk1LjkwMDEgMTM4LjU3Qzk3LjgwMDEgMTMxLjIyIDk3LjY0MDEgMTE3LjYxIDk2LjA4MDEgMTE5LjgyQzkzLjE0MDEgMTIzLjk4IDg3LjY2MDEgMTMxLjczIDc3LjMwMDEgMTMxLjczQzc0LjgzMDEgMTMxLjczIDcyLjM2MDEgMTMxLjI1IDY5Ljk1MDEgMTMwLjMxQzYyLjcyMDEgMTI3LjQ4IDU4Ljg0MDEgMTE5LjYxIDYwLjk4MDEgMTEyLjE2QzY0Ljc2MDEgOTkuMDIwMSA3NC44MDAxIDY0LjEyIDExMC43NyA2NC4wM0MxMTAuNzcgNjQuMDMgMjA2LjUgNjMuOCAyMDYuNTEgNjMuOEMyMTIuMjggNjMuOCAyMTcuNyA2Ny4xMTAxIDIyMC4yNCA3Mi42OTAxQzIyMS4yIDc0Ljc5MDEgMjIxLjU2IDc3LjEyMDEgMjIxLjU0IDc5LjQzTDIyMS4zNCA5OC4xN0MyMjEuMjUgMTA2LjMyIDIxNC42OSAxMTIuOTEgMjA2LjU0IDExMy4wNEwxOTAuMiAxMTMuMjlDMTg5Ljg0IDExMy4yOSAxODkuNTUgMTEzLjU3IDE4OS41MyAxMTMuOTNMMTg3LjAyIDE1Mi4xOEMxODYuNzQgMTU2LjUxIDE4OC45NiAxNjEuMTYgMTkwLjY3IDE1OC45OUMxOTMuODIgMTU0Ljk5IDE5OC43OSAxNTIuNiAyMDMuOTYgMTUyLjZDMjA5LjkyIDE1Mi42IDIxNS40IDE1NS42NyAyMTguNjEgMTYwLjgyQzIyNS4yMiAxNzEuNDEgMjE5LjYgMTg2LjA0IDIxMy45NiAxOTcuNjFDMjA3LjA1IDIxMS43NyAxOTMuMTMgMjIwLjIzIDE3Ni43MSAyMjAuMjNDMTc2LjcxIDIyMC4yMyAxMDIuMzkgMjIwLjEgMTAwLjI0IDIyMC4xTDEwMC4yMyAyMjAuMDhaIiBmaWxsPSIjMTAxQjNCIi8+CjxwYXRoIGQ9Ik0xNTYuNDkgMTAxLjM1QzE0Ny4yNSA5OS41OSAxMzguOTUgMTAwLjUyIDEyOS42NCAxMDAuODVDMTI3LjYyIDEyNi41OSAxMjUuOTEgMTY4LjU1IDExNy4zNSAxOTAuOTFDMTE1LjIxIDE5Ni41IDExMC45NyAyMDAuNDUgMTA2LjMxIDIwMS4yNEMxMDAgMjAyLjMxIDkzLjcxIDIwMC45NiA5MC40NiAxOTUuMjVDODMuMTUgMTgyLjQxIDEwNC41NiAxNzEuNTggMTEyLjEzIDE0Mi4zMUMxMTUuNjUgMTI4LjcgMTE3LjIyIDExNS4zOSAxMTguMTIgMTAxLjI4Qzg2LjAzIDk1LjMyIDg4LjU3IDEyMS40NSA3OS4wMyAxMTcuNzJDODQuMDMgMTAwLjMzIDkxLjkxIDgyLjU3IDExMi40NiA4Mi41MkwyMDIuOSA4Mi4zTDIwMi43IDEwMC40MkwxNzMuNTcgMTAwLjg2TDE3MC4zIDE1MC42N0MxNjkuNzggMTU4LjUyIDE2OS44NiAxNjYuNSAxNzIuMTMgMTc0LjAyQzE3NC4wMyAxODAuMzIgMTgwLjQ2IDE4Mi4zNCAxODYuMyAxODEuODdDMTk3LjU0IDE4MC45NiAxOTguNjcgMTY2LjcyIDE5OC44OSAxNjcuNjNDMTk4LjI4IDE2NS4xMiAyMDkuNSAxNjMuMDIgMTk3LjE3IDE4OC4zMUMxOTIuNzQgMTk3LjM5IDE4NC4yMSAyMDEuODQgMTc0LjMgMjAxLjdDMTU5Ljk5IDIwMS41MSAxNTAuMzcgMTkxIDE1MC42NCAxNzYuNEMxNTEuMDkgMTUxLjY1IDE1NC41MSAxMjcuODcgMTU2LjUxIDEwMS4zNkwxNTYuNDkgMTAxLjM1WiIgZmlsbD0iI0Y4RjZGNyIvPgo8cGF0aCBkPSJNMTE0Ljk5IDI2Mi45OEM4NC4wNCAyNTcuMSA1Ni43NiAyNDAuMTkgMzcuNjggMjE0Ljg2QzE3LjM0IDE4Ny44NyA4LjczMDAyIDE1NC41NyAxMy40MyAxMjEuMUMxOC4xMyA4Ny42MyAzNS41OSA1OCA2Mi41OCAzNy42NUM4OC4zMSAxOC4yNiAxMTkuNzcgOS41Mzk5NiAxNTEuNjUgMTIuODRDMTUzLjIxIDEzIDE1NC43OCAxMy4xOCAxNTYuMzQgMTMuNEMxODkuODEgMTguMSAyMTkuNDQgMzUuNTYgMjM5Ljc5IDYyLjU1TDI0Ny43MiA1Ni41OEMyMjUuMDQgMjYuNDkgMTkyLjMxIDguNDI5OTYgMTU3LjczIDMuNTY5OTZDMTU2LjE3IDMuMzQ5OTYgMTU0LjYxIDMuMTY5OTYgMTUzLjA0IDIuOTk5OTZDMTE5Ljg2IC0wLjUwMDA0NSA4NS4zNCA4LjA2OTk2IDU2LjYgMjkuNzJDLTMuNTg5OTggNzUuMDggLTE1LjYxIDE2MC42NCAyOS43NCAyMjAuODNDNTEuMDcgMjQ5LjE0IDgxLjMxIDI2Ni43OCAxMTMuNjEgMjcyLjgyTDExNC45OCAyNjIuOThIMTE0Ljk5WiIgZmlsbD0iIzEwMUIzQiIvPgo8cGF0aCBkPSJNNDAuNyAyMzYuODRDMzYuMTQgMjMyLjI4IDMxLjg4IDIyNy4zOCAyNy45NSAyMjIuMTdDNS42NjAwMSAxOTIuNTkgLTMuNzc5OTkgMTU2LjA5IDEuMzgwMDEgMTE5LjRDNi41MzAwMSA4Mi43MSAyNS42NyA1MC4yMyA1NS4yNSAyNy45M0M4My40MSA2LjcyMDAxIDExOC4yMSAtMi45Mjk5OSAxNTMuMjYgMC43ODAwMTRDMTU1LjA3IDAuOTcwMDE0IDE1Ni41OSAxLjE1MDAxIDE1OC4wMyAxLjM2MDAxQzE5NC43MiA2LjUyMDAxIDIyNy4yIDI1LjY1IDI0OS41IDU1LjI0TDI1MC44NSA1Ny4wM0wyMzkuMzUgNjUuN0wyMzggNjMuOTFDMjE4LjAyIDM3LjQgMTg4LjkxIDIwLjI1IDE1Ni4wMyAxNS42M0MxNTQuNjUgMTUuNDQgMTUzLjE0IDE1LjI1IDE1MS40MiAxNS4wOEMxMjAuMTUgMTEuODQgODkuMDggMjAuNSA2My45MyAzOS40NUMzNy40MiA1OS40MyAyMC4yNyA4OC41NCAxNS42NSAxMjEuNDJDMTEuMDMgMTU0LjMgMTkuNDkgMTg3LjAxIDM5LjQ3IDIxMy41MkM1OC4xIDIzOC4yNCA4NS4wNyAyNTUuMDMgMTE1LjQxIDI2MC43OUwxMTcuNTEgMjYxLjE5TDExNS41MiAyNzUuNDZMMTEzLjIxIDI3NS4wM0M4NS41MyAyNjkuODUgNjAuMzcgMjU2LjUxIDQwLjcxIDIzNi44Nkw0MC43IDIzNi44NFpNMjMzLjQ1IDQzLjU4QzIxMi45OSAyMy4xMiAxODYuNTcgOS44OTAwMSAxNTcuNCA1Ljc5MDAxQzE1Ni4wMSA1LjYwMDAxIDE1NC41NSA1LjQyMDAxIDE1Mi43OSA1LjIzMDAxQzExOC44NyAxLjY1MDAxIDg1LjE5IDEwLjk4IDU3Ljk1IDMxLjUxQzI5LjMyIDUzLjA5IDEwLjggODQuNTIgNS44MTAwMSAxMjAuMDJDMC44MjAwMDkgMTU1LjUyIDkuOTUwMDEgMTkwLjg0IDMxLjUzIDIxOS40N0M1MS4yNiAyNDUuNjUgNzkuNjYgMjYzLjU4IDExMS43MiAyNzAuMTVMMTEyLjQ3IDI2NC43NUM4MS44OCAyNTguNDIgNTQuNzUgMjQxLjIzIDM1Ljg4IDIxNi4xOUMxNS4xOCAxODguNzIgNi40MjAwMSAxNTQuODMgMTEuMiAxMjAuNzdDMTUuOTkgODYuNzEgMzMuNzUgNTYuNTUgNjEuMjIgMzUuODVDODcuMjggMTYuMjEgMTE5LjQ3IDcuMjUwMDEgMTUxLjg3IDEwLjZDMTUzLjY1IDEwLjc4IDE1NS4yMSAxMC45NyAxNTYuNjUgMTEuMTdDMTg5Ljk3IDE1Ljg1IDIxOS41NiAzMi45NSAyNDAuMjEgNTkuNDJMMjQ0LjU2IDU2LjE0QzI0MS4wOSA1MS42OSAyMzcuMzggNDcuNSAyMzMuNDYgNDMuNTdMMjMzLjQ1IDQzLjU4WiIgZmlsbD0iIzEwMUIzQiIvPgo8cGF0aCBkPSJNMjA2LjczIDQ5LjQ5OTlDMjE5LjI4OSA0OS40OTk5IDIyOS40NyAzOS4zMTg5IDIyOS40NyAyNi43NTk5QzIyOS40NyAxNC4yMDA5IDIxOS4yODkgNC4wMTk5IDIwNi43MyA0LjAxOTlDMTk0LjE3MSA0LjAxOTkgMTgzLjk5IDE0LjIwMDkgMTgzLjk5IDI2Ljc1OTlDMTgzLjk5IDM5LjMxODkgMTk0LjE3MSA0OS40OTk5IDIwNi43MyA0OS40OTk5WiIgZmlsbD0iI0UzQUY2NCIvPgo8cGF0aCBkPSJNMjI0LjI2IDkuMTk5OTVMMjE3LjkyIDE1LjUzOTlDMjIxLjQ4IDE5LjA5OTkgMjIzLjEyIDIzLjk4OTkgMjIyLjQyIDI4Ljk1OTlDMjIxLjIgMzcuNjA5OSAyMTMuMTcgNDMuNjYgMjA0LjUyIDQyLjQ1QzIwMS4wOCA0MS45NyAxOTcuOTggNDAuNDE5OSAxOTUuNTMgMzcuOTc5OUMxOTEuOTcgMzQuNDE5OSAxOTAuMzMgMjkuNTI5OSAxOTEuMDMgMjQuNTQ5OUMxOTIuMjUgMTUuODk5OSAyMDAuMjggOS44NDk5NSAyMDguOTMgMTEuMDU5OUMyMTIuMzcgMTEuNTM5OSAyMTUuNDcgMTMuMDg5OSAyMTcuOTIgMTUuNTI5OUwyMjQuMjYgOS4xODk5NU0yMjQuMjYgOS4xOTk5NUMyMjAuNTggNS41MTk5NSAyMTUuNzMgMi45Njk5NSAyMTAuMTggMi4xODk5NUMxOTYuNjEgMC4yNzk5NDkgMTg0LjA2IDkuNzM5OTUgMTgyLjE2IDIzLjMwOTlDMTgxLjAzIDMxLjMzOTkgMTgzLjg4IDM5IDE4OS4yIDQ0LjMyQzE5Mi44OCA0OCAxOTcuNzMgNTAuNTUgMjAzLjI4IDUxLjMzQzIxNi44NSA1My4yNCAyMjkuNCA0My43Nzk5IDIzMS4zIDMwLjIwOTlDMjMyLjQzIDIyLjE3OTkgMjI5LjU4IDE0LjUxOTkgMjI0LjI2IDkuMTk5OTVaIiBmaWxsPSIjMTAxQjNCIi8+CjwvZz4KPGRlZnM+CjxjbGlwUGF0aCBpZD0iY2xpcDBfMTY3XzEwNCI+CjxyZWN0IHdpZHRoPSIyNTAuODUiIGhlaWdodD0iMjc1LjQ1IiBmaWxsPSJ3aGl0ZSIvPgo8L2NsaXBQYXRoPgo8L2RlZnM+Cjwvc3ZnPgo=";


// ─── CABINET SETTINGS PERSISTENCE ────────────────────────────────────────────

const _isElectron = typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;
const _eAPI = _isElectron ? (window as any).electronAPI : null;

// Clé localStorage liée à l'utilisateur — isolation complète entre comptes
function getCabinetKey(userId: string) {
  return userId ? `ploutos_cabinet_${userId}` : "ploutos_cabinet";
}

// Pas de migration automatique depuis les anciennes clés génériques :
// Supabase est la source de vérité — chaque utilisateur charge ses données depuis Supabase au login.
// Une migration locale contaminerait les nouveaux comptes avec les données d'autres utilisateurs.
function migrateCabinetForUser(_userId: string) {
  // Intentionnellement vide — migration supprimée
}

// Lit le cabinet depuis localStorage — retourne null si absent ou invalide
function loadCabinetFromStorage(userId: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(getCabinetKey(userId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data === "object" && data !== null && (data.nom !== undefined || data.colorNavy !== undefined)) {
      return data;
    }
    return null;
  } catch { return null; }
}

// Charge le cabinet avec stratégie multi-couches :
// 1. Fichier Electron (si dispo) — le plus à jour en local
// 2. localStorage — toujours synchronisé à chaque sauvegarde
// 3. null — premier lancement
async function loadCabinetAsync(userId: string): Promise<Record<string, string> | null> {
  if (_isElectron && _eAPI?.readCabinet) {
    try {
      const data = await _eAPI.readCabinet();
      if (data && typeof data === "object" && (data.nom !== undefined || data.colorNavy !== undefined)) {
        try { localStorage.setItem(getCabinetKey(userId), JSON.stringify(data)); } catch {}
        return data;
      }
      console.warn("[Ploutos] cabinet.json vide ou invalide, fallback localStorage");
    } catch (e) {
      console.warn("[Ploutos] readCabinet() échoué:", e, "— fallback localStorage");
    }
  }
  return loadCabinetFromStorage(userId);
}

// Charge les paramètres cabinet depuis Supabase (multi-appareils)
// Merge avec les données locales : Supabase gagne sauf pour logoSrc/signatureSrc (stockés local only)
async function loadCabinetFromSupabase(userId: string): Promise<Record<string, string> | null> {
  try {
    const { data, error } = await supabase
      .from("cabinet_settings")
      .select("settings")
      .eq("user_id", userId)
      .single();
    if (error || !data?.settings) return null;
    return data.settings as Record<string, string>;
  } catch { return null; }
}

// Sauvegarde triple : localStorage + fichier Electron + Supabase
// Si l'un échoue, les deux autres sont intacts — données jamais perdues
async function saveCabinetAsync(data: Record<string, string>, userId?: string) {
  // Toujours horodater pour le merge multi-appareils
  const ts = new Date().toISOString();
  const dataWithTs: Record<string, string> = { ...data, updatedAt: ts };
  // Normaliser nom ↔ cabinetName avant sauvegarde
  if (!dataWithTs.cabinetName && dataWithTs.nom) dataWithTs.cabinetName = dataWithTs.nom;
  if (!dataWithTs.nom && dataWithTs.cabinetName) dataWithTs.nom = dataWithTs.cabinetName;

  // 1. localStorage (synchrone, toujours disponible)
  try { localStorage.setItem(getCabinetKey(userId || ""), JSON.stringify(dataWithTs)); } catch {}
  // 2. Fichier Electron
  if (_isElectron && _eAPI?.writeCabinet) {
    try { await _eAPI.writeCabinet(dataWithTs); } catch (e) {
      console.warn("[Ploutos] writeCabinet() échoué:", e);
    }
  }
  // 3. Supabase (multi-appareils, multi-versions)
  if (userId) {
    try {
      // logoSrc et signatureSrc sont trop volumineux pour Supabase — on les garde local only
      const { logoSrc: _l, signatureSrc: _s, ...dataWithoutImages } = dataWithTs as any;
      await supabase.from("cabinet_settings").upsert(
        { user_id: userId, settings: dataWithoutImages, updated_at: ts },
        { onConflict: "user_id" }
      );
    } catch (e) { console.warn("[Ploutos] Supabase cabinet sync échoué:", e); }
  }
}

const DEFAULT_CABINET = {
  nom: "",
  forme: "",
  rcs: "",
  villeRcs: "",
  adresse: "",
  codePostal: "",
  ville: "",
  tel: "",
  email: "",
  conseiller: "",
  orias: "",
  rcpAssureur: "",
  rcpContrat: "",
  mediateur: "",
  mediateurUrl: "",
  mediateurAdresse: "",
  partenaires: "",
  colorNavy: "#101B3B",
  colorSky: "#26428B",
  colorBlue: "#516AC7",
  colorGold: "#E3AF64",
  colorCream: "#FBECD7",
  logoSrc: "",
  signatureSrc: "",
  cabinetName: "",
};

function AppInner({ userId, userEmail, authState, onSignOut }: { userId: string; userEmail: string; authState: string; onSignOut: () => void }) {
  const { licence } = useLicense(userId || null);
  const { isAdmin } = useAdmin(userEmail || null);
  const [showAdmin, setShowAdmin] = useState(false);
  // ── Logo cabinet : initialisé synchroniquement pour éviter le flash du logo Ploutos
  const [logoSrc, setLogoSrc] = useState(() => {
    migrateCabinetForUser(userId);
    const saved = loadCabinetFromStorage(userId);
    return (saved?.logoSrc as string) || DEFAULT_LOGO_SRC;
  });

  // Charger le logo depuis Electron ou localStorage (multi-couches)
  useEffect(() => {
    loadCabinetAsync(userId).then(saved => {
      const sl = saved?.logoSrc as string;
      if (sl && sl.startsWith("data:")) setLogoSrc(sl);
    });
  }, [userId]);



  const [cabinet, setCabinet] = useState(() => {
    const saved = loadCabinetFromStorage(userId);
    if (saved) {
      const base = { ...DEFAULT_CABINET, ...saved };
      // Normaliser nom ↔ cabinetName (un seul des deux peut être rempli selon la version)
      if (!base.cabinetName && base.nom) base.cabinetName = base.nom;
      if (!base.nom && base.cabinetName) base.nom = base.cabinetName;
      return base;
    }
    // Premier lancement : état vide — Supabase sera chargé dans le useEffect
    return { ...DEFAULT_CABINET };
  });

  // Charger le cabinet au démarrage : local d'abord, puis Supabase (merge par timestamp)
  useEffect(() => {
    // Helper normalisation nom <-> cabinetName
    const normalize = (base: Record<string, string>): Record<string, string> => {
      if (!base.cabinetName && base.nom) base.cabinetName = base.nom;
      if (!base.nom && base.cabinetName) base.nom = base.cabinetName;
      return base;
    };

    // 1. Charger local immédiatement
    loadCabinetAsync(userId).then(localData => {
      if (localData) setCabinet(prev => normalize({ ...DEFAULT_CABINET, ...prev, ...localData }) as typeof DEFAULT_CABINET);
    });

    // 2. Charger Supabase si connecté — merge par timestamp (le plus récent gagne)
    if (userId) {
      loadCabinetFromSupabase(userId).then(remoteData => {
        if (!remoteData) return;
        setCabinet(prev => {
          const localTs  = (prev as any).updatedAt  ? new Date((prev as any).updatedAt).getTime()  : 0;
          const remoteTs = (remoteData as any).updatedAt ? new Date((remoteData as any).updatedAt).getTime() : 0;

          // Le plus récent gagne — Supabase gagne en cas d'égalité
          const winner = remoteTs >= localTs ? remoteData : prev;
          const loser  = remoteTs >= localTs ? prev      : remoteData;
          const merged = normalize({ ...DEFAULT_CABINET, ...loser, ...winner } as Record<string, string>);

          // Logo et signature : toujours local only (trop volumineux pour Supabase)
          merged.logoSrc      = (prev as any).logoSrc      || "";
          merged.signatureSrc = (prev as any).signatureSrc || "";

          // Sauvegarder localement le merge
          try { localStorage.setItem(getCabinetKey(userId), JSON.stringify(merged)); } catch {}
          if (_isElectron && _eAPI?.writeCabinet) _eAPI.writeCabinet(merged).catch(() => {});

          return merged as typeof DEFAULT_CABINET;
        });
      });
    }
  }, [userId]);

  const updateCabinet = (key: keyof typeof cabinet, val: string) => {
    setCabinet(prev => {
      const next = { ...prev, [key]: val };
      // Synchroniser nom <-> cabinetName automatiquement
      if (key === "nom") (next as any).cabinetName = val;
      if (key === "cabinetName") (next as any).nom = val;
      saveCabinetAsync(next as Record<string, string>, userId);
      return next;
    });
  };
  const { clients, syncStatus, syncNow, createClient, saveClient, deleteClient, duplicateClient, renameClient } = useClients(userId, authState)
  const [activeClient, setActiveClient] = useState<ClientRecord | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  // Couleurs dynamiques tirées des paramètres cabinet
  const CAB = {
    navy: cabinet.colorNavy,
    sky: cabinet.colorSky,
    blue: cabinet.colorBlue,
    gold: cabinet.colorGold,
    cream: cabinet.colorCream,
  };
  const [signatureSrc, setSignatureSrc] = useState<string>("");
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { if (ev.target?.result) setSignatureSrc(ev.target.result as string); };
    reader.readAsDataURL(file);
  };

  // ── Données mission ──
  const [mission, setMission] = useState({
    // Besoins
    besoinSante_depenses: false, besoinSante_hospit: false, besoinSante_depasse: false, besoinSante_surcompl: false,
    besoinPrev_arret: false, besoinPrev_deces: false, besoinPrev_fraisGen: false,
    besoinRetraite_capital: false, besoinRetraite_rente: false, besoinRetraite_moderniser: false,
    besoinEpargne_valoriser: false, besoinEpargne_transmettre: false, besoinEpargne_completer: false, besoinEpargne_projet: false,
    // Rémunération
    remuHonoraire: false, remuCommission: true, remuMixte: false, remuHonoraireMontant: "",
    // Profil investisseur — attitude
    attitude: 0 as 0|8|12|18,
    reactionBaisse: 0 as 0|6|12|18,
    // Profil investisseur — pertes/gains
    aSubiPertes: false, ampleurPertes: "" as ""|-5|-10|-20|-99,
    reactionPertes: 0 as 0|1|2|3,
    aRealiseGains: false, ampleurGains: "" as ""|5|10|20|99,
    reactionGains: 0 as 0|1|2|3,
    modeGestion: "" as ""|"pilote"|"libre",
    // Connaissances financières — tableau
    connaitFondsEuros: false, investiFondsEuros: false,
    connaitActions: false, investiActions: false,
    connaitOPCVM: false, investiOPCVM: false,
    connaitImmo: false, investiImmo: false,
    connaitTrackers: false, investiTrackers: false,
    connaitStructures: false, investiStructures: false,
    // Connaissances financières — questions theorie
    savoirUCRisque: false, savoirHorizonUC: false, savoirRisqueRendement: false,
    // Horizon
    horizon: "" as ""| "0-4" | "5-8" | "9-15" | "15+",
    // Obligations fiscales
    residenceFranceIR: true, residenceFranceIFI: false,
    nationaliteUS: false, residentFiscalUS: false,
    ppe: false, ppeDetails: "",
    // Lieu signature
    lieuSignature: "Perpignan",
  });
  const updateMission = (key: keyof typeof mission, val: unknown) => setMission(prev => ({ ...prev, [key]: val }));
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        const newLogo = ev.target.result as string;
        setLogoSrc(newLogo);
        // Persister le logo avec les paramètres cabinet
        saveCabinetAsync({ ...cabinet, logoSrc: newLogo } as Record<string, string>, userId);
      }
    };
    reader.readAsDataURL(file);
  };
  const [clientName, setClientName] = useState("Client");
  const [notes, setNotes] = useState("");
  const [placementFamily, setPlacementFamily] = useState("cash");
  const [data, setData] = useState<PatrimonialData>({
    person1FirstName: "", person1LastName: "", person1BirthDate: "", person1JobTitle: "", person1Csp: "", person1PcsGroupe: "5",
    person2FirstName: "", person2LastName: "", person2BirthDate: "", person2JobTitle: "", person2Csp: "", person2PcsGroupe: "5",
    coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
    person1Handicap: false, person2Handicap: false,
    childrenData: [], salary1: "", salary2: "", pensions: "", pensions1: "", pensions2: "", csgDeductibleFoncier: "",
    perDeduction: "", pensionDeductible: "", otherDeductible: "", perRentes: [],
    ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "", chargesDetail1: {...EMPTY_CHARGES_DETAIL},
    ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "", chargesDetail2: {...EMPTY_CHARGES_DETAIL},
    properties: [], placements: [], otherLoans: [],
  });
  const [successionData, setSuccessionData] = useState<SuccessionData>({
    deceasedPerson: "person1", spousePresent: true, spouseOption: "legal_quarter_full",
    useTestament: false, legsMode: "global", heirs: [], testamentHeirs: [], legsPrecisItems: [],
  });
  const [irOptions, setIrOptions] = useState<IrOptions>({
    expenseMode1: "standard", expenseMode2: "standard",
    km1: "", km2: "", cv1: "", cv2: "",
    mealCount1: "", mealCount2: "", mealUnit1: "5.35", mealUnit2: "5.35",
    other1: "", other2: "", foncierRegime: "micro",
  });
  // Concubinage : quelle personne afficher dans l'onglet IR
  const [concubinPerson, setConcubinPerson] = useState<1 | 2>(1);
  // Picker famille pour les legs
  const [legsPickerOpen, setLegsPickerOpen] = useState<"global" | "precis" | null>(null);
  const [loanModalIndex, setLoanModalIndex] = useState<number | null>(null); // index du bien dont on édite les crédits
  const [exportStatus, setExportStatus] = useState("");
  const [exportFallbackOpen, setExportFallbackOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfMissionModalOpen, setPdfMissionModalOpen] = useState(false);
  const [pdfSections, setPdfSections] = useState({
    cabinet: true, famille: true, travail: true, bilan: true,
    ir: true, ifi: true, succession: true, hypos: true, mentions: true,
  });
  const [pdfMissionSections, setPdfMissionSections] = useState({
    legal: true, famille: true, travail: true, besoins: true,
    bilan: true, ir: true, ifi: true, succession: true, profil: true, signature: true,
  });
  // Dialog détail charges
  const [chargesDialogOpen, setChargesDialogOpen] = useState<1|2|null>(null);
  const [chargesPdfLoading, setChargesPdfLoading] = useState(false);
  const [exportFallbackContent, setExportFallbackContent] = useState("");
  const [exportFallbackFileName, setExportFallbackFileName] = useState("");
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([
    { id: 1, name: "Hypothèse 1", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
    { id: 2, name: "Hypothèse 2", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
    { id: 3, name: "Hypothèse 3", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
  ]);
  const [baseSnapshot, setBaseSnapshot] = useState<BaseSnapshot>({ savedAt: null, data: null, successionData: null, irOptions: null });

  // ── Autosave ──
  useEffect(() => {
    if (!activeClient) return;
    setAutoSaveStatus("saving");
    const timer = setTimeout(() => {
      const payload = {
        clientName, notes, data, irOptions, successionData, hypotheses, baseSnapshot, mission,
      };
      const displayName = clientName || activeClient.displayName;
      saveClient(activeClient.id, payload as ClientPayload, displayName);
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2500);
    }, 1500);
    return () => clearTimeout(timer);
  }, [data, clientName, notes, irOptions, successionData, hypotheses, baseSnapshot, mission, activeClient]);

  const person1 = personLabel(data, 1);
  const person2 = personLabel(data, 2);

  // Résout la quotité DC effective selon le propriétaire et la personne ciblée
  const resolveInsuranceRate = (property: Property, target?: "person1" | "person2"): number => {
    if (!property.loanInsurance) return 0;
    const isMulti = property.ownership === "common" || property.ownership === "indivision";
    if (!isMulti) return Math.min(100, Math.max(0, n(property.loanInsuranceRate)));
    if (target === "person1") return Math.min(100, Math.max(0, n(property.loanInsuranceRate1)));
    if (target === "person2") return Math.min(100, Math.max(0, n(property.loanInsuranceRate2)));
    // Total : somme des deux quotités (pour calcul prime)
    return Math.min(200, Math.max(0, n(property.loanInsuranceRate1) + n(property.loanInsuranceRate2)));
  };

  // ownerOptions inclut les enfants comme titulaires possibles
  const childOwnerOptions = data.childrenData
    .filter(c => c.firstName || c.lastName)
    .map((c, i) => ({
      value: `child_${i}`,
      label: `${c.firstName || ""} ${c.lastName || ""}`.trim() || `Enfant ${i + 1}`,
    }));
  const ownerOptions = [
    { value: "person1", label: person1 },
    { value: "person2", label: person2 },
    { value: "common", label: "Communauté" },
    { value: "indivision", label: "Indivision" },
    ...childOwnerOptions,
  ];

  // ── Setters ──
  const setField = useCallback(<K extends keyof PatrimonialData>(key: K, value: PatrimonialData[K]) =>
    setData((prev) => ({ ...prev, [key]: value })), []);

  // Met à jour une ligne du détail charges et recalcule le total automatiquement
  const setChargesDetailField = useCallback((person: 1 | 2, field: keyof ChargesDetail, value: string) => {
    setData((prev) => {
      const detailKey = (person === 1 ? "chargesDetail1" : "chargesDetail2") as keyof PatrimonialData;
      const totalKey  = (person === 1 ? "chargesReelles1" : "chargesReelles2") as keyof PatrimonialData;
      const newDetail = { ...(prev[detailKey] as ChargesDetail), [field]: value };
      const newTotal  = sumChargesDetail(newDetail);
      return { ...prev, [detailKey]: newDetail, [totalKey]: newTotal > 0 ? String(Math.round(newTotal)) : "" };
    });
  }, []);

  const addChild = useCallback(() => setData((prev) => ({ ...prev, childrenData: [...prev.childrenData, { firstName: "", lastName: "", birthDate: "", parentLink: "common_child", custody: "full", rattached: true, handicap: false, schoolLevel: "" }] })), []);
  const updateChild = useCallback((index: number, key: keyof Child, value: string | boolean) =>
    setData((prev) => ({ ...prev, childrenData: prev.childrenData.map((c, i) => i === index ? { ...c, [key]: value } : c) })), []);
  const removeChild = useCallback((index: number) =>
    setData((prev) => ({ ...prev, childrenData: prev.childrenData.filter((_, i) => i !== index) })), []);

  const addProperty = useCallback((type: string) => setData((prev) => ({
    ...prev,
    properties: [...prev.properties, { name: "", type, ownership: "person1", propertyRight: "full", usufructAge: "", value: "", propertyTaxAnnual: "", rentGrossAnnual: "", insuranceAnnual: "", worksAnnual: "", otherChargesAnnual: "", loanEnabled: false, loanType: "amortissable", loanAmount: "", loanRate: "", loanDuration: "", loanStartDate: "", loanCapitalRemaining: "", loanInterestAnnual: "", loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc", loanInsuranceRate: "", loanInsuranceRate1: "", loanInsuranceRate2: "", loanInsurancePremium: "", loanInsuranceCoverage: "banque", indivisionShare1: "", indivisionShare2: "" }],
  })), []);
  const updateProperty = useCallback((index: number, key: keyof Property, value: string | boolean | Loan[]) =>
    setData((prev) => ({ ...prev, properties: prev.properties.map((p, i) => i === index ? { ...p, [key]: value } : p) })), []);
  const removeProperty = useCallback((index: number) =>
    setData((prev) => ({ ...prev, properties: prev.properties.filter((_, i) => i !== index) })), []);

  // ── CRUD Loans (multi-crédits) ──
  const generateLoanId = () => `loan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const emptyLoan = (): Loan => ({
    id: generateLoanId(), type: "amortissable", label: "Prêt principal",
    amount: "", rate: "", duration: "", startDate: "",
    capitalRemaining: "", interestAnnual: "",
    pledgedPlacementIndex: "-1",
    insurance: false, insuranceGuarantees: "dc",
    insuranceRate: "", insuranceRate1: "", insuranceRate2: "",
    insurancePremium: "", insuranceCoverage: "banque",
  });
  const addLoan = useCallback((propertyIndex: number) => {
    setData((prev) => ({
      ...prev, properties: prev.properties.map((p, i) => {
        if (i !== propertyIndex) return p;
        const loans = p.loans || [];
        const newLoan = emptyLoan();
        if (loans.length === 0) newLoan.label = "Prêt principal";
        else if (newLoan.type === "ptz" || loans.some(l => l.type === "ptz")) newLoan.label = "PTZ";
        else newLoan.label = `Prêt ${loans.length + 1}`;
        return { ...p, loans: [...loans, newLoan] };
      }),
    }));
  }, []);
  const updateLoan = useCallback((propertyIndex: number, loanIndex: number, key: keyof Loan, value: string | boolean) =>
    setData((prev) => ({
      ...prev, properties: prev.properties.map((p, i) => i !== propertyIndex ? p : {
        ...p, loans: (p.loans || []).map((l, li) => li !== loanIndex ? l : { ...l, [key]: value }),
      }),
    })), []);
  const removeLoan = useCallback((propertyIndex: number, loanIndex: number) =>
    setData((prev) => ({
      ...prev, properties: prev.properties.map((p, i) => i !== propertyIndex ? p : {
        ...p, loans: (p.loans || []).filter((_, li) => li !== loanIndex),
      }),
    })), []);
  // Migration : convertir anciens champs loan* → loans[0] si loanEnabled et loans vide
  const migrateLoans = useCallback((propertyIndex: number) => {
    setData((prev) => ({
      ...prev, properties: prev.properties.map((p, i) => {
        if (i !== propertyIndex) return p;
        if (p.loans && p.loans.length > 0) return p; // déjà migré
        if (!p.loanEnabled) return { ...p, loans: [] };
        const migrated: Loan = {
          id: generateLoanId(), type: p.loanType || "amortissable", label: "Prêt principal",
          amount: p.loanAmount || "", rate: p.loanRate || "", duration: p.loanDuration || "",
          startDate: p.loanStartDate || "", capitalRemaining: p.loanCapitalRemaining || "",
          interestAnnual: p.loanInterestAnnual || "", pledgedPlacementIndex: p.loanPledgedPlacementIndex || "-1",
          insurance: p.loanInsurance || false, insuranceGuarantees: p.loanInsuranceGuarantees || "dc",
          insuranceRate: p.loanInsuranceRate || "", insuranceRate1: p.loanInsuranceRate1 || "",
          insuranceRate2: p.loanInsuranceRate2 || "", insurancePremium: p.loanInsurancePremium || "",
          insuranceCoverage: p.loanInsuranceCoverage || "banque",
        };
        return { ...p, loans: [migrated] };
      }),
    }));
  }, []);

  const addPlacement = useCallback((type: string) => setData((prev) => ({
    ...prev,
    placements: [...prev.placements, { name: "", type, ownership: "person1", value: "", annualIncome: "", taxableIncome: "", deathValue: "", openDate: "", pfuEligible: placementNeedsPFU(type), pfuOptOut: false, totalPremiumsNet: "", premiumsBefore70: "", premiumsAfter70: "", exemptFromSuccession: "", ucRatio: "", annualWithdrawal: "", annualContribution: "", perDeductible: true, perWithdrawal: "", perWithdrawalCapital: "", perWithdrawalInterest: "", perAnticiped: false, beneficiaries: [{ name: "", relation: "autre", share: "100" }] }],
  })), []);
  const updatePlacementStr = useCallback(<K extends Exclude<keyof Placement, "pfuEligible" | "beneficiaries">>(index: number, key: K, value: Placement[K]) =>
    setData((prev) => ({ ...prev, placements: prev.placements.map((p, i) => i === index ? { ...p, [key]: value } : p) })), []);
  const updatePlacementBool = useCallback((index: number, value: boolean) =>
    setData((prev) => ({ ...prev, placements: prev.placements.map((p, i) => i === index ? { ...p, pfuEligible: value } : p) })), []);
  const removePlacement = useCallback((index: number) =>
    setData((prev) => ({ ...prev, placements: prev.placements.filter((_, i) => i !== index) })), []);

  const addPlacementBeneficiary = useCallback((placementIndex: number) =>
    setData((prev) => ({ ...prev, placements: prev.placements.map((p, i) => i === placementIndex ? { ...p, beneficiaries: [...p.beneficiaries, { name: "", relation: "autre", share: "0" }] } : p) })), []);
  const updatePlacementBeneficiary = useCallback((placementIndex: number, bIndex: number, key: keyof Beneficiary, value: string) =>
    setData((prev) => ({ ...prev, placements: prev.placements.map((p, i) => i === placementIndex ? { ...p, beneficiaries: p.beneficiaries.map((b, j) => j === bIndex ? { ...b, [key]: value } : b) } : p) })), []);
  const removePlacementBeneficiary = useCallback((placementIndex: number, bIndex: number) =>
    setData((prev) => ({ ...prev, placements: prev.placements.map((p, i) => i === placementIndex ? { ...p, beneficiaries: p.beneficiaries.filter((_, j) => j !== bIndex) } : p) })), []);

  const importFamilyBeneficiaries = (placementIndex: number) => {
    const family = getFamilyBeneficiaries(data);
    setData((prev) => ({
      ...prev,
      placements: prev.placements.map((p, i) => {
        if (i !== placementIndex) return p;
        const existingKeys = new Set(p.beneficiaries.map((b) => `${b.name}__${b.relation}`));
        const merged = [...p.beneficiaries];
        family.forEach((b) => {
          const key = `${b.name}__${b.relation}`;
          if (!existingKeys.has(key)) { merged.push(b); existingKeys.add(key); }
        });
        return { ...p, beneficiaries: merged };
      }),
    }));
  };

  // ── Calculs mémoïsés — dépendances précises par calcul ──
  // IR : dépend de tous les revenus, placements, properties (foncier), enfants, options
  const ir = useMemo(() => computeIR(data, irOptions, concubinPerson), [
    data.salary1, data.salary2, data.pensions, data.pensions1, data.pensions2,
    data.ca1, data.ca2, data.bicType1, data.bicType2, data.microRegime1, data.microRegime2,
    data.chargesReelles1, data.chargesReelles2, data.chargesDetail1, data.chargesDetail2,
    data.baRevenue1, data.baRevenue2, data.perDeduction, data.pensionDeductible,
    data.otherDeductible, data.csgDeductibleFoncier, data.perRentes,
    data.properties, data.placements, data.childrenData,
    data.coupleStatus, data.matrimonialRegime, data.singleParent,
    data.person1Handicap, data.person2Handicap,
    irOptions, concubinPerson,
  ]);
  // IFI : seulement les biens immobiliers + régime matrimonial
  const ifi = useMemo(() => computeIFI(data), [
    data.properties, data.coupleStatus, data.matrimonialRegime,
  ]);
  // Succession : biens, placements, enfants, régime, dates de naissance
  const succession = useMemo(() => computeSuccession(successionData, data), [
    successionData,
    data.properties, data.placements, data.childrenData,
    data.coupleStatus, data.matrimonialRegime,
    data.person1BirthDate, data.person2BirthDate,
    data.person1FirstName, data.person1LastName,
    data.person2FirstName, data.person2LastName,
  ]);
  const spouseOptions = useMemo(() => getAvailableSpouseOptions(data, successionData.deceasedPerson), [
    data.coupleStatus, data.childrenData, successionData.deceasedPerson,
  ]);
  const effectiveSpouseOption = spouseOptions.some((o) => o.value === successionData.spouseOption)
    ? successionData.spouseOption
    : spouseOptions[0]?.value || "none";

  useEffect(() => {
    if (successionData.spouseOption !== effectiveSpouseOption) {
      setSuccessionData((prev) => ({ ...prev, spouseOption: effectiveSpouseOption }));
    }
  }, [effectiveSpouseOption, successionData.spouseOption]);

  useEffect(() => {
    const id = "ecp-scrollbar-style";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: #e8e0d6 !important; border-radius: 99px; }
      ::-webkit-scrollbar-thumb { background: #26428B !important; border-radius: 99px; border: 2px solid #e8e0d6; transition: background 0.2s; }
      ::-webkit-scrollbar-thumb:hover { background: #1a2e6b !important; }
      ::-webkit-scrollbar-corner { background: #e8e0d6; }
      * { scrollbar-width: thin !important; scrollbar-color: #26428B #e8e0d6 !important; }
      [data-radix-popper-content-wrapper] > * { background: #ffffff !important; }
      [role="listbox"] { background: #ffffff !important; }
      [data-radix-select-content] { background: #ffffff !important; }
      [data-radix-select-viewport] { background: #ffffff !important; }
    `;
    document.head.appendChild(el);
  
    return () => { document.getElementById(id)?.remove(); };
  }, []);


  // ── Composant modal sélection PDF ──
  const PdfModal = ({ open, onClose, sections, setSections, onPrint, title, sectionLabels }: {
    open: boolean; onClose: () => void;
    sections: Record<string, boolean>;
    setSections: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    onPrint: (s: Record<string, boolean>) => void;
    title: string;
    sectionLabels: { key: string; label: string; always?: boolean }[];
  }) => {
    if (!open) return null;
    return (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ background:"#fff", borderRadius:"16px", padding:"28px 32px", minWidth:"360px", maxWidth:"480px", width:"100%", boxShadow:"0 24px 80px rgba(0,0,0,0.2)" }}>
          <div style={{ fontFamily:"'Lato',sans-serif", fontWeight:900, fontSize:"16px", color:"#101B3B", marginBottom:"6px" }}>{title}</div>
          <div style={{ fontSize:"13px", color:"#888", marginBottom:"20px" }}>Sélectionnez les sections à inclure</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"10px", marginBottom:"24px" }}>
            {sectionLabels.map(({ key, label, always }) => (
              <label key={key} style={{ display:"flex", alignItems:"center", gap:"10px", cursor: always ? "default" : "pointer", opacity: always ? 0.5 : 1 }}>
                <input type="checkbox" checked={always || sections[key]} disabled={always}
                  onChange={e => setSections(prev => ({ ...prev, [key]: e.target.checked }))}
                  style={{ width:"16px", height:"16px", accentColor:"#101B3B" }} />
                <span style={{ fontSize:"14px", color:"#333", fontWeight: sections[key] ? 600 : 400 }}>{label}</span>
              </label>
            ))}
          </div>
          <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end" }}>
            <button onClick={onClose} style={{ padding:"8px 18px", borderRadius:"8px", border:"1px solid #e5e7eb", background:"#fff", cursor:"pointer", fontSize:"13px", color:"#666" }}>Annuler</button>
            <button onClick={() => { onClose(); onPrint(sections); }} style={{ padding:"8px 22px", borderRadius:"8px", border:"none", background:"#101B3B", cursor:"pointer", fontSize:"13px", color:"#fff", fontWeight:700 }}>
              Générer le PDF
            </button>
          </div>
        </div>
      </div>
    );
  };

  const showPdfModal = () => setPdfModalOpen(true);

  const baseReference = useMemo(() => {
    if (baseSnapshot.data && baseSnapshot.irOptions && baseSnapshot.successionData) {
      return {
        ir: computeIR(baseSnapshot.data, baseSnapshot.irOptions),
        ifi: computeIFI(baseSnapshot.data),
        succession: computeSuccession(baseSnapshot.successionData, baseSnapshot.data),
      };
    }
    return {
      ir: computeIR(data, irOptions),
      ifi: computeIFI(data),
      succession: computeSuccession(successionData, data),
    };
  }, [baseSnapshot, data, irOptions, successionData]);

  const hypothesisResults = useMemo(() =>
    hypotheses.map((hypothesis) => {
      if (!hypothesis.data || !hypothesis.irOptions || !hypothesis.successionData) {
        return { hypothesis, ir: null, ifi: null, succession: null, differences: [] as DifferenceLine[] };
      }
      return {
        hypothesis,
        ir: computeIR(hypothesis.data, hypothesis.irOptions),
        ifi: computeIFI(hypothesis.data),
        succession: computeSuccession(hypothesis.successionData, hypothesis.data),
        differences: buildHypothesisDifferenceLines(baseSnapshot.data, baseSnapshot.irOptions, hypothesis.data, hypothesis.irOptions),
      };
    }),
    [hypotheses, baseSnapshot]
  );


  // ── Succession ──
  const syncCollectedHeirs = () => setSuccessionData((prev) => ({ ...prev, heirs: buildCollectedHeirs(data, successionData.deceasedPerson) }));

  // Membres de la famille disponibles pour le picker
  const getFamilyMembers = () => {
    const members: { firstName: string; lastName: string; birthDate: string; relation: string }[] = [];
    const deceased = successionData.deceasedPerson;
    if (deceased === "person1" && (data.person2FirstName || data.person2LastName)) {
      members.push({ firstName: data.person2FirstName, lastName: data.person2LastName, birthDate: data.person2BirthDate, relation: "conjoint" });
    }
    if (deceased === "person2" && (data.person1FirstName || data.person1LastName)) {
      members.push({ firstName: data.person1FirstName, lastName: data.person1LastName, birthDate: data.person1BirthDate, relation: "conjoint" });
    }
    data.childrenData.forEach((child) => {
      if (child.firstName || child.lastName) {
        const link = child.parentLink || "common_child";
        const isChildOfDeceased =
          link === "common_child" ||
          (link === "person1_only" && deceased === "person1") ||
          (link === "person2_only" && deceased === "person2");
        const relation = isChildOfDeceased ? "enfant" : "enfant_conjoint";
        members.push({ firstName: child.firstName || "", lastName: child.lastName || "", birthDate: child.birthDate || "", relation });
      }
    });
    return members;
  };

  // Ajouter un membre famille dans legs global
  const addFamilyMemberToLegsGlobal = (member: { firstName: string; lastName: string; birthDate: string; relation: string }) => {
    setSuccessionData((prev) => ({
      ...prev,
      testamentHeirs: [...prev.testamentHeirs, { ...member, priorDonations: "0", shareGlobal: "", propertyRight: "full" }],
    }));
  };

  // Ajouter un membre famille dans legs précis
  const addFamilyMemberToLegsPrecis = (member: { firstName: string; lastName: string; birthDate: string; relation: string }, itemIndex?: number) => {
    const newLegataire = { heirName: `${member.firstName} ${member.lastName}`.trim(), heirRelation: member.relation, heirBirthDate: member.birthDate, sharePercent: "100", propertyRight: "full", contreparties: [] };
    setSuccessionData((prev) => {
      const items = [...(prev.legsPrecisItems || [])];
      if (itemIndex !== undefined && items[itemIndex]) {
        // Ajouter le légataire à un bien existant
        items[itemIndex] = { ...items[itemIndex], legataires: [...(items[itemIndex].legataires || []), newLegataire] };
      } else {
        // Créer un nouveau bien avec ce légataire
        items.push({ propertyIndex: 0, assetType: "property" as const, legataires: [newLegataire] });
      }
      return { ...prev, legsPrecisItems: items };
    });
  };

  // Import famille → héritiers testamentaires
  const importFamilyToTestament = () => {
    const deceased = successionData.deceasedPerson;
    const newHeirs: TestamentHeir[] = [];
    // Conjoint survivant
    if (deceased === "person1" && (data.person2FirstName || data.person2LastName)) {
      newHeirs.push({ firstName: data.person2FirstName, lastName: data.person2LastName, birthDate: data.person2BirthDate, relation: "conjoint", priorDonations: "0", shareGlobal: "", propertyRight: "full" });
    }
    if (deceased === "person2" && (data.person1FirstName || data.person1LastName)) {
      newHeirs.push({ firstName: data.person1FirstName, lastName: data.person1LastName, birthDate: data.person1BirthDate, relation: "conjoint", priorDonations: "0", shareGlobal: "", propertyRight: "full" });
    }
    // Enfants — relation déduite du lien de filiation réel
    data.childrenData.forEach((child) => {
      const link = child.parentLink || "common_child";
      // Enfant du défunt (commun ou propre) → "enfant" → abattement 100k, ligne directe
      // Enfant du conjoint seul → "enfant_conjoint" → tiers fiscal 60%, abattement 1594€
      const isChildOfDeceased =
        link === "common_child" ||
        (link === "person1_only" && deceased === "person1") ||
        (link === "person2_only" && deceased === "person2");
      const relation = isChildOfDeceased ? "enfant" : "enfant_conjoint";
      newHeirs.push({
        firstName: child.firstName || "",
        lastName: child.lastName || "",
        birthDate: child.birthDate || "",
        relation,
        priorDonations: "0",
        shareGlobal: "",
        propertyRight: "full",
      });
    });
    setSuccessionData((prev) => ({ ...prev, testamentHeirs: newHeirs, useTestament: true }));
  };

  const addTestamentHeir = () => setSuccessionData((prev) => ({ ...prev, testamentHeirs: [...prev.testamentHeirs, { firstName: "", lastName: "", birthDate: "", relation: "enfant", priorDonations: "0", shareGlobal: "", propertyRight: "full" }] }));
  const updateTestamentHeir = (index: number, key: keyof TestamentHeir, value: string) =>
    setSuccessionData((prev) => ({ ...prev, testamentHeirs: prev.testamentHeirs.map((h, i) => i === index ? { ...h, [key]: value } : h) }));
  const removeTestamentHeir = (index: number) =>
    setSuccessionData((prev) => ({ ...prev, testamentHeirs: prev.testamentHeirs.filter((_, i) => i !== index) }));
  const addLegsPrecisItem = () => setSuccessionData((prev) => ({ ...prev, legsPrecisItems: [...(prev.legsPrecisItems || []), { propertyIndex: 0, assetType: "property" as const, legataires: [] }] }));
  const addLegsPrecisItemFree = () => setSuccessionData((prev) => ({ ...prev, legsPrecisItems: [...(prev.legsPrecisItems || []), { propertyIndex: 0, assetType: "free" as const, freeLabel: "", freeValue: "", legataires: [] }] }));
  const addLegsPrecisItemResidual = () => setSuccessionData((prev) => ({ ...prev, legsPrecisItems: [...(prev.legsPrecisItems || []), { propertyIndex: 0, assetType: "free" as const, freeLabel: "Reste du patrimoine", freeValue: "", isResidual: true, legataires: [] }] }));
  const updateLegsPrecisItem = (index: number, key: keyof LegsPrecisItem, value: any) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((l, i) => i === index ? { ...l, [key]: value } : l) }));
  const removeLegsPrecisItem = (index: number) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).filter((_, i) => i !== index) }));

  // Helpers légataires (nouvelle structure)
  // Recalcule les parts égales entre légataires (arrondi au centième, dernier absorbe le résidu)
  const rebalanceShares = (legataires: any[]): any[] => {
    const n = legataires.length;
    if (n === 0) return legataires;
    const base = Math.floor(10000 / n) / 100; // ex: 3 légataires → 33.33
    const last = Math.round((100 - base * (n - 1)) * 100) / 100;
    return legataires.map((l, i) => ({ ...l, sharePercent: String(i === n - 1 ? last : base) }));
  };

  const addLegataire = (itemIndex: number, legataire: { heirName: string; heirRelation: string; heirBirthDate: string }) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((it, i) => {
      if (i !== itemIndex) return it;
      const newLegs = rebalanceShares([...(it.legataires || []), { ...legataire, sharePercent: "100", propertyRight: "full", contreparties: [] }]);
      return { ...it, legataires: newLegs };
    }) }));
  const updateLegataire = (itemIndex: number, legIndex: number, key: string, value: any) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((it, i) => i === itemIndex ? { ...it, legataires: (it.legataires || []).map((l, li) => li === legIndex ? { ...l, [key]: value } : l) } : it) }));
  const removeLegataire = (itemIndex: number, legIndex: number) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((it, i) => {
      if (i !== itemIndex) return it;
      const filtered = (it.legataires || []).filter((_, li) => li !== legIndex);
      return { ...it, legataires: rebalanceShares(filtered) };
    }) }));

  // Contreparties sur légataire
  const rebalanceContreparties = (contreparties: any[]): any[] => {
    const n = contreparties.length;
    if (n === 0) return contreparties;
    const base = Math.floor(10000 / n) / 100;
    const last = Math.round((100 - base * (n - 1)) * 100) / 100;
    return contreparties.map((c, i) => ({ ...c, sharePercent: String(i === n - 1 ? last : base) }));
  };

  const addContrepartieLegataire = (itemIndex: number, legIndex: number, cp: { heirName: string; heirRelation: string; heirBirthDate: string }) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((it, i) => i === itemIndex ? { ...it, legataires: (it.legataires || []).map((l, li) => {
      if (li !== legIndex) return l;
      const newCps = rebalanceContreparties([...(l.contreparties || []), { ...cp, sharePercent: "100" }]);
      return { ...l, contreparties: newCps };
    }) } : it) }));
  const updateContrepartieLegataire = (itemIndex: number, legIndex: number, cpIndex: number, key: string, value: string) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((it, i) => i === itemIndex ? { ...it, legataires: (it.legataires || []).map((l, li) => li === legIndex ? { ...l, contreparties: (l.contreparties || []).map((c, ci) => ci === cpIndex ? { ...c, [key]: value } : c) } : l) } : it) }));
  const removeContrepartieLegataire = (itemIndex: number, legIndex: number, cpIndex: number) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((it, i) => i === itemIndex ? { ...it, legataires: (it.legataires || []).map((l, li) => { if (li !== legIndex) return l; const filtered = (l.contreparties || []).filter((_, ci) => ci !== cpIndex); return { ...l, contreparties: rebalanceContreparties(filtered) }; }) } : it) }));
  // Ajouter une contrepartie de démembrement
  const addContrepartie = (itemIndex: number, membre?: { heirName: string; heirRelation: string; heirBirthDate: string }) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((l, i) => i === itemIndex ? { ...l, contreparties: [...(l.contreparties || []), { heirName: membre?.heirName || "", heirRelation: membre?.heirRelation || "enfant", heirBirthDate: membre?.heirBirthDate || "", sharePercent: "100" }] } : l) }));
  const updateContrepartie = (itemIndex: number, cpIndex: number, key: keyof DemembrementContrepartie, value: string) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((l, i) => i === itemIndex ? { ...l, contreparties: (l.contreparties || []).map((c, ci) => ci === cpIndex ? { ...c, [key]: value } : c) } : l) }));
  const removeContrepartie = (itemIndex: number, cpIndex: number) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((l, i) => i === itemIndex ? { ...l, contreparties: (l.contreparties || []).filter((_, ci) => ci !== cpIndex) } : l) }));

  // ── Contreparties legs global (nu-propriétaires liés à un usufruitier) ──
  const addContrepartieGlobal = (heirIndex: number, membre?: { heirName: string; heirRelation: string; heirBirthDate: string }) => {
    setSuccessionData((prev) => {
      const newHeirs = prev.testamentHeirs.map((h, i) => {
        if (i !== heirIndex) return h;
        const existing = ((h as any).contreparties || []) as DemembrementContrepartie[];
        const newCp: DemembrementContrepartie = { heirName: membre?.heirName || "", heirRelation: membre?.heirRelation || "enfant", heirBirthDate: membre?.heirBirthDate || "", sharePercent: "100" };
        const updated = [...existing, newCp];
        // Auto-équilibrage : répartir 100% équitablement entre tous les NP liés
        const equalShare = Math.round(10000 / updated.length) / 100;
        const balanced = updated.map((cp, ci) => ({ ...cp, sharePercent: ci < updated.length - 1 ? String(equalShare) : String(Math.round((100 - equalShare * (updated.length - 1)) * 100) / 100) }));
        return { ...h, contreparties: balanced };
      });
      return { ...prev, testamentHeirs: newHeirs };
    });
  };
  const updateContrepartieGlobal = (heirIndex: number, cpIndex: number, key: keyof DemembrementContrepartie, value: string) =>
    setSuccessionData((prev) => ({ ...prev, testamentHeirs: prev.testamentHeirs.map((h, i) => i === heirIndex ? { ...h, contreparties: ((h as any).contreparties || []).map((c: any, ci: number) => ci === cpIndex ? { ...c, [key]: value } : c) } : h) }));
  const removeContrepartieGlobal = (heirIndex: number, cpIndex: number) => {
    setSuccessionData((prev) => {
      const newHeirs = prev.testamentHeirs.map((h, i) => {
        if (i !== heirIndex) return h;
        const updated = ((h as any).contreparties || []).filter((_: any, ci: number) => ci !== cpIndex) as DemembrementContrepartie[];
        // Re-équilibrer après suppression
        if (updated.length === 0) return { ...h, contreparties: [] };
        const equalShare = Math.round(10000 / updated.length) / 100;
        const balanced = updated.map((cp: any, ci: number) => ({ ...cp, sharePercent: ci < updated.length - 1 ? String(equalShare) : String(Math.round((100 - equalShare * (updated.length - 1)) * 100) / 100) }));
        return { ...h, contreparties: balanced };
      });
      return { ...prev, testamentHeirs: newHeirs };
    });
  };

  // ── Auto-équilibrage quotités legs précis : répartir 100% entre les contreparties d'un item ──
  const addContrepartieWithBalance = (itemIndex: number, membre?: { heirName: string; heirRelation: string; heirBirthDate: string }) => {
    setSuccessionData((prev) => {
      const newItems = (prev.legsPrecisItems || []).map((l, i) => {
        if (i !== itemIndex) return l;
        const existing = l.contreparties || [];
        const newCp: DemembrementContrepartie = { heirName: membre?.heirName || "", heirRelation: membre?.heirRelation || "enfant", heirBirthDate: membre?.heirBirthDate || "", sharePercent: "100" };
        const updated = [...existing, newCp];
        const equalShare = Math.round(10000 / updated.length) / 100;
        const balanced = updated.map((cp, ci) => ({ ...cp, sharePercent: ci < updated.length - 1 ? String(equalShare) : String(Math.round((100 - equalShare * (updated.length - 1)) * 100) / 100) }));
        return { ...l, contreparties: balanced };
      });
      return { ...prev, legsPrecisItems: newItems };
    });
  };
  const removeContrepartieWithBalance = (itemIndex: number, cpIndex: number) => {
    setSuccessionData((prev) => {
      const newItems = (prev.legsPrecisItems || []).map((l, i) => {
        if (i !== itemIndex) return l;
        const updated = (l.contreparties || []).filter((_, ci) => ci !== cpIndex);
        if (updated.length === 0) return { ...l, contreparties: [] };
        const equalShare = Math.round(10000 / updated.length) / 100;
        const balanced = updated.map((cp, ci) => ({ ...cp, sharePercent: ci < updated.length - 1 ? String(equalShare) : String(Math.round((100 - equalShare * (updated.length - 1)) * 100) / 100) }));
        return { ...l, contreparties: balanced };
      });
      return { ...prev, legsPrecisItems: newItems };
    });
  };

  // ── Hypothèses ──
  const renameHypothesis = (id: number, name: string) =>
    setHypotheses((prev) => prev.map((h) => h.id === id ? { ...h, name } : h));
  const updateHypothesisNotes = (id: number, notesValue: string) =>
    setHypotheses((prev) => prev.map((h) => h.id === id ? { ...h, notes: notesValue } : h));
  const updateHypothesisObjective = (id: number, objectiveValue: string) =>
    setHypotheses((prev) => prev.map((h) => h.id === id ? { ...h, objective: objectiveValue } : h));
  const saveBaseSnapshot = () =>
    setBaseSnapshot({ savedAt: new Date().toISOString(), data: deepClone(data), successionData: deepClone(successionData), irOptions: deepClone(irOptions) });
  const restoreBaseSnapshot = () => {
    if (!baseSnapshot.data || !baseSnapshot.successionData || !baseSnapshot.irOptions) return;
    setData(deepClone(baseSnapshot.data));
    setSuccessionData(deepClone(baseSnapshot.successionData));
    setIrOptions(deepClone(baseSnapshot.irOptions));
  };
  const saveHypothesis = (id: number) =>
    setHypotheses((prev) => prev.map((h) => h.id === id ? { ...h, savedAt: new Date().toISOString(), data: deepClone(data), successionData: deepClone(successionData), irOptions: deepClone(irOptions) } : h));
  const loadHypothesis = (id: number) => {
    const selected = hypotheses.find((h) => h.id === id);
    if (!selected?.data || !selected.successionData || !selected.irOptions) return;
    setData(deepClone(selected.data));
    setSuccessionData(deepClone(selected.successionData));
    setIrOptions(deepClone(selected.irOptions));
  };
  const clearHypothesis = (id: number) =>
    setHypotheses((prev) => prev.map((h) => h.id === id ? { ...h, notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null } : h));

  // ── PDF ──
  // ── Sauvegarde client et retour liste ──
  const handleSaveAndClose = () => {
    if (!activeClient) return
    const payload: ClientPayload = {
      clientName, notes, data, irOptions, successionData, hypotheses, baseSnapshot, mission,
    }
    const displayName = [(data as any).person1LastName, (data as any).person1FirstName].filter(Boolean).join(' ') || clientName
    saveClient(activeClient.id, payload as ClientPayload, displayName)
    setActiveClient(null)
  }

  const handleOpenClient = (client: ClientRecord) => {
    const p = client.payload
    if (p.clientName) setClientName(p.clientName as string)
    if (p.notes) setNotes(p.notes as string)
    if (p.data) {
      const d = p.data as any;
      // Migration : nouveaux champs absents des dossiers existants
      d.pensions1 = d.pensions1 ?? "";
      d.pensions2 = d.pensions2 ?? "";
      d.csgDeductibleFoncier = d.csgDeductibleFoncier ?? "";
      d.childrenData = (d.childrenData || []).map((c: any) => ({ schoolLevel: "", ...c }));
      d.properties = (d.properties || []).map((p: any) => {
        const base = { loanInsuranceGuarantees: "dc", loanInsuranceCoverage: "banque", ...p };
        // Migration multi-crédits : convertir ancien loanEnabled → loans[0]
        if (!base.loans || base.loans.length === 0) {
          if (base.loanEnabled && base.loanAmount) {
            base.loans = [{
              id: `loan_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
              type: base.loanType || "amortissable", label: "Prêt principal",
              amount: base.loanAmount || "", rate: base.loanRate || "",
              duration: base.loanDuration || "", startDate: base.loanStartDate || "",
              capitalRemaining: base.loanCapitalRemaining || "", interestAnnual: base.loanInterestAnnual || "",
              pledgedPlacementIndex: base.loanPledgedPlacementIndex || "-1",
              insurance: base.loanInsurance || false, insuranceGuarantees: base.loanInsuranceGuarantees || "dc",
              insuranceRate: base.loanInsuranceRate || "", insuranceRate1: base.loanInsuranceRate1 || "",
              insuranceRate2: base.loanInsuranceRate2 || "", insurancePremium: base.loanInsurancePremium || "",
              insuranceCoverage: base.loanInsuranceCoverage || "banque",
            }];
          } else {
            base.loans = [];
          }
        }
        return base;
      });
      setData(d as typeof data);
    }
    if (p.irOptions) setIrOptions(p.irOptions as typeof irOptions)
    if (p.successionData) setSuccessionData(p.successionData as typeof successionData)
    if (p.hypotheses) setHypotheses(p.hypotheses as typeof hypotheses)
    if (p.baseSnapshot) setBaseSnapshot(p.baseSnapshot as typeof baseSnapshot)
    if (p.mission) setMission(p.mission as typeof mission)
    setActiveClient(client)
  }

  const handleCreateClient = (name: string) => {
    const client = createClient(name)
    // Remettre tous les états à zéro pour un nouveau dossier vierge
    setClientName(name)
    setNotes("")
    setData({
      person1FirstName: "", person1LastName: "", person1BirthDate: "", person1JobTitle: "", person1Csp: "", person1PcsGroupe: "5",
      person2FirstName: "", person2LastName: "", person2BirthDate: "", person2JobTitle: "", person2Csp: "", person2PcsGroupe: "5",
      coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
      person1Handicap: false, person2Handicap: false,
      childrenData: [], salary1: "", salary2: "", pensions: "", pensions1: "", pensions2: "", csgDeductibleFoncier: "",
      perDeduction: "", pensionDeductible: "", otherDeductible: "", perRentes: [],
      ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "", chargesDetail1: {...EMPTY_CHARGES_DETAIL},
      ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "", chargesDetail2: {...EMPTY_CHARGES_DETAIL},
      properties: [], placements: [], otherLoans: [],
    })
    setSuccessionData({
      deceasedPerson: "person1", spousePresent: true, spouseOption: "legal_quarter_full",
      useTestament: false, legsMode: "global", heirs: [], testamentHeirs: [], legsPrecisItems: [],
    })
    setIrOptions({
      expenseMode1: "standard", expenseMode2: "standard",
      km1: "", km2: "", cv1: "", cv2: "",
      mealCount1: "", mealCount2: "", mealUnit1: "5.35", mealUnit2: "5.35",
      other1: "", other2: "", foncierRegime: "micro",
    })
    setHypotheses([
      { id: 1, name: "Hypothèse 1", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
      { id: 2, name: "Hypothèse 2", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
      { id: 3, name: "Hypothèse 3", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
    ])
    setBaseSnapshot({ savedAt: null, data: null, successionData: null, irOptions: null })
    setActiveClient(client)
  }

  // ── PWA Install Prompt ──
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    // Détecter si déjà installée
    window.addEventListener("appinstalled", () => {
      setIsInstallable(false);
      setInstallPrompt(null);
    });
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstallable(false);
      setInstallPrompt(null);
    }
  };

  const generatePdf = () => {
    // modal state géré via setPdfModalOpen
    // ── modal state géré en dehors — voir bouton PDF ──
    showPdfModal();
  };


  const buildAndPrintPdf = (sections: Record<string, boolean>) => {
    _buildAndPrintPdf({
      sections, data, ir, ifi, succession, irOptions,
      cabinet: cabinet as Record<string, string>,
      clientName, notes, logoSrc, hypothesisResults,
    });
  };

    const generateMissionPdf = () => { setPdfMissionModalOpen(true); };

  const buildAndPrintMission = (sections: Record<string, boolean>) => {
    _buildAndPrintMission({
      sections, data, ir, ifi, succession, irOptions,
      cabinet: cabinet as Record<string, string>,
      clientName, logoSrc, signatureSrc, mission,
    });
  };

  
  // ── Export JSON ──
  const exportDataFile = async () => {
    try {
      setExportStatus("");
      const payload = { version: 2, exportedAt: new Date().toISOString(), clientName, notes, data, successionData, irOptions, hypotheses, baseSnapshot };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const fileName = buildExportFileName(clientName);
      const pickerWindow = window as any;
      if (pickerWindow.showSaveFilePicker) {
        const handle = await pickerWindow.showSaveFilePicker({ suggestedName: fileName, types: [{ description: "Fichier Ploutos", accept: { "application/json": [".json"] } }] });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        setAutoSaveStatus("saved"); setTimeout(() => setAutoSaveStatus("idle"), 2500);
        return;
      }
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = fileName; anchor.rel = "noopener noreferrer"; anchor.style.display = "none";
      document.body.appendChild(anchor); anchor.click();
      window.setTimeout(() => { anchor.parentNode?.removeChild(anchor); window.URL.revokeObjectURL(url); }, 500);
      setAutoSaveStatus("saved"); setTimeout(() => setAutoSaveStatus("idle"), 2500);
    } catch (error) {
      console.error("Export impossible", error);
      const payload = { version: 2, exportedAt: new Date().toISOString(), clientName, notes, data, successionData, irOptions, hypotheses, baseSnapshot };
      const fallbackJson = JSON.stringify(payload, null, 2);
      const fallbackFileName = buildExportFileName(clientName);
      setExportFallbackContent(fallbackJson); setExportFallbackFileName(fallbackFileName); setExportFallbackOpen(true);
      setExportStatus("L'aperçu bloque l'enregistrement direct. Utilise la fenêtre qui s'ouvre.");
    }
  };

  const copyExportFallback = async () => {
    try {
      await navigator.clipboard.writeText(exportFallbackContent);
      setExportStatus(`Contenu copié. Enregistre-le dans un fichier nommé ${exportFallbackFileName}.`);
    } catch { setExportStatus("Copie automatique impossible. Sélectionne le contenu manuellement."); }
  };

  // ── Import JSON ──
  const importDataFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        if (parsed.clientName !== undefined) setClientName(String(parsed.clientName || "Client"));
        if (parsed.notes !== undefined) setNotes(String(parsed.notes || ""));
        if (parsed.data) setData(parsed.data as PatrimonialData);
        if (parsed.successionData) setSuccessionData(parsed.successionData as SuccessionData);
        if (parsed.irOptions) setIrOptions(parsed.irOptions as IrOptions);
        if (Array.isArray(parsed.hypotheses)) setHypotheses(parsed.hypotheses as Hypothesis[]);
        if (parsed.baseSnapshot) setBaseSnapshot(parsed.baseSnapshot as BaseSnapshot);
      } catch (error) { console.error("Import impossible", error); }
    };
    reader.readAsText(file, "utf-8");
    event.target.value = "";
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  // ── Dashboard admin ──────────────────────────────────────────────────────
  if (showAdmin && isAdmin) {
    return (
      <AdminDashboard
        colorNavy={cabinet.colorNavy || "#101B3B"}
        colorSky={cabinet.colorSky || "#26428B"}
        colorGold={cabinet.colorGold || "#E3AF64"}
        colorCream={cabinet.colorCream || "#FBECD7"}
        onClose={() => setShowAdmin(false)}
      />
    );
  }

  // ── Vérification licence ─────────────────────────────────────────────────
  if (!licence.loading && !licence.isValid && authState === "authenticated") {
    return (
      <LicenceGate
        licence={licence}
        userId={userId}
        onSignOut={onSignOut}
        colorNavy={cabinet.colorNavy || "#101B3B"}
        colorSky={cabinet.colorSky || "#26428B"}
        colorGold={cabinet.colorGold || "#E3AF64"}
        logoSrc={logoSrc}
      />
    );
  }

  // Guard — Client actif

  if (!activeClient) {
    return (
      <ClientManager
        clients={clients}
        syncStatus={syncStatus}
        syncNow={syncNow}
        onOpen={handleOpenClient}
        onCreate={handleCreateClient}
        onDelete={deleteClient}
        onDuplicate={(id) => { const c = duplicateClient(id); if (c) handleOpenClient(c) }}
        onRename={renameClient}
        logoSrc={logoSrc}
        cabinetName={cabinet.nom || cabinet.cabinetName || "Cabinet"}
        colorNavy={cabinet.colorNavy}
        colorGold={cabinet.colorGold}
        colorSky={cabinet.colorSky}
        colorCream={cabinet.colorCream}
        isInstallable={isInstallable}
        onInstall={handleInstallClick}
        onSignOut={onSignOut}
        onAdmin={() => setShowAdmin(true)}
        isAdmin={isAdmin}
        licence={licence}
        userId={userId}
      />
    )
  }

  return (
    <div className="fixed inset-0 overflow-y-scroll" style={{ background: SURFACE.app, scrollbarWidth: "thin", scrollbarColor: "#26428B #e8e0d6", scrollbarGutter: "stable" }}>
      <LicenceBanner
        licence={licence}
        userId={userId}
        colorGold={cabinet.colorGold || "#E3AF64"}
        colorNavy={cabinet.colorNavy || "#101B3B"}
      />
      <div className="mx-auto max-w-7xl p-6 space-y-6">

        {/* ── Header ── */}
        <Card className="overflow-hidden rounded-[28px] border-0 shadow-2xl shadow-slate-300/40">
          <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${CAB.gold} 0%, ${CAB.cream} 55%, #fff7ea 100%)` }} />
          <CardContent className="px-6 py-5 md:px-10 md:py-6" style={{ background: `linear-gradient(135deg, ${CAB.navy} 0%, ${CAB.sky} 38%, ${CAB.blue} 68%, ${CAB.gold} 100%)` }}>
            <div className="flex items-center">
              {/* ── Gauche : navigation ── */}
              <div className="flex flex-1 items-center gap-3">
                <button onClick={handleSaveAndClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "10px", padding: "6px 14px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  ← Dossiers
                </button>
                {isAdmin && (
                  <button onClick={() => setShowAdmin(true)} style={{ background: "rgba(227,175,100,0.25)", border: "1px solid rgba(227,175,100,0.5)", borderRadius: "10px", padding: "6px 14px", color: "#E3AF64", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}>
                    ⚙ Admin
                  </button>
                )}
                <button onClick={() => { handleSaveAndClose(); onSignOut(); }} style={{ background: "rgba(255,255,255,0.10)", border: "none", borderRadius: "10px", padding: "6px 14px", color: "rgba(255,255,255,0.7)", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}>
                  Déconnexion
                </button>
              </div>

              {/* ── Centre : logo cabinet (ou Ploutos par défaut) ── */}
              <div className="flex flex-1 justify-center">
                <img
                  src={logoSrc || DEFAULT_LOGO_SRC}
                  alt="Logo cabinet"
                  className="h-16 w-auto object-contain drop-shadow-md"
                  onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_LOGO_SRC; }}
                />
              </div>

              {/* ── Droite : client + actions ── */}
              <div className="flex flex-1 items-center justify-end gap-3">
                <HelpMenu
                  colorNavy={CAB.navy}
                  colorGold={CAB.gold}
                  colorSky={CAB.sky}
                  cabinetName={cabinet.cabinetName || "Conseiller"}
                  appVersion="web"
                />
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="h-9 w-48 rounded-xl border-0 bg-white/95 text-sm shadow-md shadow-slate-950/10"
                  placeholder="Dossier"
                />

                {/* Bouton Sauvegarder — icône seule avec indicateur superposé */}
                <div className="relative" title="Sauvegarder">
                  <button
                    onClick={() => { void exportDataFile(); }}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border-0 bg-white/90 shadow-sm hover:bg-white transition-colors"
                    style={{ color: "#101B3B" }}
                  >
                    {autoSaveStatus === "saving" ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : autoSaveStatus === "saved" ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Bouton Charger — icône seule */}
                <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border-0 bg-white/90 shadow-sm hover:bg-white transition-colors" title="Charger" style={{ color: "#101B3B" }}>
                  <Upload className="h-4 w-4" />
                  <input type="file" accept="application/json" className="hidden" onChange={importDataFile} />
                </label>

                <Button className="h-9 rounded-xl px-4 text-sm font-medium shadow-md" style={{ background: BRAND.gold, color: BRAND.navy }} onClick={() => setPdfModalOpen(true)}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />PDF Rapport
                </Button>
                <Button className="h-9 rounded-xl px-4 text-sm font-medium shadow-md" style={{ background: BRAND.navy, color: "#fff" }} onClick={generateMissionPdf}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />PDF Mission
                </Button>
              </div>
            </div>
            {exportStatus && <div className="mt-2 text-xs text-white/70">{exportStatus}</div>}
          </CardContent>
        </Card>

        {/* ── Dialog détail charges professionnelles ── */}
        <Dialog open={chargesDialogOpen !== null} onOpenChange={(o) => { if (!o) setChargesDialogOpen(null); }}>
          <DialogContent className="max-w-lg rounded-2xl" style={{ background: SURFACE.card }}>
            <DialogHeader>
              <DialogTitle style={{ color: BRAND.navy }}>
                Charges professionnelles — {chargesDialogOpen === 1 ? person1 : person2}
              </DialogTitle>
            </DialogHeader>
            {chargesDialogOpen !== null && (() => {
              const who = chargesDialogOpen as 1 | 2;
              const detail: ChargesDetail = ((who === 1 ? data.chargesDetail1 : data.chargesDetail2) as ChargesDetail) || EMPTY_CHARGES_DETAIL;
              const total = sumChargesDetail(detail);
              const lignes: { key: keyof ChargesDetail; label: string; placeholder: string }[] = [
                { key: "loyer",        label: "Loyer / bureau",                  placeholder: "ex. 3 600" },
                { key: "materiel",     label: "Matériel & équipements",          placeholder: "ex. 2 500" },
                { key: "deplacements", label: "Déplacements (km, transport)",    placeholder: "ex. 1 800" },
                { key: "repas",        label: "Repas professionnels",            placeholder: "ex. 600" },
                { key: "tns",          label: "Cotisations TNS (URSSAF, retraite…)", placeholder: "ex. 8 000" },
                { key: "bancaires",    label: "Frais bancaires",                 placeholder: "ex. 250" },
                { key: "comptable",    label: "Honoraires comptable",            placeholder: "ex. 1 200" },
                { key: "autres",       label: "Autres charges",                  placeholder: "ex. 500" },
              ];
              return (
                <div className="space-y-4">
                  {/* Import PDF */}
                  <div className="flex items-center justify-between rounded-xl p-3" style={{ background: "rgba(81,106,199,0.06)", border: "1px solid rgba(81,106,199,0.15)" }}>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: BRAND.navy }}>Importer un bilan / compte de résultat</div>
                      <div className="text-xs text-slate-400 mt-0.5">PDF — extraction automatique des charges par Claude</div>
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setChargesPdfLoading(true);
                          try {
                            // Lire le PDF en base64
                            const base64 = await new Promise<string>((res, rej) => {
                              const reader = new FileReader();
                              reader.onload = () => res((reader.result as string).split(",")[1]);
                              reader.onerror = rej;
                              reader.readAsDataURL(file);
                            });
                            // Appel API Claude — clé injectée par vite.config.ts
                            const apiKey = (typeof __ANTHROPIC_KEY__ !== "undefined" ? __ANTHROPIC_KEY__ : "") as string;
                            if (!apiKey) {
                              alert("Clé API Anthropic non configurée. Contactez l'administrateur.");
                              setChargesPdfLoading(false);
                              return;
                            }
                            const response = await fetch("https://api.anthropic.com/v1/messages", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                "x-api-key": apiKey,
                                "anthropic-version": "2023-06-01",
                                "anthropic-dangerous-direct-browser-access": "true",
                              },
                              body: JSON.stringify({
                                model: "claude-haiku-4-5",
                                max_tokens: 1000,
                                messages: [{
                                  role: "user",
                                  content: [
                                    {
                                      type: "document",
                                      source: { type: "base64", media_type: "application/pdf", data: base64 }
                                    },
                                    {
                                      type: "text",
                                      text: `Tu es expert-comptable. Analyse ce document fiscal (bilan, compte de résultat, liasse 2035, 2031 ou relevé URSSAF) et extrais les charges professionnelles annuelles déductibles.

Mappe chaque poste dans ces 8 catégories. Réponds UNIQUEMENT avec un objet JSON valide, sans commentaire, sans markdown :
{
  "loyer": 0,
  "materiel": 0,
  "deplacements": 0,
  "repas": 0,
  "tns": 0,
  "bancaires": 0,
  "comptable": 0,
  "autres": 0
}

Règles de mapping :
- loyer : loyers, charges locatives, location bureaux/locaux (2035 case BT, BU)
- materiel : achats matériel, équipements, fournitures, amortissements, petit outillage (2035 case BN, BO, amort.)
- deplacements : frais kilométriques, transports, déplacements professionnels (2035 case BV, BW)
- repas : frais de repas, restauration professionnelle (2035 case BX)
- tns : cotisations URSSAF, retraite obligatoire, prévoyance TNS, charges sociales personnelles (2035 case BZ, ou ligne FG du CR)
- bancaires : frais bancaires, agios, commissions bancaires
- comptable : honoraires expert-comptable, avocat, conseil, AGA (2035 case BQ honoraires rétrocédés exclus)
- autres : toutes autres charges déductibles non classées ci-dessus (2035 case CA)

Si c'est une 2035 BNC : utilise les cases BQ à CA.
Si c'est un compte de résultat SARL : utilise les lignes FF (salaires → ignorer), FG (charges sociales → tns), FD (autres charges → ventiler).
Mets 0 si la catégorie n'est pas trouvée. Arrondis à l'euro. Ne jamais inclure les salaires versés à des employés.`
                                    }
                                  ]
                                }]
                              })
                            });
                            const data_resp = await response.json();
                            if (!response.ok) {
                              const apiError = data_resp.error?.message || JSON.stringify(data_resp);
                              throw new Error(`API ${response.status} : ${apiError}`);
                            }
                            const text = data_resp.content?.map((b: any) => b.text || "").join("") || "";
                            const clean = text.replace(/```json|```/g, "").trim();
                            const parsed = JSON.parse(clean) as Partial<ChargesDetail>;
                            // Appliquer les valeurs extraites
                            (Object.keys(parsed) as (keyof ChargesDetail)[]).forEach((k) => {
                              const v = (parsed[k] as any);
                              if (v && Number(v) > 0) setChargesDetailField(who, k, String(Math.round(Number(v))));
                            });
                          } catch (err) {
                            console.error("Extraction PDF échouée :", err);
                            const msg = err instanceof Error ? err.message : String(err);
                            alert(`Extraction échouée : ${msg}\n\nSaisissez les montants manuellement.`);
                          } finally {
                            setChargesPdfLoading(false);
                            e.target.value = "";
                          }
                        }}
                      />
                      <div
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors"
                        style={{ background: chargesPdfLoading ? "#e2e8f0" : BRAND.navy, color: "#fff", cursor: chargesPdfLoading ? "wait" : "pointer" }}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {chargesPdfLoading ? "Analyse en cours…" : "Importer PDF"}
                      </div>
                    </label>
                  </div>

                  {/* Lignes par nature */}
                  <div className="space-y-2">
                    {lignes.map(({ key, label, placeholder }) => (
                      <div key={key} className="flex items-center gap-3">
                        <label className="flex-1 text-xs text-slate-600" style={{ minWidth: 0 }}>{label}</label>
                        <div className="relative" style={{ width: 130 }}>
                          <Input
                            value={detail[key] || ""}
                            onChange={(e) => setChargesDetailField(who, key, e.target.value)}
                            placeholder={placeholder}
                            className="rounded-xl h-8 text-sm text-right pr-6"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">€</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: BRAND.navy }}>
                    <span className="text-xs font-semibold text-white">Total charges déductibles</span>
                    <span className="text-sm font-bold text-white">{total.toLocaleString("fr-FR")} €</span>
                  </div>

                  {/* Bouton fermer */}
                  <button
                    onClick={() => setChargesDialogOpen(null)}
                    className="w-full rounded-xl py-2 text-sm font-medium transition-colors"
                    style={{ background: "rgba(81,106,199,0.1)", color: BRAND.sky }}
                  >
                    Fermer
                  </button>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* ── Dialogue export fallback ── */}
        <Dialog open={exportFallbackOpen} onOpenChange={setExportFallbackOpen}>
          <DialogContent className="max-w-4xl rounded-2xl">
            <DialogHeader><DialogTitle style={{ color: BRAND.navy }}>Sauvegarde manuelle des données</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                L'aperçu bloque l'enregistrement direct. Copie le contenu ci-dessous et enregistre-le dans un fichier nommé <strong>{exportFallbackFileName}</strong>.
              </div>
              <Button className="rounded-xl" style={{ background: BRAND.navy }} onClick={() => { void copyExportFallback(); }}>Copier le contenu</Button>
              <Textarea value={exportFallbackContent} readOnly className="min-h-[420px] rounded-xl font-mono text-xs" />
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Navigation ── */}
        <Tabs defaultValue="collecte" className="space-y-6">
          <div className="flex gap-2" style={{ alignItems: "stretch" }}>
            <TabsList className="flex-1 grid grid-cols-6 rounded-2xl p-1 shadow-lg" style={{ background: "rgba(255,255,255,0.82)", backdropFilter: "blur(10px)", height: "52px" }}>
              {(["collecte", "ir", "ifi", "succession", "hypotheses", "rapport"] as const).map((tab) => {
                const labels: Record<string, string> = { collecte: "Collecte patrimoniale", ir: "Impôt sur le revenu", ifi: "IFI", succession: "Succession", hypotheses: "Hypothèses", rapport: "Rapport client" };
                return (
                  <TabsTrigger key={tab} value={tab} className="flex items-center justify-center rounded-xl border border-transparent px-4 text-center text-slate-700 transition-all data-[state=active]:border-white/10 data-[state=active]:bg-[#26428B] data-[state=active]:text-white data-[state=active]:shadow-lg" style={{ height: "100%" }}>
                    {labels[tab]}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <TabsList className="rounded-2xl p-1 shadow-lg" style={{ background: "rgba(255,255,255,0.82)", backdropFilter: "blur(10px)", height: "52px" }}>
              <TabsTrigger value="mission" className="flex items-center justify-center rounded-xl border border-transparent px-4 text-slate-700 transition-all data-[state=active]:border-white/10 data-[state=active]:bg-[#26428B] data-[state=active]:text-white data-[state=active]:shadow-lg" style={{ height: "100%" }}>
                📋 Mission
              </TabsTrigger>
            </TabsList>
            <TabsList className="rounded-2xl p-1 shadow-lg" style={{ background: "rgba(255,255,255,0.82)", backdropFilter: "blur(10px)", height: "52px" }}>
              <TabsTrigger value="parametres" title="Paramètres cabinet" className="flex items-center justify-center rounded-xl border border-transparent px-3 text-slate-700 transition-all data-[state=active]:border-white/10 data-[state=active]:bg-[#26428B] data-[state=active]:text-white data-[state=active]:shadow-lg" style={{ height: "100%" }}>
                <Settings className="h-5 w-5" />
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ════ COLLECTE ════ */}
          <TabsContent value="collecte" className="space-y-6">
            <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
              <CardHeader><SectionTitle icon={Database} title="Collecte patrimoniale" subtitle="Données familiales, travail, revenus, immobilier et placements." /></CardHeader>
              <CardContent>
                <Tabs defaultValue="famille" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-6 rounded-2xl p-1 shadow-sm" style={{ background: `linear-gradient(90deg, ${BRAND.cream} 0%, rgba(255,255,255,0.95) 100%)` }}>
                    {["famille", "travail", "revenus", "immobilier", "placements", "credits"].map((tab) => {
                      const labels: Record<string, string> = { famille: "Données familiales", travail: "Travail", revenus: "Revenus", immobilier: "Immobilier", placements: "Placements", credits: "Crédits" };
                      return <TabsTrigger key={tab} value={tab} className="rounded-xl border border-transparent px-3 py-2 text-slate-700 transition-all data-[state=active]:bg-[#516AC7] data-[state=active]:text-white data-[state=active]:shadow-md">{labels[tab]}</TabsTrigger>;
                    })}
                  </TabsList>
                  <TabFamiliale data={data} setField={setField} addChild={addChild} updateChild={updateChild} removeChild={removeChild} person1={person1} person2={person2} />
                  <TabTravail data={data} setField={setField} setChargesDetailField={setChargesDetailField} chargesDialogOpen={chargesDialogOpen} setChargesDialogOpen={setChargesDialogOpen} irOptions={irOptions} setIrOptions={setIrOptions} ir={ir} person1={person1} person2={person2} />
                  <TabRevenus data={data} setField={setField} setData={setData} setChargesDialogOpen={setChargesDialogOpen} irOptions={irOptions} setIrOptions={setIrOptions} ir={ir} person1={person1} person2={person2} />
                  <TabImmobilier data={data} setField={setField} addProperty={addProperty} updateProperty={updateProperty} removeProperty={removeProperty} addLoan={addLoan} updateLoan={updateLoan} removeLoan={removeLoan} loanModalIndex={loanModalIndex} setLoanModalIndex={setLoanModalIndex} ownerOptions={ownerOptions} person1={person1} person2={person2} />
                  <TabPlacements data={data} placementFamily={placementFamily} setPlacementFamily={setPlacementFamily} addPlacement={addPlacement} updatePlacementStr={updatePlacementStr} updatePlacementBool={updatePlacementBool} removePlacement={removePlacement} addPlacementBeneficiary={addPlacementBeneficiary} updatePlacementBeneficiary={updatePlacementBeneficiary} removePlacementBeneficiary={removePlacementBeneficiary} importFamilyBeneficiaries={importFamilyBeneficiaries} setField={setField} setData={setData} ownerOptions={ownerOptions} ir={ir} irOptions={irOptions} person1={person1} person2={person2} />
                  <TabCredits data={data} setField={setField} setData={setData} person1={person1} person2={person2} />
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════ IR ════ */}
          <TabIR data={data} ir={ir} irOptions={irOptions} setIrOptions={setIrOptions} concubinPerson={concubinPerson} setConcubinPerson={setConcubinPerson} setChargesDialogOpen={setChargesDialogOpen} person1={person1} person2={person2} />

          {/* ════ IFI ════ */}
          <TabIFI data={data} ifi={ifi} person1={person1} person2={person2} />

          {/* ════ SUCCESSION ════ */}
          <TabSuccession
            data={data} successionData={successionData} setSuccessionData={setSuccessionData}
            succession={succession} syncCollectedHeirs={syncCollectedHeirs} getFamilyMembers={getFamilyMembers}
            importFamilyToTestament={importFamilyToTestament}
            addTestamentHeir={addTestamentHeir} updateTestamentHeir={updateTestamentHeir} removeTestamentHeir={removeTestamentHeir}
            addLegsPrecisItem={addLegsPrecisItem} addLegsPrecisItemFree={addLegsPrecisItemFree} addLegsPrecisItemResidual={addLegsPrecisItemResidual}
            updateLegsPrecisItem={updateLegsPrecisItem} removeLegsPrecisItem={removeLegsPrecisItem}
            addLegataire={addLegataire} updateLegataire={updateLegataire} removeLegataire={removeLegataire}
            addContrepartieLegataire={addContrepartieLegataire} updateContrepartieLegataire={updateContrepartieLegataire} removeContrepartieLegataire={removeContrepartieLegataire}
            addContrepartie={addContrepartie} updateContrepartie={updateContrepartie} removeContrepartie={removeContrepartie}
            addContrepartieGlobal={addContrepartieGlobal} updateContrepartieGlobal={updateContrepartieGlobal} removeContrepartieGlobal={removeContrepartieGlobal}
            addContrepartieWithBalance={addContrepartieWithBalance} removeContrepartieWithBalance={removeContrepartieWithBalance}
            legsPickerOpen={legsPickerOpen} setLegsPickerOpen={setLegsPickerOpen}
            addFamilyMemberToLegsGlobal={addFamilyMemberToLegsGlobal} addFamilyMemberToLegsPrecis={addFamilyMemberToLegsPrecis}
            loanModalIndex={loanModalIndex} setLoanModalIndex={setLoanModalIndex}
            addLoan={addLoan} updateLoan={updateLoan} removeLoan={removeLoan}
            effectiveSpouseOption={effectiveSpouseOption} spouseOptions={spouseOptions}
            person1={person1} person2={person2}
          />

          {/* ════ HYPOTHÈSES ════ */}
          <TabHypotheses
            data={data} irOptions={irOptions} successionData={successionData}
            hypotheses={hypotheses} baseSnapshot={baseSnapshot}
            ir={ir} ifi={ifi} succession={succession} baseReference={baseReference}
            renameHypothesis={renameHypothesis} updateHypothesisNotes={updateHypothesisNotes}
            updateHypothesisObjective={updateHypothesisObjective}
            saveBaseSnapshot={saveBaseSnapshot} restoreBaseSnapshot={restoreBaseSnapshot}
            saveHypothesis={saveHypothesis} loadHypothesis={loadHypothesis} clearHypothesis={clearHypothesis}
            person1={person1} person2={person2}
          />

          {/* ════ RAPPORT ════ */}
          <TabsContent value="rapport">
            <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
              <CardHeader><SectionTitle icon={FileText} title="Rapport client" subtitle="Synthèse exportable en PDF." /></CardHeader>
              <CardContent className="space-y-6">
                <Field label="Notes de synthèse">
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl min-h-[160px]" />
                </Field>
                <div className="grid gap-4 md:grid-cols-4">
                  <MetricCard label="IR estimé" value={euro(ir.finalIR)} />
                  <MetricCard label="IFI estimé" value={euro(ifi.ifi)} />
                  <MetricCard label="Droits succession" value={euro(succession.totalRights)} />
                  <MetricCard label="Actif successoral net" value={euro(succession.activeNet)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════ LETTRE DE MISSION ════ */}
          <TabMission data={data} mission={mission} updateMission={updateMission} cabinet={cabinet} logoSrc={logoSrc} signatureSrc={signatureSrc} showPdfMissionModal={() => setPdfMissionModalOpen(true)} person1={person1} person2={person2} />

          {/* ════ PARAMÈTRES CABINET ════ */}
          <TabParametres
            cabinet={cabinet} updateCabinet={updateCabinet}
            logoSrc={logoSrc} setLogoSrc={setLogoSrc}
            signatureSrc={signatureSrc} setSignatureSrc={setSignatureSrc}
            handleLogoUpload={handleLogoUpload} handleSignatureUpload={handleSignatureUpload}
          />
        </Tabs>
      </div>

      {/* ── Modal PDF Rapport ── */}
      <PdfModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        sections={pdfSections}
        setSections={setPdfSections}
        onPrint={buildAndPrintPdf}
        title="Rapport patrimonial"
        sectionLabels={[
          { key:"cabinet", label:"Présentation cabinet & démarche" },
          { key:"famille", label:"Composition familiale" },
          { key:"travail", label:"Situation professionnelle" },
          { key:"bilan", label:"Bilan patrimonial" },
          { key:"ir", label:"Impôt sur le Revenu (IR)" },
          { key:"ifi", label:`IFI${ifi.ifi <= 0 ? " (non assujetti — désactivé)" : ""}`, always: ifi.ifi <= 0 ? false : false },
          { key:"succession", label:"Succession" },
          { key:"hypos", label:"Scénarios d'optimisation" },
          { key:"mentions", label:"Notes & Mentions légales" },
        ]}
      />
      {/* ── Modal PDF Mission ── */}
      <PdfModal
        open={pdfMissionModalOpen}
        onClose={() => setPdfMissionModalOpen(false)}
        sections={pdfMissionSections}
        setSections={setPdfMissionSections}
        onPrint={buildAndPrintMission}
        title="Lettre de mission"
        sectionLabels={[
          { key:"legal", label:"Informations légales cabinet" },
          { key:"famille", label:"Composition familiale & obligations fiscales" },
          { key:"travail", label:"Situation professionnelle" },
          { key:"besoins", label:"Besoins & Objectifs" },
          { key:"bilan", label:"Bilan patrimonial" },
          { key:"ir", label:"IR — Décomposition fiscale" },
          { key:"ifi", label:`IFI${ifi.ifi <= 0 ? " (non assujetti)" : ""}` },
          { key:"succession", label:"Succession" },
          { key:"profil", label:"Profil investisseur" },
          { key:"signature", label:"Signature & Engagements" },
        ]}
      />
      <LoanModal
        loanModalIndex={loanModalIndex}
        setLoanModalIndex={setLoanModalIndex}
        data={data}
        addLoan={addLoan}
        updateLoan={updateLoan}
        removeLoan={removeLoan}
        person1={person1}
        person2={person2}
      />
    </div>
  );
}

export default function App() {
  const auth = useAuth();
  const [showTransition, setShowTransition] = useState(false);
  const [authExiting, setAuthExiting] = useState(false);
  const [showAuthScreen, setShowAuthScreen] = useState(true);
  const prevAuthState = React.useRef<string>("");

  useEffect(() => {
    if (prevAuthState.current !== "authenticated" && auth.authState === "authenticated") {
      setAuthExiting(true);
      setTimeout(() => {
        setAuthExiting(false);
        setShowAuthScreen(false);
        setShowTransition(true);
      }, 460);
    }
    if (auth.authState === "unauthenticated" || auth.authState === "expired" || auth.isPasswordRecovery) {
      setShowAuthScreen(true);
      setShowTransition(false);
      setAuthExiting(false);
    }
    prevAuthState.current = auth.authState;
  }, [auth.authState, auth.isPasswordRecovery]);

  // ── Migration Vision EcoPat → Ploutos (s'exécute une seule fois) ──
  useEffect(() => {
    // NOTE : migration cabinet déjà faite en synchrone au niveau module (migrateLegacyStorageSync)
    // Ici : migration des autres clés (clients, last_verified)

    // Clés clients
    Object.keys(localStorage)
      .filter(k => k.startsWith("ecopatrimoine_clients_"))
      .forEach(oldKey => {
        const newKey = oldKey.replace("ecopatrimoine_clients_", "ploutos_clients_");
        if (!localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, localStorage.getItem(oldKey)!);
          localStorage.removeItem(oldKey);
        }
      });
    // Clé last_verified
    const oldVerified = localStorage.getItem("ecopatrimoine_last_verified");
    if (oldVerified && !localStorage.getItem("ploutos_last_verified")) {
      localStorage.setItem("ploutos_last_verified", oldVerified);
      localStorage.removeItem("ecopatrimoine_last_verified");
    }
  }, []);

  // Cabinet raw lu tôt pour les couleurs de la transition (disponible avant userId)
  // Lecture anticipée pour les couleurs de transition — cherche dans toutes les clés cabinet
  const cabinetRawEarly = (() => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith("ploutos_cabinet_") && k.length > "ploutos_cabinet_".length);
      if (keys.length > 0) return JSON.parse(localStorage.getItem(keys[0]) || "{}");
      return JSON.parse(localStorage.getItem("ploutos_cabinet") || "{}");
    } catch { return {}; }
  })();

  // Écran de chargement pendant la vérification de session
  if (auth.authState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "radial-gradient(circle at top left, rgba(227,175,100,0.18) 0%, rgba(248,246,247,1) 34%, rgba(251,236,215,0.62) 62%, rgba(238,242,255,1) 100%)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#26428B] border-t-transparent animate-spin" />
          <div className="text-slate-400 text-sm">Vérification de la session...</div>
        </div>
      </div>
    );
  }

  if (showAuthScreen) {
    return (
      <div style={{
        opacity: authExiting ? 0 : 1,
        transform: authExiting ? "scale(1.06)" : "scale(1)",
        transition: authExiting
          ? "opacity 420ms cubic-bezier(0.4,0,0.2,1), transform 460ms cubic-bezier(0.4,0,0.2,1)"
          : "none",
      }}>
        <AuthGate
          authHook={auth}
          logoSrc={DEFAULT_LOGO_SRC}
          colorNavy={"#101B3B"}
          colorGold={"#E3AF64"}
          colorSky={"#26428B"}
          colorCream={"#FBECD7"}
        />
      </div>
    );
  }

  // Mode grace (hors-ligne mais session récente) ou authentifié → accès à l'app
  // En mode grace, auth.user est null → on récupère le userId depuis le localStorage
  const resolveUserId = (): string => {
    if (auth.user?.id) return auth.user.id;
    if (auth.authState === "grace") {
      // Chercher la clé clients la plus récente pour retrouver le userId
      try {
        const key = Object.keys(localStorage)
          .filter(k => k.startsWith("ploutos_clients_") && k.length > "ploutos_clients_".length)
          .sort((a, b) => {
            // Préférer la clé avec le plus de données
            return (localStorage.getItem(b) ?? "").length - (localStorage.getItem(a) ?? "").length;
          })[0];
        if (key) return key.replace("ploutos_clients_", "");
      } catch { /* ignore */ }
    }
    return "";
  };
  const userId = resolveUserId();

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "radial-gradient(circle at top left, rgba(227,175,100,0.18) 0%, rgba(248,246,247,1) 34%, rgba(251,236,215,0.62) 62%, rgba(238,242,255,1) 100%)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#26428B] border-t-transparent animate-spin" />
          <div className="text-slate-400 text-sm">Chargement du profil...</div>
        </div>
      </div>
    );
  }

  const cabinetRaw = (() => { try { return JSON.parse(localStorage.getItem(getCabinetKey(userId)) || localStorage.getItem("ploutos_cabinet") || "{}"); } catch { return {}; } })();

  if (showTransition) {
    return (
      <LoginTransition
        onComplete={() => setShowTransition(false)}
        colorNavy={cabinetRaw.colorNavy || "#101B3B"}
        colorGold={cabinetRaw.colorGold || "#E3AF64"}
        colorSky={cabinetRaw.colorSky || "#26428B"}
        soundSrc="/sounds/login.mp3"
        logoSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUxIiBoZWlnaHQ9IjI3NiIgdmlld0JveD0iMCAwIDI1MSAyNzYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF8xNjdfMTA0KSI+CjxwYXRoIGQ9Ik0xMDAuMjMgMjIwLjA4Qzg5LjAyMDEgMjIwLjA4IDc5LjYzMDEgMjE0Ljg3IDc0LjQ2MDEgMjA1Ljc5QzY1LjcxMDEgMTkwLjQxIDc0LjYzMDEgMTc3LjI4IDgxLjgwMDEgMTY2LjcyQzg2Ljk2MDEgMTU5LjEyIDkyLjgxMDEgMTUwLjUxIDk1LjkwMDEgMTM4LjU3Qzk3LjgwMDEgMTMxLjIyIDk3LjY0MDEgMTE3LjYxIDk2LjA4MDEgMTE5LjgyQzkzLjE0MDEgMTIzLjk4IDg3LjY2MDEgMTMxLjczIDc3LjMwMDEgMTMxLjczQzc0LjgzMDEgMTMxLjczIDcyLjM2MDEgMTMxLjI1IDY5Ljk1MDEgMTMwLjMxQzYyLjcyMDEgMTI3LjQ4IDU4Ljg0MDEgMTE5LjYxIDYwLjk4MDEgMTEyLjE2QzY0Ljc2MDEgOTkuMDIwMSA3NC44MDAxIDY0LjEyIDExMC43NyA2NC4wM0MxMTAuNzcgNjQuMDMgMjA2LjUgNjMuOCAyMDYuNTEgNjMuOEMyMTIuMjggNjMuOCAyMTcuNyA2Ny4xMTAxIDIyMC4yNCA3Mi42OTAxQzIyMS4yIDc0Ljc5MDEgMjIxLjU2IDc3LjEyMDEgMjIxLjU0IDc5LjQzTDIyMS4zNCA5OC4xN0MyMjEuMjUgMTA2LjMyIDIxNC42OSAxMTIuOTEgMjA2LjU0IDExMy4wNEwxOTAuMiAxMTMuMjlDMTg5Ljg0IDExMy4yOSAxODkuNTUgMTEzLjU3IDE4OS41MyAxMTMuOTNMMTg3LjAyIDE1Mi4xOEMxODYuNzQgMTU2LjUxIDE4OC45NiAxNjEuMTYgMTkwLjY3IDE1OC45OUMxOTMuODIgMTU0Ljk5IDE5OC43OSAxNTIuNiAyMDMuOTYgMTUyLjZDMjA5LjkyIDE1Mi42IDIxNS40IDE1NS42NyAyMTguNjEgMTYwLjgyQzIyNS4yMiAxNzEuNDEgMjE5LjYgMTg2LjA0IDIxMy45NiAxOTcuNjFDMjA3LjA1IDIxMS43NyAxOTMuMTMgMjIwLjIzIDE3Ni43MSAyMjAuMjNDMTc2LjcxIDIyMC4yMyAxMDIuMzkgMjIwLjEgMTAwLjI0IDIyMC4xTDEwMC4yMyAyMjAuMDhaIiBmaWxsPSIjMTAxQjNCIi8+CjxwYXRoIGQ9Ik0xNTYuNDkgMTAxLjM1QzE0Ny4yNSA5OS41OSAxMzguOTUgMTAwLjUyIDEyOS42NCAxMDAuODVDMTI3LjYyIDEyNi41OSAxMjUuOTEgMTY4LjU1IDExNy4zNSAxOTAuOTFDMTE1LjIxIDE5Ni41IDExMC45NyAyMDAuNDUgMTA2LjMxIDIwMS4yNEMxMDAgMjAyLjMxIDkzLjcxIDIwMC45NiA5MC40NiAxOTUuMjVDODMuMTUgMTgyLjQxIDEwNC41NiAxNzEuNTggMTEyLjEzIDE0Mi4zMUMxMTUuNjUgMTI4LjcgMTE3LjIyIDExNS4zOSAxMTguMTIgMTAxLjI4Qzg2LjAzIDk1LjMyIDg4LjU3IDEyMS40NSA3OS4wMyAxMTcuNzJDODQuMDMgMTAwLjMzIDkxLjkxIDgyLjU3IDExMi40NiA4Mi41MkwyMDIuOSA4Mi4zTDIwMi43IDEwMC40MkwxNzMuNTcgMTAwLjg2TDE3MC4zIDE1MC42N0MxNjkuNzggMTU4LjUyIDE2OS44NiAxNjYuNSAxNzIuMTMgMTc0LjAyQzE3NC4wMyAxODAuMzIgMTgwLjQ2IDE4Mi4zNCAxODYuMyAxODEuODdDMTk3LjU0IDE4MC45NiAxOTguNjcgMTY2LjcyIDE5OC44OSAxNjcuNjNDMTk4LjI4IDE2NS4xMiAyMDkuNSAxNjMuMDIgMTk3LjE3IDE4OC4zMUMxOTIuNzQgMTk3LjM5IDE4NC4yMSAyMDEuODQgMTc0LjMgMjAxLjdDMTU5Ljk5IDIwMS41MSAxNTAuMzcgMTkxIDE1MC42NCAxNzYuNEMxNTEuMDkgMTUxLjY1IDE1NC41MSAxMjcuODcgMTU2LjUxIDEwMS4zNkwxNTYuNDkgMTAxLjM1WiIgZmlsbD0iI0Y4RjZGNyIvPgo8cGF0aCBkPSJNMTE0Ljk5IDI2Mi45OEM4NC4wNCAyNTcuMSA1Ni43NiAyNDAuMTkgMzcuNjggMjE0Ljg2QzE3LjM0IDE4Ny44NyA4LjczMDAyIDE1NC41NyAxMy40MyAxMjEuMUMxOC4xMyA4Ny42MyAzNS41OSA1OCA2Mi41OCAzNy42NUM4OC4zMSAxOC4yNiAxMTkuNzcgOS41Mzk5NiAxNTEuNjUgMTIuODRDMTUzLjIxIDEzIDE1NC43OCAxMy4xOCAxNTYuMzQgMTMuNEMxODkuODEgMTguMSAyMTkuNDQgMzUuNTYgMjM5Ljc5IDYyLjU1TDI0Ny43MiA1Ni41OEMyMjUuMDQgMjYuNDkgMTkyLjMxIDguNDI5OTYgMTU3LjczIDMuNTY5OTZDMTU2LjE3IDMuMzQ5OTYgMTU0LjYxIDMuMTY5OTYgMTUzLjA0IDIuOTk5OTZDMTE5Ljg2IC0wLjUwMDA0NSA4NS4zNCA4LjA2OTk2IDU2LjYgMjkuNzJDLTMuNTg5OTggNzUuMDggLTE1LjYxIDE2MC42NCAyOS43NCAyMjAuODNDNTEuMDcgMjQ5LjE0IDgxLjMxIDI2Ni43OCAxMTMuNjEgMjcyLjgyTDExNC45OCAyNjIuOThIMTE0Ljk5WiIgZmlsbD0iIzEwMUIzQiIvPgo8cGF0aCBkPSJNNDAuNyAyMzYuODRDMzYuMTQgMjMyLjI4IDMxLjg4IDIyNy4zOCAyNy45NSAyMjIuMTdDNS42NjAwMSAxOTIuNTkgLTMuNzc5OTkgMTU2LjA5IDEuMzgwMDEgMTE5LjRDNi41MzAwMSA4Mi43MSAyNS42NyA1MC4yMyA1NS4yNSAyNy45M0M4My40MSA2LjcyMDAxIDExOC4yMSAtMi45Mjk5OSAxNTMuMjYgMC43ODAwMTRDMTU1LjA3IDAuOTcwMDE0IDE1Ni41OSAxLjE1MDAxIDE1OC4wMyAxLjM2MDAxQzE5NC43MiA2LjUyMDAxIDIyNy4yIDI1LjY1IDI0OS41IDU1LjI0TDI1MC44NSA1Ny4wM0wyMzkuMzUgNjUuN0wyMzggNjMuOTFDMjE4LjAyIDM3LjQgMTg4LjkxIDIwLjI1IDE1Ni4wMyAxNS42M0MxNTQuNjUgMTUuNDQgMTUzLjE0IDE1LjI1IDE1MS40MiAxNS4wOEMxMjAuMTUgMTEuODQgODkuMDggMjAuNSA2My45MyAzOS40NUMzNy40MiA1OS40MyAyMC4yNyA4OC41NCAxNS42NSAxMjEuNDJDMTEuMDMgMTU0LjMgMTkuNDkgMTg3LjAxIDM5LjQ3IDIxMy41MkM1OC4xIDIzOC4yNCA4NS4wNyAyNTUuMDMgMTE1LjQxIDI2MC43OUwxMTcuNTEgMjYxLjE5TDExNS41MiAyNzUuNDZMMTEzLjIxIDI3NS4wM0M4NS41MyAyNjkuODUgNjAuMzcgMjU2LjUxIDQwLjcxIDIzNi44Nkw0MC43IDIzNi44NFpNMjMzLjQ1IDQzLjU4QzIxMi45OSAyMy4xMiAxODYuNTcgOS44OTAwMSAxNTcuNCA1Ljc5MDAxQzE1Ni4wMSA1LjYwMDAxIDE1NC41NSA1LjQyMDAxIDE1Mi43OSA1LjIzMDAxQzExOC44NyAxLjY1MDAxIDg1LjE5IDEwLjk4IDU3Ljk1IDMxLjUxQzI5LjMyIDUzLjA5IDEwLjggODQuNTIgNS44MTAwMSAxMjAuMDJDMC44MjAwMDkgMTU1LjUyIDkuOTUwMDEgMTkwLjg0IDMxLjUzIDIxOS40N0M1MS4yNiAyNDUuNjUgNzkuNjYgMjYzLjU4IDExMS43MiAyNzAuMTVMMTEyLjQ3IDI2NC43NUM4MS44OCAyNTguNDIgNTQuNzUgMjQxLjIzIDM1Ljg4IDIxNi4xOUMxNS4xOCAxODguNzIgNi40MjAwMSAxNTQuODMgMTEuMiAxMjAuNzdDMTUuOTkgODYuNzEgMzMuNzUgNTYuNTUgNjEuMjIgMzUuODVDODcuMjggMTYuMjEgMTE5LjQ3IDcuMjUwMDEgMTUxLjg3IDEwLjZDMTUzLjY1IDEwLjc4IDE1NS4yMSAxMC45NyAxNTYuNjUgMTEuMTdDMTg5Ljk3IDE1Ljg1IDIxOS41NiAzMi45NSAyNDAuMjEgNTkuNDJMMjQ0LjU2IDU2LjE0QzI0MS4wOSA1MS42OSAyMzcuMzggNDcuNSAyMzMuNDYgNDMuNTdMMjMzLjQ1IDQzLjU4WiIgZmlsbD0iIzEwMUIzQiIvPgo8cGF0aCBkPSJNMjA2LjczIDQ5LjQ5OTlDMjE5LjI4OSA0OS40OTk5IDIyOS40NyAzOS4zMTg5IDIyOS40NyAyNi43NTk5QzIyOS40NyAxNC4yMDA5IDIxOS4yODkgNC4wMTk5IDIwNi43MyA0LjAxOTlDMTk0LjE3MSA0LjAxOTkgMTgzLjk5IDE0LjIwMDkgMTgzLjk5IDI2Ljc1OTlDMTgzLjk5IDM5LjMxODkgMTk0LjE3MSA0OS40OTk5IDIwNi43MyA0OS40OTk5WiIgZmlsbD0iI0UzQUY2NCIvPgo8cGF0aCBkPSJNMjI0LjI2IDkuMTk5OTVMMjE3LjkyIDE1LjUzOTlDMjIxLjQ4IDE5LjA5OTkgMjIzLjEyIDIzLjk4OTkgMjIyLjQyIDI4Ljk1OTlDMjIxLjIgMzcuNjA5OSAyMTMuMTcgNDMuNjYgMjA0LjUyIDQyLjQ1QzIwMS4wOCA0MS45NyAxOTcuOTggNDAuNDE5OSAxOTUuNTMgMzcuOTc5OUMxOTEuOTcgMzQuNDE5OSAxOTAuMzMgMjkuNTI5OSAxOTEuMDMgMjQuNTQ5OUMxOTIuMjUgMTUuODk5OSAyMDAuMjggOS44NDk5NSAyMDguOTMgMTEuMDU5OUMyMTIuMzcgMTEuNTM5OSAyMTUuNDcgMTMuMDg5OSAyMTcuOTIgMTUuNTI5OUwyMjQuMjYgOS4xODk5NU0yMjQuMjYgOS4xOTk5NUMyMjAuNTggNS41MTk5NSAyMTUuNzMgMi45Njk5NSAyMTAuMTggMi4xODk5NUMxOTYuNjEgMC4yNzk5NDkgMTg0LjA2IDkuNzM5OTUgMTgyLjE2IDIzLjMwOTlDMTgxLjAzIDMxLjMzOTkgMTgzLjg4IDM5IDE4OS4yIDQ0LjMyQzE5Mi44OCA0OCAxOTcuNzMgNTAuNTUgMjAzLjI4IDUxLjMzQzIxNi44NSA1My4yNCAyMjkuNCA0My43Nzk5IDIzMS4zIDMwLjIwOTlDMjMyLjQzIDIyLjE3OTkgMjI5LjU4IDE0LjUxOTkgMjI0LjI2IDkuMTk5OTVaIiBmaWxsPSIjMTAxQjNCIi8+CjwvZz4KPGRlZnM+CjxjbGlwUGF0aCBpZD0iY2xpcDBfMTY3XzEwNCI+CjxyZWN0IHdpZHRoPSIyNTAuODUiIGhlaWdodD0iMjc1LjQ1IiBmaWxsPSJ3aGl0ZSIvPgo8L2NsaXBQYXRoPgo8L2RlZnM+Cjwvc3ZnPgo="
      />
    );
  }

  return <AppInner userId={userId} userEmail={auth.user?.email ?? ""} authState={auth.authState} onSignOut={auth.signOut} />;
}
