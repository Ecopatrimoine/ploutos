/// <reference types="vite/client" />

// Constantes globales injectées au build par le bloc `define` de vite.config.ts
// (badge version affiché dans le footer de l'écran de sélection des dossiers).
declare const __APP_VERSION__: string;
declare const __COMMIT_HASH__: string;

// Variables d'environnement Vite typées (augmentation de l'interface fournie
// par vite/client via déclaration de fusion).
interface ImportMetaEnv {
  readonly VITE_TURNSTILE_SITE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Cloudflare Turnstile — API minimale exposée sur window par le script api.js.
interface TurnstileRenderOptions {
  sitekey: string;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
}

interface TurnstileApi {
  render: (container: string | HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
}

interface Window {
  turnstile?: TurnstileApi;
}
