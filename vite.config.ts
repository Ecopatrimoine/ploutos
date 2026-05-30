import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Badge version (cf. footer de l'écran de sélection des dossiers).
// __APP_VERSION__ : version lue depuis package.json via npm_package_version
//   (défini par `npm run build`, en local comme sur Netlify).
// __COMMIT_HASH__ : COMMIT_REF fournie par Netlify au build, tronquée à 7
//   caractères ; "dev" en l'absence de la variable (build local).
const appVersion = process.env.npm_package_version ?? '0.0.0'
const commitHash = (process.env.COMMIT_REF ?? '').slice(0, 7) || 'dev'

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  }
})
