import { supabase } from "./supabase";

// Marqueur d'usage (Argos, table usage_events) : pose au plus une entree par
// (utilisateur, jour) a l'ouverture d'une session authentifiee. Telemetrie
// best-effort — tout echec est avale (console.debug au plus) pour ne jamais
// gener l'authentification ni l'usage. Aucun lien avec le moteur fiscal.

// Cle (user:jour) deja tentee pour ce chargement : evite tout rappel sur une
// simple navigation interne ou une re-verification de session.
let markedForLoad: string | null = null;

export function markUsageDay(userId: string | undefined | null): void {
  if (!userId) return;
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (colonne date)
  const key = `${userId}:${day}`;
  if (markedForLoad === key) return;
  markedForLoad = key;

  try {
    void supabase
      .from("usage_events")
      .upsert({ user_id: userId, day }, { onConflict: "user_id,day", ignoreDuplicates: true })
      .then(
        ({ error }) => {
          if (error) console.debug("usage_events marker skipped:", error.message);
        },
        (e) => console.debug("usage_events marker failed:", e),
      );
  } catch (e) {
    console.debug("usage_events marker threw:", e);
  }
}
