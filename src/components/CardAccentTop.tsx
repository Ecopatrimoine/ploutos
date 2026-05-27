// ─── CardAccentTop — accent en L (top + gauche) sur les Cards racine ──
//
// À placer en enfant direct d'une Card racine de tab (avec
// className="... relative overflow-hidden"). Reprend les 3 couleurs
// cabinet (navy → sky → gold) en mini-version du cadre du header.
//
// Forme en L : filet 6px en haut (gradient horizontal navy → sky → gold)
// + filet 6px à gauche (gradient vertical navy → sky → gold), avec un
// arrondi au coin haut-gauche pour éviter l'angle 90° qui paraît dur.
//
// Le radius par défaut est 14 (cohérent avec les Cards type rounded-2xl
// /3xl) mais peut être ajusté via la prop `radius` si la card a un
// border-radius spécifique.
//
// Utilise les CSS vars `--cab-navy`, `--cab-sky`, `--cab-gold` injectées
// au niveau document.documentElement par App.tsx.

export function CardAccentTop({ radius = 14 }: { radius?: number } = {}) {
  return (
    <>
      {/* Filet horizontal en haut */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: 6,
          background: "linear-gradient(90deg, var(--cab-navy) 0%, var(--cab-sky) 50%, var(--cab-gold) 100%)",
          borderTopLeftRadius: radius,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      {/* Filet vertical à gauche */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0, left: 0, bottom: 0,
          width: 6,
          background: "linear-gradient(180deg, var(--cab-navy) 0%, var(--cab-sky) 50%, var(--cab-gold) 100%)",
          borderTopLeftRadius: radius,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
    </>
  );
}
