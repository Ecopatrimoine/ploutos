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
          <img src="/logo.ploutos.png" alt="Ploutos" style={{ height:120, width:"auto", objectFit:"contain" }} onError={(e)=>{(e.target as HTMLImageElement).style.display="none"}} />
        </div>
        <div style={{ fontFamily:"'Lato',sans-serif", fontWeight:900, fontSize:57, color:colorNavy, letterSpacing:"0.1em", lineHeight:1, opacity:nameVisible?1:0, transform:nameVisible?"translateY(0)":"translateY(10px)", transition:"opacity 420ms cubic-bezier(0.22,1,0.36,1), transform 420ms cubic-bezier(0.22,1,0.36,1)" }}>
          Ploutos
        </div>
        <div style={{ width:splashLineVisible?120:0, height:4, background:colorGold, borderRadius:2, margin:"20px 0 18px", transition:"width 520ms cubic-bezier(0.34,1.56,0.64,1)", boxShadow:`0 0 14px ${colorGold}55` }} />
        <div style={{ fontFamily:"'Lato',sans-serif", fontWeight:600, fontSize:20, color:"#94a3b8", letterSpacing:"0.06em", opacity:bylineVisible?1:0, transition:"opacity 380ms cubic-bezier(0.22,1,0.36,1)" }}>
          By Ecopatrimoine Conseil
        </div>
      </div>
    </div>
  );
}
