import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { useAuth } from "../hooks/useAuth";




type AuthGateProps = {
  authHook: ReturnType<typeof useAuth>;
  logoSrc: string;
  colorNavy: string;
  colorGold: string;
  colorSky: string;
  colorCream: string;
};

type Mode = "login" | "register" | "forgot" | "reset";

export function AuthGate({ authHook, logoSrc, colorNavy, colorGold, colorSky, colorCream }: AuthGateProps) {
  const { authState, error, signIn, signUp, resetPassword, updatePassword, isPasswordRecovery, clearPasswordRecovery } = authHook;
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cabinetName, setCabinetName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [localError, setLocalError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Basculer en mode reset quand Supabase détecte un lien de récupération
  React.useEffect(() => {
    if (isPasswordRecovery) {
      setMode("reset");
    }
  }, [isPasswordRecovery]);

  const displayError = localError || error;

  const handleLogin = async () => {
    setLocalError("");
    setLoading(true);
    await signIn(email, password);
    setLoading(false);
  };

  const handleRegister = async () => {
    setLocalError("");
    if (!cabinetName.trim()) { setLocalError("Veuillez saisir le nom de votre cabinet."); return; }
    if (password.length < 8) { setLocalError("Le mot de passe doit faire au moins 8 caractères."); return; }
    if (password !== confirmPassword) { setLocalError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    const ok = await signUp(email, password, cabinetName);
    setLoading(false);
    if (ok) {
      // Détecter Mac pour envoyer les instructions de lancement spécifiques
      const isMac = typeof navigator !== "undefined" &&
        (navigator.platform?.toLowerCase().includes("mac") ||
         navigator.userAgent?.toLowerCase().includes("macintosh"));
      const emailType = isMac ? "welcome_trial_mac" : "welcome_trial";
      // Fire-and-forget — ne bloque pas l UI si la fonction échoue
      fetch("https://ysbgfiqsuvdwzkcsiqir.supabase.co/functions/v1/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, type: emailType, cabinet_name: cabinetName }),
      }).catch(() => {});
      setSuccessMsg("Compte créé ! Vérifiez votre email pour confirmer votre inscription.");
      setMode("login");
    }
  };

  const handleReset = async () => {
    setLocalError("");
    if (newPassword.length < 8) { setLocalError("Le mot de passe doit faire au moins 8 caractères."); return; }
    if (newPassword !== confirmNewPassword) { setLocalError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    try {
      const ok = await updatePassword(newPassword);
      setLoading(false);
      if (ok) {
        setSuccessMsg("Mot de passe mis à jour ! Vous pouvez vous connecter.");
        clearPasswordRecovery();
        window.history.replaceState(null, "", window.location.pathname);
        setTimeout(() => setMode("login"), 2000);
      }
    } catch {
      setLoading(false);
      setLocalError("Erreur lors de la mise à jour. Réessayez.");
    }
  };

  const handleForgot = async () => {
    setLocalError("");
    if (!email) { setLocalError("Entrez votre email."); return; }
    setLoading(true);
    const ok = await resetPassword(email);
    setLoading(false);
    if (ok) setSuccessMsg("Email de réinitialisation envoyé !");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{
      background: "linear-gradient(135deg, #f5f0e8 0%, #fdf8f0 40%, #f0ece4 100%)",
      position: "relative", overflow: "hidden"
    }}>

      {/* ── Formes géométriques abstraites ── */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", top:"-120px", left:"-100px", width:"480px", height:"480px",
          borderRadius:"50%", background:"#101B3B", opacity:0.14, animation:"float1 14s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:0, right:"60px", width:"8px", height:"100%",
          background:"linear-gradient(180deg, transparent 0%, #E3AF64 30%, #E3AF64 70%, transparent 100%)", opacity:0.3 }} />
        <div style={{ position:"absolute", top:"-20px", left:"32%", width:"240px", height:"110px",
          borderRadius:"24px", background:"#E3AF64", opacity:0.20, transform:"rotate(-14deg)",
          animation:"float2 11s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:"80px", right:"-60px", width:"300px", height:"300px",
          borderRadius:"32px", background:"#26428B", opacity:0.16, transform:"rotate(22deg)",
          animation:"float3 16s ease-in-out infinite" }} />
        <div style={{ position:"absolute", bottom:"-80px", right:"40px", width:"380px", height:"380px",
          borderRadius:"50%", background:"#E3AF64", opacity:0.18, animation:"float4 13s ease-in-out infinite" }} />
        <div style={{ position:"absolute", bottom:"60px", left:"-50px", width:"300px", height:"140px",
          borderRadius:"20px", background:"#101B3B", opacity:0.13, transform:"rotate(-10deg)",
          animation:"float5 12s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:"42%", left:"4%", width:"180px", height:"180px",
          borderRadius:"50%", background:"#26428B", opacity:0.13, animation:"float2 9s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:"160px", left:"22%", width:"90px", height:"90px",
          borderRadius:"16px", background:"#E3AF64", opacity:0.25, transform:"rotate(30deg)",
          animation:"float3 10s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:"20px", right:"18%", width:"180px", height:"70px",
          borderRadius:"18px", background:"#26428B", opacity:0.15, transform:"rotate(10deg)",
          animation:"float1 15s ease-in-out infinite" }} />
        <div style={{ position:"absolute", bottom:"18%", left:"38%", width:"220px", height:"220px",
          borderRadius:"50%", background:"#101B3B", opacity:0.09, animation:"float4 11s ease-in-out infinite" }} />
        <div style={{ position:"absolute", bottom:"100px", left:"28%", width:"110px", height:"110px",
          borderRadius:"20px", background:"#E3AF64", opacity:0.20, transform:"rotate(-25deg)",
          animation:"float5 13s ease-in-out infinite" }} />
      </div>

      <style>{`
        @keyframes float1 { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-22px)} }
        @keyframes float2 { 0%,100%{transform:translateY(0px) rotate(-14deg)} 50%{transform:translateY(-16px) rotate(-14deg)} }
        @keyframes float3 { 0%,100%{transform:translateY(0px) rotate(22deg)} 50%{transform:translateY(14px) rotate(22deg)} }
        @keyframes float4 { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-24px)} }
        @keyframes float5 { 0%,100%{transform:translateY(0px) rotate(-10deg)} 50%{transform:translateY(18px) rotate(-10deg)} }
      `}</style>

      {/* Logo + titre */}
      <div className="flex flex-col items-center mb-8 gap-3" style={{ position:"relative", zIndex:1 }}>
        <img src={logoSrc} alt="Logo Ploutos" style={{
          height:"90px", width:"90px", objectFit:"contain",
          filter:"drop-shadow(0 4px 18px rgba(16,27,59,0.18))",
        }} />
        <div className="text-center">
          <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQ0IiBoZWlnaHQ9IjEzMyIgdmlld0JveD0iMCAwIDY0NCAxMzMiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik00NS4zMTAxIDY1LjQ1QzQ5LjgxMDEgNjQuMDMgNTMuNTcwMSA2Mi4wNSA1Ni42MDAxIDU5LjUxQzU5LjYzMDEgNTYuOTcgNjEuOTEwMSA1My45NCA2My40NTAxIDUwLjQxQzY0Ljk5MDEgNDYuODggNjUuNzUwMSA0Mi45OSA2NS43NTAxIDM4Ljc1QzY1Ljc1MDEgMzQuNTEgNjUuMDMwMSAzMC43OCA2My41ODAxIDI3LjMzQzYyLjEzMDEgMjMuODkgNTkuOTIwMSAyMC45NCA1Ni45NjAxIDE4LjQ4QzU0LjAwMDEgMTYuMDMgNTAuMjQwMSAxNC4xMiA0NS43MDAxIDEyLjc2QzQxLjE2MDEgMTEuNCAzNS43OTAxIDEwLjcyIDI5LjYwMDEgMTAuNzJIMC4xMTAxMDdWOTkuODNIMTUuNTEwMVY2Ny41OUgyOS42MDAxQzM1LjU3MDEgNjcuNTkgNDAuODAwMSA2Ni44OCA0NS4zMDAxIDY1LjQ2TDQ1LjMxMDEgNjUuNDVaTTE1LjUyMDEgMjIuMDRIMjkuNjEwMUMzMy4xMjAxIDIyLjA0IDM2LjE4MDEgMjIuNDIgMzguNzkwMSAyMy4xOEM0MS40MDAxIDIzLjk0IDQzLjU2MDEgMjUuMDUgNDUuMjcwMSAyNi40OUM0Ni45ODAxIDI3LjkzIDQ4LjI3MDEgMjkuNjkgNDkuMTIwMSAzMS43NUM0OS45NzAxIDMzLjgxIDUwLjQwMDEgMzYuMTQgNTAuNDAwMSAzOC43NEM1MC40MDAxIDQxLjM0IDQ5Ljk2MDEgNDMuNzcgNDkuMDgwMSA0NS45MkM0OC4yMDAxIDQ4LjA3IDQ2Ljg5MDEgNDkuODkgNDUuMTYwMSA1MS40QzQzLjQzMDEgNTIuOTEgNDEuMjYwMSA1NC4wNyAzOC42NDAxIDU0LjlDMzYuMDMwMSA1NS43MyAzMy4wMTAxIDU2LjE0IDI5LjU5MDEgNTYuMTRIMTUuNTAwMVYyMi4wNEgxNS41MjAxWiIgZmlsbD0iIzEwMUIzQiIvPgo8cGF0aCBkPSJNMTM1LjI3IDg3LjY4OTlIOTUuOVYxMC43MUg4MC41Vjk5LjgxOTlIMTM1LjI3Vjg3LjY4OTlaIiBmaWxsPSIjMTAxQjNCIi8+CjxwYXRoIGQ9Ik0zMTguOTQgOTAuNTlDMzIyLjI4IDkzLjgzIDMyNi4zMyA5Ni4zNyAzMzEuMSA5OC4yMUMzMzUuODcgMTAwLjA1IDM0MS4yNCAxMDAuOTcgMzQ3LjIxIDEwMC45N0MzNTMuMTggMTAwLjk3IDM1OC41NSAxMDAuMDUgMzYzLjMyIDk4LjIxQzM2OC4wOSA5Ni4zNyAzNzIuMTQgOTMuODMgMzc1LjQ4IDkwLjU5QzM3OC44MiA4Ny4zNSAzODEuMzggODMuNDk5OSAzODMuMTYgNzkuMDM5OUMzODQuOTQgNzQuNTc5OSAzODUuODMgNjkuNzI5OSAzODUuODMgNjQuNDc5OVYxMC43MUgzNzAuNDdWNjQuNDc5OUMzNzAuNDcgNjguMDI5OSAzNjkuOTQgNzEuMjYgMzY4Ljg5IDc0LjE3QzM2Ny44NCA3Ny4wOCAzNjYuMzEgNzkuNTcgMzY0LjMxIDgxLjY0QzM2Mi4zMSA4My43MSAzNTkuODcgODUuMzIgMzU3IDg2LjQ3QzM1NC4xMiA4Ny42MyAzNTAuODYgODguMiAzNDcuMjEgODguMkMzNDMuNTYgODguMiAzNDAuMyA4Ny42MiAzMzcuNDIgODYuNDdDMzM0LjU0IDg1LjMxIDMzMi4xMSA4My42ODk5IDMzMC4xNCA4MS42MDk5QzMyOC4xNyA3OS41Mjk5IDMyNi42NSA3Ny4wMjk5IDMyNS41OSA3NC4xMTk5QzMyNC41MyA3MS4yMDk5IDMyNC4wMSA2Ny45Nzk5IDMyNC4wMSA2NC40Mjk5VjEwLjcxOTlIMzA4LjU5VjY0LjQ5QzMwOC41OSA2OS43MyAzMDkuNDggNzQuNTg5OSAzMTEuMjYgNzkuMDQ5OUMzMTMuMDQgODMuNTA5OSAzMTUuNiA4Ny4zNiAzMTguOTQgOTAuNlY5MC41OVoiIGZpbGw9IiMxMDFCM0IiLz4KPHBhdGggZD0iTTQyNy42IDk5LjkxOTlINDQyLjk2VjIyLjc4OTlINDcyLjU1VjEwLjcxSDM5Ny45NVYyMi43ODk5SDQyNy42Vjk5LjkxOTlaIiBmaWxsPSIjMTAxQjNCIi8+CjxwYXRoIGQ9Ik02NDEuNDQgNjIuOTlDNjQwLjE3IDYwLjQzIDYzOC40OSA1OC4yNiA2MzYuNCA1Ni40OUM2MzQuMzEgNTQuNzEgNjMxLjkzIDUzLjI0OTkgNjI5LjI1IDUyLjA4OTlDNjI2LjU3IDUwLjkyOTkgNjIzLjg0IDQ5LjkgNjIxLjA1IDQ4Ljk5QzYxOC4yNiA0OC4wOCA2MTUuNTMgNDcuMjIgNjEyLjg1IDQ2LjQyQzYxMC4xNyA0NS42MSA2MDcuNzkgNDQuNjc5OSA2MDUuNyA0My41OTk5QzYwMy42MSA0Mi41Mjk5IDYwMS45MyA0MS4yNCA2MDAuNjYgMzkuNzI5OUM1OTkuMzggMzguMjE5OSA1OTguNzUgMzYuMzI5OSA1OTguNzUgMzQuMDU5OUM1OTguNzUgMzIuMjc5OSA1OTkuMDkgMzAuNjQgNTk5Ljc3IDI5LjE0QzYwMC40NSAyNy42MyA2MDEuNDcgMjYuMzIgNjAyLjgzIDI1LjIxQzYwNC4xOSAyNC4xIDYwNS44NyAyMy4yMyA2MDcuODcgMjIuNjFDNjA5Ljg3IDIxLjk5IDYxMi4xOSAyMS42Nzk5IDYxNC44MiAyMS42Nzk5QzYxNy42NyAyMS42Nzk5IDYyMC4xMyAyMi4wMiA2MjIuMiAyMi43QzYyNC4yNiAyMy4zOCA2MjYuMDUgMjQuMTI5OSA2MjcuNTcgMjQuOTI5OUM2MjkuMDkgMjUuNzM5OSA2MzAuMzYgMjYuNDY5OSA2MzEuMzkgMjcuMTI5OUM2MzIuNDIgMjcuNzg5OSA2MzMuMzYgMjguMTE5OSA2MzQuMTkgMjguMTE5OUM2MzQuOTggMjguMTE5OSA2MzUuNjQgMjcuOTQ5OSA2MzYuMTcgMjcuNTg5OUM2MzYuNyAyNy4yMzk5IDYzNy4yIDI2LjY5IDYzNy42OSAyNS45NUw2NDEuNDQgMTkuMDA5OUM2MzguMTUgMTYuMDM5OSA2MzQuMjIgMTMuNzQ5OSA2MjkuNjggMTIuMTI5OUM2MjUuMTMgMTAuNTE5OSA2MjAuMTMgOS43MDk5NiA2MTQuNjkgOS43MDk5NkM2MDkuODUgOS43MDk5NiA2MDUuNTUgMTAuNDA5OSA2MDEuNzcgMTEuODE5OUM1OTcuOTkgMTMuMjE5OSA1OTQuODIgMTUuMDg5OSA1OTIuMjUgMTcuNDI5OUM1ODkuNjggMTkuNzU5OSA1ODcuNzIgMjIuNDQgNTg2LjM4IDI1LjQ1QzU4NS4wNCAyOC40NyA1ODQuMzcgMzEuNTggNTg0LjM3IDM0LjhDNTg0LjM3IDM4Ljg1IDU4NS4wMSA0Mi4yMTk5IDU4Ni4yOCA0NC45Mjk5QzU4Ny41NiA0Ny42Mzk5IDU4OS4yNCA0OS45MSA1OTEuMzIgNTEuNzRDNTkzLjQxIDUzLjU4IDU5NS43OSA1NS4wNyA1OTguNDcgNTYuMkM2MDEuMTUgNTcuMzQgNjAzLjg4IDU4LjMzIDYwNi42NCA1OS4xN0M2MDkuNDEgNjAuMDIgNjEyLjEzIDYwLjgwOTkgNjE0LjgxIDYxLjU1OTlDNjE3LjQ5IDYyLjI5OTkgNjE5Ljg3IDYzLjIwOTkgNjIxLjk2IDY0LjI4OTlDNjI0LjA0IDY1LjM2OTkgNjI1LjczIDY2LjY5OTkgNjI3IDY4LjI4OTlDNjI4LjI3IDY5Ljg3OTkgNjI4LjkxIDcxLjk0IDYyOC45MSA3NC40NUM2MjguOTEgNzguOTUgNjI3LjM4IDgyLjQ3OTkgNjI0LjMzIDg1LjAzOTlDNjIxLjI4IDg3LjU5OTkgNjE2Ljk2IDg4Ljg3OTkgNjExLjM4IDg4Ljg3OTlDNjA3Ljk1IDg4Ljg3OTkgNjA1LjAxIDg4LjQzOTkgNjAyLjU1IDg3LjU0OTlDNjAwLjA5IDg2LjY1OTkgNTk3Ljk5IDg1LjY5IDU5Ni4yNiA4NC42NEM1OTQuNTIgODMuNTkgNTkzLjA0IDgyLjYxOTkgNTkxLjgxIDgxLjcyOTlDNTkwLjU4IDgwLjgzOTkgNTg5LjQ2IDgwLjQgNTg4LjQ1IDgwLjRDNTg3LjcgODAuNCA1ODcuMDIgODAuNTcgNTg2LjQxIDgwLjlDNTg1LjggODEuMjMgNTg1LjI5IDgxLjY3OTkgNTg0Ljg5IDgyLjI1OTlMNTgwLjQxIDg5LjJDNTgyLjIxIDkwLjk3OTkgNTg0LjI2IDkyLjU5IDU4Ni41NCA5NC4wM0M1ODguODIgOTUuNDggNTkxLjI3IDk2LjcgNTkzLjg5IDk3LjcyQzU5Ni41IDk4LjczIDU5OS4yNSA5OS41MTk5IDYwMi4xMyAxMDAuMDdDNjA1LjAxIDEwMC42MyA2MDcuOTYgMTAwLjkgNjEwLjk5IDEwMC45QzYxNi4xMyAxMDAuOSA2MjAuNzEgMTAwLjE2IDYyNC43MyA5OC42Njk5QzYyOC43NSA5Ny4xNzk5IDYzMi4xMyA5NS4xNDk5IDYzNC44OCA5Mi41Njk5QzYzNy42MyA4OS45ODk5IDYzOS43MiA4Ni45NTk5IDY0MS4xOCA4My40ODk5QzY0Mi42MyA4MC4wMTk5IDY0My4zNSA3Ni4yOTk5IDY0My4zNSA3Mi4zMzk5QzY0My4zNSA2OC42Njk5IDY0Mi43MSA2NS41NSA2NDEuNDQgNjIuOTlaIiBmaWxsPSIjMTAxQjNCIi8+CjxwYXRoIGQ9Ik0yNjYuNDMgMTE4LjNDMjY2LjkgMTE3Ljg1IDI2Ny4zOCAxMTcuNCAyNjcuODMgMTE2LjkzQzI3My42NiAxMTAuOTEgMjc4LjE4IDEwMy43NCAyODEuMzkgOTUuNDFDMjg0LjYgODcuMDggMjg2LjIgNzcuOTggMjg2LjIgNjguMTFDMjg2LjIgNTguMjQgMjg0LjU5IDQ5LjE0IDI4MS4zOSA0MC44MUMyNzguMTggMzIuNDggMjczLjY2IDI1LjMgMjY3LjgzIDE5LjI1QzI2MiAxMy4yIDI1NSA4LjQ4IDI0Ni44MiA1LjA5QzIzOC42NCAxLjcgMjI5LjU2IDAgMjE5LjU2IDBDMjA5LjU2IDAgMjAwLjU3IDEuNyAxOTIuNCA1LjA5QzE4NC4yMyA4LjQ4IDE3Ny4yMSAxMy4yIDE3MS4zNCAxOS4yNUMxNjUuNDggMjUuMyAxNjAuOTQgMzIuNDggMTU3Ljc0IDQwLjgxQzE1NC41MyA0OS4xNCAxNTIuOTMgNTguMjQgMTUyLjkzIDY4LjExQzE1Mi45MyA3Ny45OCAxNTQuNTQgODcuMDggMTU3Ljc0IDk1LjQxQzE2MC45NSAxMDMuNzQgMTY1LjQ4IDExMC45MSAxNzEuMzQgMTE2LjkzQzE3MS44IDExNy40IDE3Mi4yOCAxMTcuODUgMTcyLjc1IDExOC4zSDBWMTMyLjI0SDE5OS4xOVYxMTguM0wxOTcuNTYgMTE4LjA3QzE5Mi4yMyAxMTUuNjMgMTg3LjYgMTEyLjMyIDE4My43MiAxMDguMUMxNzkuNDMgMTAzLjQzIDE3Ni4xMiA5Ny43MyAxNzMuODEgOTAuOTlDMTcxLjUgODQuMjUgMTcwLjM0IDc2LjYyIDE3MC4zNCA2OC4xMUMxNzAuMzQgNTkuNiAxNzEuNSA1Mi4wNyAxNzMuODEgNDUuMzNDMTc2LjEyIDM4LjU5IDE3OS40MyAzMi44NyAxODMuNzIgMjguMTdDMTg4LjAxIDIzLjQ3IDE5My4xOCAxOS44NiAxOTkuMjQgMTcuMzRDMjA1LjMgMTQuODIgMjEyLjA4IDEzLjU2IDIxOS41NyAxMy41NkMyMjcuMDYgMTMuNTYgMjMzLjk0IDE0LjgyIDI0MCAxNy4zNEMyNDYuMDYgMTkuODYgMjUxLjIyIDIzLjQ3IDI1NS40OCAyOC4xN0MyNTkuNzQgMzIuODcgMjYzIDM4LjU5IDI2NS4yOSA0NS4zM0MyNjcuNTcgNTIuMDcgMjY4LjcxIDU5LjY3IDI2OC43MSA2OC4xMUMyNjguNzEgNzYuNTUgMjY3LjU3IDg0LjI1IDI2NS4yOSA5MC45OUMyNjMgOTcuNzMgMjU5Ljc0IDEwMy40NCAyNTUuNDggMTA4LjFDMjUxLjUzIDExMi40MyAyNDYuNzggMTE1LjgxIDI0MS4yNyAxMTguMjdMMjQxLjA1IDExOC4zVjEzMi4yNEg2NDEuNDZWMTE4LjNIMjY2LjQ1SDI2Ni40M1oiIGZpbGw9IiMxMDFCM0IiLz4KPHBhdGggZD0iTTQ4OS40MSA4Ny45OUM0OTMuNTggOTIuMDIgNDk4LjU4IDk1LjE3IDUwNC40IDk3LjQ0QzUxMC4yMiA5OS43MSA1MTYuNjcgMTAwLjg1IDUyMy43NCAxMDAuODVDNTMwLjgxIDEwMC44NSA1MzcuMzMgOTkuNzEgNTQzLjE1IDk3LjQ0QzU0OC45NyA5NS4xNyA1NTMuOTYgOTIuMDIgNTU4LjExIDg3Ljk5QzU2Mi4yNiA4My45NiA1NjUuNDggNzkuMTYgNTY3Ljc2IDczLjU5QzU3MC4wNCA2OC4wMSA1NzEuMTkgNjEuOTIgNTcxLjE5IDU1LjMyQzU3MS4xOSA0OC43MiA1NzAuMDUgNDIuNjIgNTY3Ljc2IDM3LjA1QzU2NS40OCAzMS40OCA1NjIuMjYgMjYuNjcgNTU4LjExIDIyLjYyQzU1My45NiAxOC41NyA1NDguOTcgMTUuNDEgNTQzLjE1IDEzLjE0QzUzNy4zMyAxMC44NyA1MzAuODYgOS43Mjk5OCA1MjMuNzQgOS43Mjk5OEM1MTYuNjIgOS43Mjk5OCA1MTAuMjIgMTAuODcgNTA0LjQgMTMuMTRDNDk4LjU4IDE1LjQxIDQ5My41OCAxOC41NyA0ODkuNDEgMjIuNjJDNDg1LjI0IDI2LjY3IDQ4Mi4wMSAzMS40OCA0NzkuNzIgMzcuMDVDNDc3LjQ0IDQyLjYzIDQ3Ni4yOSA0OC43MiA0NzYuMjkgNTUuMzJDNDc2LjI5IDYxLjkyIDQ3Ny40MyA2OC4wMiA0NzkuNzIgNzMuNTlDNDgyIDc5LjE3IDQ4NS4yMyA4My45NyA0ODkuNDEgODcuOTlaTTQ5NC4yMiA0MS41QzQ5NS43MSAzNy40MSA0OTcuODUgMzMuOTQgNTAwLjYxIDMxLjA5QzUwMy4zOCAyOC4yNCA1MDYuNzEgMjYuMDUgNTEwLjYyIDI0LjUyQzUxNC41MyAyMi45OSA1MTguOSAyMi4yMyA1MjMuNzMgMjIuMjNDNTI4LjU2IDIyLjIzIDUzMyAyMi45OSA1MzYuOTEgMjQuNTJDNTQwLjgyIDI2LjA1IDU0NC4xNSAyOC4yNCA1NDYuODkgMzEuMDlDNTQ5LjY0IDMzLjk0IDU1MS43NCAzNy40MSA1NTMuMjIgNDEuNUM1NTQuNjkgNDUuNTkgNTU1LjQzIDUwLjE5IDU1NS40MyA1NS4zMUM1NTUuNDMgNjAuNDMgNTU0LjY5IDY1LjEgNTUzLjIyIDY5LjE5QzU1MS43NSA3My4yOCA1NDkuNjQgNzYuNzQgNTQ2Ljg5IDc5LjU3QzU0NC4xNSA4Mi40IDU0MC44MiA4NC41NyA1MzYuOTEgODYuMDdDNTMzIDg3LjU4IDUyOC42MSA4OC4zMyA1MjMuNzMgODguMzNDNTE4Ljg1IDg4LjMzIDUxNC41MyA4Ny41OCA1MTAuNjIgODYuMDdDNTA2LjcxIDg0LjU2IDUwMy4zNyA4Mi4zOSA1MDAuNjEgNzkuNTdDNDk3Ljg0IDc2Ljc0IDQ5NS43MSA3My4yOCA0OTQuMjIgNjkuMTlDNDkyLjczIDY1LjEgNDkxLjk4IDYwLjQ4IDQ5MS45OCA1NS4zMUM0OTEuOTggNTAuMTQgNDkyLjczIDQ1LjU4IDQ5NC4yMiA0MS41WiIgZmlsbD0iIzEwMUIzQiIvPgo8L3N2Zz4K" alt="Ploutos" style={{ height:"38px", width:"auto", objectFit:"contain" }} />
          <div className="text-sm font-semibold mt-1 tracking-widest uppercase" style={{ color: colorSky, opacity:0.8 }}>Logiciel CGP</div>
        </div>
      </div>

      {/* Carte */}
      <Card className="w-full max-w-md rounded-3xl border-0" style={{ position:"relative", zIndex:1,
        background:"rgba(255,255,255,0.94)", backdropFilter:"blur(16px)",
        boxShadow:"0 24px 64px rgba(16,27,59,0.22), 0 4px 16px rgba(227,175,100,0.28)",
        border:"1px solid rgba(227,175,100,0.30)" }}>
        <CardContent className="p-8 space-y-5">

          {/* Titre mode */}
          <div className="text-center mb-2">
            <h2 className="text-lg font-bold" style={{ color: colorNavy }}>
              {mode === "login" && "Connexion"}
              {mode === "register" && "Créer un compte"}
              {mode === "forgot" && "Mot de passe oublié"}
              {mode === "reset" && "Nouveau mot de passe"}
            </h2>
            {mode === "register" && (
              <p className="text-xs text-slate-500 mt-1">Accès réservé aux CGP partenaires</p>
            )}
          </div>

          {/* Message succès */}
          {successMsg && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200">
              ✓ {successMsg}
            </div>
          )}

          {/* Message erreur */}
          {displayError && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200">
              {displayError}
            </div>
          )}

          {/* Mode hors-ligne */}
          {authState === "grace" && (
            <div className="rounded-xl px-4 py-3 text-sm bg-amber-50 border border-amber-200 text-amber-800">
              ⚠️ Mode hors-ligne — connexion internet requise dans les 72h
            </div>
          )}

          {/* Champ cabinet (inscription) */}
          {mode === "register" && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold tracking-wide" style={{ color: colorSky }}>NOM DU CABINET</Label>
              <Input
                value={cabinetName}
                onChange={e => setCabinetName(e.target.value)}
                placeholder="Ex : Dupont Patrimoine"
                className="rounded-xl text-sm"
                style={{ borderColor: "rgba(227,175,100,0.3)", background: "rgba(255,255,255,0.98)" }}
              />
            </div>
          )}

          {/* Email */}
          {mode !== "reset" && <div className="space-y-1">
            <Label className="text-xs font-semibold tracking-wide" style={{ color: colorSky }}>EMAIL</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && mode === "login" && handleLogin()}
              placeholder="votre@email.com"
              className="rounded-xl text-sm"
              style={{ borderColor: "rgba(227,175,100,0.3)", background: "rgba(255,255,255,0.98)" }}
            />
          </div>}

          {/* Mot de passe */}
          {mode !== "forgot" && mode !== "reset" && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold tracking-wide" style={{ color: colorSky }}>MOT DE PASSE</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && mode === "login" && handleLogin()}
                placeholder={mode === "register" ? "8 caractères minimum" : "••••••••"}
                className="rounded-xl text-sm"
                style={{ borderColor: "rgba(227,175,100,0.3)", background: "rgba(255,255,255,0.98)" }}
              />
            </div>
          )}

          {/* Nouveau mot de passe (reset) */}
          {mode === "reset" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs font-semibold tracking-wide" style={{ color: colorSky }}>NOUVEAU MOT DE PASSE</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  className="rounded-xl text-sm"
                  style={{ borderColor: "rgba(227,175,100,0.3)", background: "rgba(255,255,255,0.98)" }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold tracking-wide" style={{ color: colorSky }}>CONFIRMER LE MOT DE PASSE</Label>
                <Input
                  type="password"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="rounded-xl text-sm"
                  style={{ borderColor: "rgba(227,175,100,0.3)", background: "rgba(255,255,255,0.98)" }}
                />
              </div>
            </>
          )}

          {/* Confirmation mot de passe (inscription) */}
          {mode === "register" && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold tracking-wide" style={{ color: colorSky }}>CONFIRMER LE MOT DE PASSE</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-xl text-sm"
                style={{ borderColor: "rgba(227,175,100,0.3)", background: "rgba(255,255,255,0.98)" }}
              />
            </div>
          )}

          {/* Bouton action */}
          <Button
            onClick={mode === "login" ? handleLogin : mode === "register" ? handleRegister : mode === "reset" ? handleReset : handleForgot}
            disabled={loading || (mode !== "reset" && !email)}
            className="w-full rounded-xl h-11 font-semibold text-sm shadow-md mt-2"
            style={{ background: `linear-gradient(135deg, ${colorNavy} 0%, ${colorSky} 55%, #b8822e 100%)`, color: "#fff", boxShadow:"0 4px 20px rgba(16,27,59,0.35)" }}
          >
            {loading ? "..." : mode === "login" ? "Se connecter" : mode === "register" ? "Créer mon compte" : mode === "reset" ? "Enregistrer le mot de passe" : "Envoyer le lien"}
          </Button>

          {/* Liens secondaires */}
          <div className="flex flex-col items-center gap-2 pt-1 text-xs text-slate-500">
            {mode === "login" && (
              <>
                <button onClick={() => { setMode("forgot"); setLocalError(""); setSuccessMsg(""); }} className="hover:underline hover:text-slate-700">
                  Mot de passe oublié ?
                </button>
                <button onClick={() => { setMode("register"); setLocalError(""); setSuccessMsg(""); }} className="hover:underline hover:text-slate-700">
                  Pas encore de compte ? S'inscrire
                </button>
              </>
            )}
            {(mode === "register" || mode === "forgot") && (
              <button onClick={() => { setMode("login"); setLocalError(""); setSuccessMsg(""); }} className="hover:underline hover:text-slate-700">
                ← Retour à la connexion
              </button>
            )}
          </div>

        </CardContent>
      </Card>

      <p className="text-xs text-slate-500 mt-6 font-medium" style={{ position:"relative", zIndex:1 }}>© Ploutos — Données stockées localement</p>
    </div>
  );
}
