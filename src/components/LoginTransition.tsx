import { useEffect, useRef, useState } from "react";
import {
  Database, FileText, TrendingUp, Scale, BarChart2,
  Target, Shield, BookOpen
} from "lucide-react";

interface LoginTransitionProps {
  onComplete: () => void;
  colorNavy?: string;
  colorGold?: string;
  colorSky?: string;
  soundSrc?: string;
  logoSrc?: string;
}

// Même fond que AuthGate/dossiers — 100% opaque, origine center-top légèrement différent
const BG = "radial-gradient(ellipse at 50% 0%, #f9f1e3 0%, #f8f6f7 35%, #fdf0e2 62%, #eef2ff 100%)";

const ICONS = [Database, TrendingUp, Scale, BarChart2, Target, Shield, FileText, BookOpen];
const ICON_COLORS = ["#26428B","#E3AF64","#516AC7","#101B3B","#7C9E6F","#C07850","#6B7FD4","#3B8A7A"];
const ICON_DURATION = 338;

export function LoginTransition({
  onComplete,
  colorNavy = "#101B3B",
  colorGold = "#E3AF64",
  colorSky = "#26428B",
  soundSrc = "/sounds/login.mp3",
  logoSrc = "/logo.ploutos.svg",
}: LoginTransitionProps) {

  const [bgVisible, setBgVisible]           = useState(false);
  const [bgOut, setBgOut]                   = useState(false);
  const [currentIcon, setCurrentIcon]       = useState(-1);
  const [iconIn, setIconIn]                 = useState(false);
  const [lineWidth, setLineWidth]           = useState(0);
  const [iconsOut, setIconsOut]             = useState(false);
  const [logoVisible, setLogoVisible]       = useState(false);
  const [nameVisible, setNameVisible]       = useState(false);
  const [splashLineVisible, setSplashLine]  = useState(false);
  const [bylineVisible, setBylineVisible]   = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const paths = [soundSrc, "./sounds/login.mp3", "../sounds/login.mp3", "sounds/login.mp3"];
    (async () => {
      for (const path of paths) {
        if (cancelled) return;
        try { const a = new Audio(path); a.volume = 0.55; await a.play(); audioRef.current = a; return; } catch {}
      }
    })();
    return () => { cancelled = true; audioRef.current?.pause(); };
  }, []);

  useEffect(() => {
    const T: ReturnType<typeof setTimeout>[] = [];
    const t = (fn: () => void, ms: number) => { T.push(setTimeout(fn, ms)); };

    // Fade-in du fond (couvre proprement l'AuthGate qui part)
    t(() => setBgVisible(true), 30);

    ICONS.forEach((_, i) => {
      const start = 320 + i * ICON_DURATION;
      t(() => { setCurrentIcon(i); setIconIn(true); setLineWidth(Math.round(((i+1)/ICONS.length)*100)); }, start);
      if (i < ICONS.length - 1) t(() => setIconIn(false), start + ICON_DURATION - 80);
    });

    const iconsEnd = 320 + ICONS.length * ICON_DURATION + 200;
    t(() => { setIconIn(false); setIconsOut(true); }, iconsEnd);

    const p2 = iconsEnd + 380;
    t(() => setLogoVisible(true),   p2);
    t(() => setNameVisible(true),   p2 + 280);
    t(() => setSplashLine(true),    p2 + 460);
    t(() => setBylineVisible(true), p2 + 660);

    const splashEnd = p2 + 2600;
    t(() => setBgOut(true), splashEnd);
    t(() => onComplete(),   splashEnd + 500);

    return () => T.forEach(clearTimeout);
  }, []);

  const CurrentIcon = currentIcon >= 0 ? ICONS[currentIcon] : null;
  const currentColor = currentIcon >= 0 ? ICON_COLORS[currentIcon % ICON_COLORS.length] : colorSky;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: BG,
      opacity: bgOut ? 0 : bgVisible ? 1 : 0,
      transform: bgOut ? "scale(0.97)" : bgVisible ? "scale(1)" : "scale(1.04)",
      transition: bgOut
        ? "opacity 500ms cubic-bezier(0.4,0,0.2,1), transform 550ms cubic-bezier(0.4,0,0.2,1)"
        : "opacity 320ms cubic-bezier(0.22,1,0.36,1), transform 420ms cubic-bezier(0.22,1,0.36,1)",
      pointerEvents: "none", userSelect: "none", overflow: "hidden",
    }}>

      {/* ── Formes décoratives — exactement comme l'écran dossiers ── */}
      {/* Grand cercle or — bas-gauche */}
      <div style={{ position:"absolute", bottom:-120, left:-80, width:420, height:420, borderRadius:"50%", background:colorGold, opacity:0.13 }} />
      {/* Rectangle navy — haut-droite */}
      <div style={{ position:"absolute", top:-40, right:-50, width:260, height:120, borderRadius:24, background:colorNavy, opacity:0.12, transform:"rotate(-18deg)" }} />
      {/* Carré or — milieu-droite */}
      <div style={{ position:"absolute", top:"38%", right:-30, width:180, height:180, borderRadius:24, background:colorGold, opacity:0.14, transform:"rotate(12deg)" }} />
      {/* Petit cercle navy — haut-gauche */}
      <div style={{ position:"absolute", top:80, left:"5%", width:140, height:140, borderRadius:"50%", background:colorNavy, opacity:0.08 }} />
      {/* Petit carré navy — bas-droite */}
      <div style={{ position:"absolute", bottom:60, right:"12%", width:90, height:90, borderRadius:16, background:colorNavy, opacity:0.10, transform:"rotate(25deg)" }} />
      {/* Cercle or — haut-centre */}
      <div style={{ position:"absolute", top:-60, left:"40%", width:240, height:240, borderRadius:"50%", background:colorGold, opacity:0.10 }} />

      {/* ── Zone icônes ── */}
      <div style={{
        position:"absolute", inset:0,
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        opacity: iconsOut ? 0 : 1,
        transition: "opacity 300ms cubic-bezier(0.4,0,0.2,1)",
      }}>
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"center",
          opacity: iconIn ? 1 : 0,
          transform: iconIn ? "scale(1) translateY(0)" : "scale(0.62) translateY(22px)",
          transition: iconIn
            ? "opacity 220ms cubic-bezier(0.34,1.56,0.64,1), transform 280ms cubic-bezier(0.34,1.56,0.64,1)"
            : "opacity 140ms cubic-bezier(0.4,0,0.2,1), transform 180ms cubic-bezier(0.4,0,0.2,1)",
          marginBottom: 48,
        }}>
          {CurrentIcon && <CurrentIcon size={160} strokeWidth={1.2} style={{ color: currentColor, filter: `drop-shadow(0 10px 28px ${currentColor}45)` }} />}
        </div>
        <div style={{ height:3, width:340, borderRadius:2, background:"rgba(0,0,0,0.07)", overflow:"hidden", position:"relative" }}>
          <div style={{ position:"absolute", left:0, top:0, bottom:0, width:`${lineWidth}%`, background:`linear-gradient(90deg, ${colorGold}70, ${colorGold})`, borderRadius:2, transition:`width ${ICON_DURATION}ms linear`, boxShadow:`0 0 8px ${colorGold}55` }} />
        </div>
      </div>

      {/* ── Zone splash ── */}
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
        <div style={{ marginBottom:28, opacity:logoVisible?1:0, transform:logoVisible?"scale(1) translateY(0)":"scale(0.82) translateY(20px)", transition:"opacity 500ms cubic-bezier(0.34,1.56,0.64,1), transform 500ms cubic-bezier(0.34,1.56,0.64,1)" }}>
          <img src={logoSrc} style={{ height:120, width:"auto", objectFit:"contain" }} onError={(e)=>{(e.target as HTMLImageElement).style.display="none"}} />
        </div>
        <div style={{ fontFamily:"'Lato',sans-serif", fontWeight:900, fontSize:57, color:colorNavy, letterSpacing:"0.1em", lineHeight:1, opacity:nameVisible?1:0, transform:nameVisible?"translateY(0)":"translateY(10px)", transition:"opacity 420ms cubic-bezier(0.22,1,0.36,1), transform 420ms cubic-bezier(0.22,1,0.36,1)" }}>
          <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQ0IiBoZWlnaHQ9IjEzMyIgdmlld0JveD0iMCAwIDY0NCAxMzMiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik00NS4zMTAxIDY1LjQ1QzQ5LjgxMDEgNjQuMDMgNTMuNTcwMSA2Mi4wNSA1Ni42MDAxIDU5LjUxQzU5LjYzMDEgNTYuOTcgNjEuOTEwMSA1My45NCA2My40NTAxIDUwLjQxQzY0Ljk5MDEgNDYuODggNjUuNzUwMSA0Mi45OSA2NS43NTAxIDM4Ljc1QzY1Ljc1MDEgMzQuNTEgNjUuMDMwMSAzMC43OCA2My41ODAxIDI3LjMzQzYyLjEzMDEgMjMuODkgNTkuOTIwMSAyMC45NCA1Ni45NjAxIDE4LjQ4QzU0LjAwMDEgMTYuMDMgNTAuMjQwMSAxNC4xMiA0NS43MDAxIDEyLjc2QzQxLjE2MDEgMTEuNCAzNS43OTAxIDEwLjcyIDI5LjYwMDEgMTAuNzJIMC4xMTAxMDdWOTkuODNIMTUuNTEwMVY2Ny41OUgyOS42MDAxQzM1LjU3MDEgNjcuNTkgNDAuODAwMSA2Ni44OCA0NS4zMDAxIDY1LjQ2TDQ1LjMxMDEgNjUuNDVaTTE1LjUyMDEgMjIuMDRIMjkuNjEwMUMzMy4xMjAxIDIyLjA0IDM2LjE4MDEgMjIuNDIgMzguNzkwMSAyMy4xOEM0MS40MDAxIDIzLjk0IDQzLjU2MDEgMjUuMDUgNDUuMjcwMSAyNi40OUM0Ni45ODAxIDI3LjkzIDQ4LjI3MDEgMjkuNjkgNDkuMTIwMSAzMS43NUM0OS45NzAxIDMzLjgxIDUwLjQwMDEgMzYuMTQgNTAuNDAwMSAzOC43NEM1MC40MDAxIDQxLjM0IDQ5Ljk2MDEgNDMuNzcgNDkuMDgwMSA0NS45MkM0OC4yMDAxIDQ4LjA3IDQ2Ljg5MDEgNDkuODkgNDUuMTYwMSA1MS40QzQzLjQzMDEgNTIuOTEgNDEuMjYwMSA1NC4wNyAzOC42NDAxIDU0LjlDMzYuMDMwMSA1NS43MyAzMy4wMTAxIDU2LjE0IDI5LjU5MDEgNTYuMTRIMTUuNTAwMVYyMi4wNEgxNS41MjAxWiIgZmlsbD0iIzEwMUIzQiIvPgo8cGF0aCBkPSJNMTM1LjI3IDg3LjY4OTlIOTUuOVYxMC43MUg4MC41Vjk5LjgxOTlIMTM1LjI3Vjg3LjY4OTlaIiBmaWxsPSIjMTAxQjNCIi8+CjxwYXRoIGQ9Ik0zMTguOTQgOTAuNTlDMzIyLjI4IDkzLjgzIDMyNi4zMyA5Ni4zNyAzMzEuMSA5OC4yMUMzMzUuODcgMTAwLjA1IDM0MS4yNCAxMDAuOTcgMzQ3LjIxIDEwMC45N0MzNTMuMTggMTAwLjk3IDM1OC41NSAxMDAuMDUgMzYzLjMyIDk4LjIxQzM2OC4wOSA5Ni4zNyAzNzIuMTQgOTMuODMgMzc1LjQ4IDkwLjU5QzM3OC44MiA4Ny4zNSAzODEuMzggODMuNDk5OSAzODMuMTYgNzkuMDM5OUMzODQuOTQgNzQuNTc5OSAzODUuODMgNjkuNzI5OSAzODUuODMgNjQuNDc5OVYxMC43MUgzNzAuNDdWNjQuNDc5OUMzNzAuNDcgNjguMDI5OSAzNjkuOTQgNzEuMjYgMzY4Ljg5IDc0LjE3QzM2Ny44NCA3Ny4wOCAzNjYuMzEgNzkuNTcgMzY0LjMxIDgxLjY0QzM2Mi4zMSA4My43MSAzNTkuODcgODUuMzIgMzU3IDg2LjQ3QzM1NC4xMiA4Ny42MyAzNTAuODYgODguMiAzNDcuMjEgODguMkMzNDMuNTYgODguMiAzNDAuMyA4Ny42MiAzMzcuNDIgODYuNDdDMzM0LjU0IDg1LjMxIDMzMi4xMSA4My42ODk5IDMzMC4xNCA4MS42MDk5QzMyOC4xNyA3OS41Mjk5IDMyNi42NSA3Ny4wMjk5IDMyNS41OSA3NC4xMTk5QzMyNC41MyA3MS4yMDk5IDMyNC4wMSA2Ny45Nzk5IDMyNC4wMSA2NC40Mjk5VjEwLjcxOTlIMzA4LjU5VjY0LjQ5QzMwOC41OSA2OS43MyAzMDkuNDggNzQuNTg5OSAzMTEuMjYgNzkuMDQ5OUMzMTMuMDQgODMuNTA5OSAzMTUuNiA4Ny4zNiAzMTguOTQgOTAuNlY5MC41OVoiIGZpbGw9IiMxMDFCM0IiLz4KPHBhdGggZD0iTTQyNy42IDk5LjkxOTlINDQyLjk2VjIyLjc4OTlINDcyLjU1VjEwLjcxSDM5Ny45NVYyMi43ODk5SDQyNy42Vjk5LjkxOTlaIiBmaWxsPSIjMTAxQjNCIi8+CjxwYXRoIGQ9Ik02NDEuNDQgNjIuOTlDNjQwLjE3IDYwLjQzIDYzOC40OSA1OC4yNiA2MzYuNCA1Ni40OUM2MzQuMzEgNTQuNzEgNjMxLjkzIDUzLjI0OTkgNjI5LjI1IDUyLjA4OTlDNjI2LjU3IDUwLjkyOTkgNjIzLjg0IDQ5LjkgNjIxLjA1IDQ4Ljk5QzYxOC4yNiA0OC4wOCA2MTUuNTMgNDcuMjIgNjEyLjg1IDQ2LjQyQzYxMC4xNyA0NS42MSA2MDcuNzkgNDQuNjc5OSA2MDUuNyA0My41OTk5QzYwMy42MSA0Mi41Mjk5IDYwMS45MyA0MS4yNCA2MDAuNjYgMzkuNzI5OUM1OTkuMzggMzguMjE5OSA1OTguNzUgMzYuMzI5OSA1OTguNzUgMzQuMDU5OUM1OTguNzUgMzIuMjc5OSA1OTkuMDkgMzAuNjQgNTk5Ljc3IDI5LjE0QzYwMC40NSAyNy42MyA2MDEuNDcgMjYuMzIgNjAyLjgzIDI1LjIxQzYwNC4xOSAyNC4xIDYwNS44NyAyMy4yMyA2MDcuODcgMjIuNjFDNjA5Ljg3IDIxLjk5IDYxMi4xOSAyMS42Nzk5IDYxNC44MiAyMS42Nzk5QzYxNy42NyAyMS42Nzk5IDYyMC4xMyAyMi4wMiA2MjIuMiAyMi43QzYyNC4yNiAyMy4zOCA2MjYuMDUgMjQuMTI5OSA2MjcuNTcgMjQuOTI5OUM2MjkuMDkgMjUuNzM5OSA2MzAuMzYgMjYuNDY5OSA2MzEuMzkgMjcuMTI5OUM2MzIuNDIgMjcuNzg5OSA2MzMuMzYgMjguMTE5OSA2MzQuMTkgMjguMTE5OUM2MzQuOTggMjguMTE5OSA2MzUuNjQgMjcuOTQ5OSA2MzYuMTcgMjcuNTg5OUM2MzYuNyAyNy4yMzk5IDYzNy4yIDI2LjY5IDYzNy42OSAyNS45NUw2NDEuNDQgMTkuMDA5OUM2MzguMTUgMTYuMDM5OSA2MzQuMjIgMTMuNzQ5OSA2MjkuNjggMTIuMTI5OUM2MjUuMTMgMTAuNTE5OSA2MjAuMTMgOS43MDk5NiA2MTQuNjkgOS43MDk5NkM2MDkuODUgOS43MDk5NiA2MDUuNTUgMTAuNDA5OSA2MDEuNzcgMTEuODE5OUM1OTcuOTkgMTMuMjE5OSA1OTQuODIgMTUuMDg5OSA1OTIuMjUgMTcuNDI5OUM1ODkuNjggMTkuNzU5OSA1ODcuNzIgMjIuNDQgNTg2LjM4IDI1LjQ1QzU4NS4wNCAyOC40NyA1ODQuMzcgMzEuNTggNTg0LjM3IDM0LjhDNTg0LjM3IDM4Ljg1IDU4NS4wMSA0Mi4yMTk5IDU4Ni4yOCA0NC45Mjk5QzU4Ny41NiA0Ny42Mzk5IDU4OS4yNCA0OS45MSA1OTEuMzIgNTEuNzRDNTkzLjQxIDUzLjU4IDU5NS43OSA1NS4wNyA1OTguNDcgNTYuMkM2MDEuMTUgNTcuMzQgNjAzLjg4IDU4LjMzIDYwNi42NCA1OS4xN0M2MDkuNDEgNjAuMDIgNjEyLjEzIDYwLjgwOTkgNjE0LjgxIDYxLjU1OTlDNjE3LjQ5IDYyLjI5OTkgNjE5Ljg3IDYzLjIwOTkgNjIxLjk2IDY0LjI4OTlDNjI0LjA0IDY1LjM2OTkgNjI1LjczIDY2LjY5OTkgNjI3IDY4LjI4OTlDNjI4LjI3IDY5Ljg3OTkgNjI4LjkxIDcxLjk0IDYyOC45MSA3NC40NUM2MjguOTEgNzguOTUgNjI3LjM4IDgyLjQ3OTkgNjI0LjMzIDg1LjAzOTlDNjIxLjI4IDg3LjU5OTkgNjE2Ljk2IDg4Ljg3OTkgNjExLjM4IDg4Ljg3OTlDNjA3Ljk1IDg4Ljg3OTkgNjA1LjAxIDg4LjQzOTkgNjAyLjU1IDg3LjU0OTlDNjAwLjA5IDg2LjY1OTkgNTk3Ljk5IDg1LjY5IDU5Ni4yNiA4NC42NEM1OTQuNTIgODMuNTkgNTkzLjA0IDgyLjYxOTkgNTkxLjgxIDgxLjcyOTlDNTkwLjU4IDgwLjgzOTkgNTg5LjQ2IDgwLjQgNTg4LjQ1IDgwLjRDNTg3LjcgODAuNCA1ODcuMDIgODAuNTcgNTg2LjQxIDgwLjlDNTg1LjggODEuMjMgNTg1LjI5IDgxLjY3OTkgNTg0Ljg5IDgyLjI1OTlMNTgwLjQxIDg5LjJDNTgyLjIxIDkwLjk3OTkgNTg0LjI2IDkyLjU5IDU4Ni41NCA5NC4wM0M1ODguODIgOTUuNDggNTkxLjI3IDk2LjcgNTkzLjg5IDk3LjcyQzU5Ni41IDk4LjczIDU5OS4yNSA5OS41MTk5IDYwMi4xMyAxMDAuMDdDNjA1LjAxIDEwMC42MyA2MDcuOTYgMTAwLjkgNjEwLjk5IDEwMC45QzYxNi4xMyAxMDAuOSA2MjAuNzEgMTAwLjE2IDYyNC43MyA5OC42Njk5QzYyOC43NSA5Ny4xNzk5IDYzMi4xMyA5NS4xNDk5IDYzNC44OCA5Mi41Njk5QzYzNy42MyA4OS45ODk5IDYzOS43MiA4Ni45NTk5IDY0MS4xOCA4My40ODk5QzY0Mi42MyA4MC4wMTk5IDY0My4zNSA3Ni4yOTk5IDY0My4zNSA3Mi4zMzk5QzY0My4zNSA2OC42Njk5IDY0Mi43MSA2NS41NSA2NDEuNDQgNjIuOTlaIiBmaWxsPSIjMTAxQjNCIi8+CjxwYXRoIGQ9Ik0yNjYuNDMgMTE4LjNDMjY2LjkgMTE3Ljg1IDI2Ny4zOCAxMTcuNCAyNjcuODMgMTE2LjkzQzI3My42NiAxMTAuOTEgMjc4LjE4IDEwMy43NCAyODEuMzkgOTUuNDFDMjg0LjYgODcuMDggMjg2LjIgNzcuOTggMjg2LjIgNjguMTFDMjg2LjIgNTguMjQgMjg0LjU5IDQ5LjE0IDI4MS4zOSA0MC44MUMyNzguMTggMzIuNDggMjczLjY2IDI1LjMgMjY3LjgzIDE5LjI1QzI2MiAxMy4yIDI1NSA4LjQ4IDI0Ni44MiA1LjA5QzIzOC42NCAxLjcgMjI5LjU2IDAgMjE5LjU2IDBDMjA5LjU2IDAgMjAwLjU3IDEuNyAxOTIuNCA1LjA5QzE4NC4yMyA4LjQ4IDE3Ny4yMSAxMy4yIDE3MS4zNCAxOS4yNUMxNjUuNDggMjUuMyAxNjAuOTQgMzIuNDggMTU3Ljc0IDQwLjgxQzE1NC41MyA0OS4xNCAxNTIuOTMgNTguMjQgMTUyLjkzIDY4LjExQzE1Mi45MyA3Ny45OCAxNTQuNTQgODcuMDggMTU3Ljc0IDk1LjQxQzE2MC45NSAxMDMuNzQgMTY1LjQ4IDExMC45MSAxNzEuMzQgMTE2LjkzQzE3MS44IDExNy40IDE3Mi4yOCAxMTcuODUgMTcyLjc1IDExOC4zSDBWMTMyLjI0SDE5OS4xOVYxMTguM0wxOTcuNTYgMTE4LjA3QzE5Mi4yMyAxMTUuNjMgMTg3LjYgMTEyLjMyIDE4My43MiAxMDguMUMxNzkuNDMgMTAzLjQzIDE3Ni4xMiA5Ny43MyAxNzMuODEgOTAuOTlDMTcxLjUgODQuMjUgMTcwLjM0IDc2LjYyIDE3MC4zNCA2OC4xMUMxNzAuMzQgNTkuNiAxNzEuNSA1Mi4wNyAxNzMuODEgNDUuMzNDMTc2LjEyIDM4LjU5IDE3OS40MyAzMi44NyAxODMuNzIgMjguMTdDMTg4LjAxIDIzLjQ3IDE5My4xOCAxOS44NiAxOTkuMjQgMTcuMzRDMjA1LjMgMTQuODIgMjEyLjA4IDEzLjU2IDIxOS41NyAxMy41NkMyMjcuMDYgMTMuNTYgMjMzLjk0IDE0LjgyIDI0MCAxNy4zNEMyNDYuMDYgMTkuODYgMjUxLjIyIDIzLjQ3IDI1NS40OCAyOC4xN0MyNTkuNzQgMzIuODcgMjYzIDM4LjU5IDI2NS4yOSA0NS4zM0MyNjcuNTcgNTIuMDcgMjY4LjcxIDU5LjY3IDI2OC43MSA2OC4xMUMyNjguNzEgNzYuNTUgMjY3LjU3IDg0LjI1IDI2NS4yOSA5MC45OUMyNjMgOTcuNzMgMjU5Ljc0IDEwMy40NCAyNTUuNDggMTA4LjFDMjUxLjUzIDExMi40MyAyNDYuNzggMTE1LjgxIDI0MS4yNyAxMTguMjdMMjQxLjA1IDExOC4zVjEzMi4yNEg2NDEuNDZWMTE4LjNIMjY2LjQ1SDI2Ni40M1oiIGZpbGw9IiMxMDFCM0IiLz4KPHBhdGggZD0iTTQ4OS40MSA4Ny45OUM0OTMuNTggOTIuMDIgNDk4LjU4IDk1LjE3IDUwNC40IDk3LjQ0QzUxMC4yMiA5OS43MSA1MTYuNjcgMTAwLjg1IDUyMy43NCAxMDAuODVDNTMwLjgxIDEwMC44NSA1MzcuMzMgOTkuNzEgNTQzLjE1IDk3LjQ0QzU0OC45NyA5NS4xNyA1NTMuOTYgOTIuMDIgNTU4LjExIDg3Ljk5QzU2Mi4yNiA4My45NiA1NjUuNDggNzkuMTYgNTY3Ljc2IDczLjU5QzU3MC4wNCA2OC4wMSA1NzEuMTkgNjEuOTIgNTcxLjE5IDU1LjMyQzU3MS4xOSA0OC43MiA1NzAuMDUgNDIuNjIgNTY3Ljc2IDM3LjA1QzU2NS40OCAzMS40OCA1NjIuMjYgMjYuNjcgNTU4LjExIDIyLjYyQzU1My45NiAxOC41NyA1NDguOTcgMTUuNDEgNTQzLjE1IDEzLjE0QzUzNy4zMyAxMC44NyA1MzAuODYgOS43Mjk5OCA1MjMuNzQgOS43Mjk5OEM1MTYuNjIgOS43Mjk5OCA1MTAuMjIgMTAuODcgNTA0LjQgMTMuMTRDNDk4LjU4IDE1LjQxIDQ5My41OCAxOC41NyA0ODkuNDEgMjIuNjJDNDg1LjI0IDI2LjY3IDQ4Mi4wMSAzMS40OCA0NzkuNzIgMzcuMDVDNDc3LjQ0IDQyLjYzIDQ3Ni4yOSA0OC43MiA0NzYuMjkgNTUuMzJDNDc2LjI5IDYxLjkyIDQ3Ny40MyA2OC4wMiA0NzkuNzIgNzMuNTlDNDgyIDc5LjE3IDQ4NS4yMyA4My45NyA0ODkuNDEgODcuOTlaTTQ5NC4yMiA0MS41QzQ5NS43MSAzNy40MSA0OTcuODUgMzMuOTQgNTAwLjYxIDMxLjA5QzUwMy4zOCAyOC4yNCA1MDYuNzEgMjYuMDUgNTEwLjYyIDI0LjUyQzUxNC41MyAyMi45OSA1MTguOSAyMi4yMyA1MjMuNzMgMjIuMjNDNTI4LjU2IDIyLjIzIDUzMyAyMi45OSA1MzYuOTEgMjQuNTJDNTQwLjgyIDI2LjA1IDU0NC4xNSAyOC4yNCA1NDYuODkgMzEuMDlDNTQ5LjY0IDMzLjk0IDU1MS43NCAzNy40MSA1NTMuMjIgNDEuNUM1NTQuNjkgNDUuNTkgNTU1LjQzIDUwLjE5IDU1NS40MyA1NS4zMUM1NTUuNDMgNjAuNDMgNTU0LjY5IDY1LjEgNTUzLjIyIDY5LjE5QzU1MS43NSA3My4yOCA1NDkuNjQgNzYuNzQgNTQ2Ljg5IDc5LjU3QzU0NC4xNSA4Mi40IDU0MC44MiA4NC41NyA1MzYuOTEgODYuMDdDNTMzIDg3LjU4IDUyOC42MSA4OC4zMyA1MjMuNzMgODguMzNDNTE4Ljg1IDg4LjMzIDUxNC41MyA4Ny41OCA1MTAuNjIgODYuMDdDNTA2LjcxIDg0LjU2IDUwMy4zNyA4Mi4zOSA1MDAuNjEgNzkuNTdDNDk3Ljg0IDc2Ljc0IDQ5NS43MSA3My4yOCA0OTQuMjIgNjkuMTlDNDkyLjczIDY1LjEgNDkxLjk4IDYwLjQ4IDQ5MS45OCA1NS4zMUM0OTEuOTggNTAuMTQgNDkyLjczIDQ1LjU4IDQ5NC4yMiA0MS41WiIgZmlsbD0iIzEwMUIzQiIvPgo8L3N2Zz4K" alt="Ploutos" style={{ height:"52px", width:"auto", objectFit:"contain" }} />
        </div>
        <div style={{ width:splashLineVisible?120:0, height:4, background:colorGold, borderRadius:2, margin:"20px 0 18px", transition:"width 520ms cubic-bezier(0.34,1.56,0.64,1)", boxShadow:`0 0 14px ${colorGold}55` }} />
        <div style={{ fontFamily:"'Lato',sans-serif", fontWeight:600, fontSize:20, color:"#94a3b8", letterSpacing:"0.06em", opacity:bylineVisible?1:0, transition:"opacity 380ms cubic-bezier(0.22,1,0.36,1)" }}>
          By Ecopatrimoine Conseil
        </div>
      </div>
    </div>
  );
}
