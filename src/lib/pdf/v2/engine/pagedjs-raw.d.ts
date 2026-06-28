// Le polyfill paged.js est inliné dans le document d'aperçu (iframe autonome) via
// l'import ?raw de Vite. Déclaration ambiante explicite pour ne pas dépendre de
// la présence de "vite/client" dans tel ou tel tsconfig.
declare module "pagedjs/dist/paged.polyfill.js?raw" {
  const content: string;
  export default content;
}
