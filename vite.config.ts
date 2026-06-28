import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createRequire } from 'node:module'

// Badge version (cf. footer de l'écran de sélection des dossiers).
// __APP_VERSION__ : version lue depuis package.json via npm_package_version
//   (défini par `npm run build`, en local comme sur Netlify).
// __COMMIT_HASH__ : COMMIT_REF fournie par Netlify au build, tronquée à 7
//   caractères ; "dev" en l'absence de la variable (build local).
const appVersion = process.env.npm_package_version ?? '0.0.0'
const commitHash = (process.env.COMMIT_REF ?? '').slice(0, 7) || 'dev'

// Resolution de fichiers depuis l'emplacement de CETTE config (localise le polyfill pagedjs).
const requireFromConfig = createRequire(import.meta.url)

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  plugins: [
    // ── Fix build pagedjs ─────────────────────────────────────────────────────
    // Vite 8/Rolldown applique le champ `exports` de pagedjs en STRICT : le sous-chemin
    // "pagedjs/dist/paged.polyfill.js" n'y figure pas -> rejet AVANT le transform ?raw
    // (l'id arrive ici sous la forme exacte "pagedjs/dist/paged.polyfill.js?raw").
    // On intercepte cet id en amont (enforce:'pre') et on renvoie le CHEMIN DISQUE
    // ABSOLU + la query ?raw rattachee : exports est court-circuite (ce n'est plus un
    // specifier de package mais un chemin de fichier), puis Vite applique ?raw et livre
    // la STRING, inlinee telle quelle dans le feeder. ApercuPdf.tsx, feeder.ts et
    // pagedjs-raw.d.ts restent INCHANGES.
    {
      name: 'resolve-pagedjs-polyfill',
      enforce: 'pre',
      resolveId(id) {
        const [bare, query] = id.split('?')
        if (bare === 'pagedjs/dist/paged.polyfill.js') {
          let abs
          try {
            abs = requireFromConfig.resolve('pagedjs/dist/paged.polyfill.js')
          } catch {
            // pagedjs n'exporte pas ce sous-chemin -> require.resolve echoue aussi sur
            // exports : repli direct sur le fichier disque (verifie present, 921 Ko).
            abs = path.resolve(__dirname, 'node_modules/pagedjs/dist/paged.polyfill.js')
          }
          return query ? abs + '?' + query : abs
        }
        return null
      },
    },
    react(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  }
})
