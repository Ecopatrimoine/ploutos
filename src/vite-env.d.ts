/// <reference types="vite/client" />

// Constantes globales injectées au build par le bloc `define` de vite.config.ts
// (badge version affiché dans le footer de l'écran de sélection des dossiers).
declare const __APP_VERSION__: string;
declare const __COMMIT_HASH__: string;
