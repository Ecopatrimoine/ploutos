// Cloudflare Turnstile — cle de site + chargement idempotent du script.
//
// Cable sur les 3 endpoints auth soumis au captcha (signUp, signInWithPassword,
// resetPasswordForEmail). La verification cote Supabase Dashboard n'est PAS
// encore activee : les tokens envoyes sont ignores pour l'instant (voulu).

// Cle de test publique Cloudflare : passe toujours la verification, jamais en prod.
const TEST_SITE_KEY = "1x00000000000000000000AA";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

// Cle de site Turnstile, lue depuis VITE_TURNSTILE_SITE_KEY.
// - presente        -> utilisee telle quelle.
// - absente en DEV   -> repli sur la cle de test publique Cloudflare.
// - absente en PROD  -> erreur explicite au PREMIER usage (et non au chargement
//   du module, pour ne jamais casser un import cote build/test/SSR).
export function getTurnstileSiteKey(): string {
  const key = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (key) return key;
  if (import.meta.env.DEV) return TEST_SITE_KEY;
  throw new Error("VITE_TURNSTILE_SITE_KEY manquante");
}

// Memoisation du chargement : une seule balise <script> injectee, quelle que
// soit la frequence des appels (montages/demontages du widget, HMR).
let loadPromise: Promise<void> | null = null;

// Charge le script Turnstile une seule fois. La Promise se resout des que
// window.turnstile est disponible. Les appels concurrents ou repetes partagent
// la meme Promise (donc une seule injection de <script>). En cas d'echec de
// chargement, la memoisation est reinitialisee pour autoriser une nouvelle
// tentative ulterieure.
export function loadTurnstileScript(): Promise<void> {
  if (typeof window !== "undefined" && window.turnstile) {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const onReady = () => {
      if (window.turnstile) resolve();
      else reject(new Error("Turnstile indisponible apres chargement du script"));
    };
    const onError = () => {
      loadPromise = null; // permettre une nouvelle tentative
      reject(new Error("Echec de chargement du script Turnstile"));
    };

    // Script deja present (autre point d'appel, HMR, rechargement) : ne pas le
    // reinjecter, se brancher sur son cycle de vie.
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (existing) {
      if (window.turnstile) { resolve(); return; }
      existing.addEventListener("load", onReady, { once: true });
      existing.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", onReady, { once: true });
    script.addEventListener("error", onError, { once: true });
    document.head.appendChild(script);
  });

  return loadPromise;
}
