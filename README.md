# Ploutos — Logiciel de gestion patrimoniale CGP

**Version 1.1.4** · React + TypeScript + Vite + Electron + Supabase

Logiciel SaaS destiné aux Conseillers en Gestion de Patrimoine (CGP) indépendants. Calcul IR/IFI/Succession, production de documents réglementaires, gestion multi-clients offline-first.

---

## URLs

| Environnement | URL |
|---|---|
| App web | https://app.ploutos-cgp.fr |
| Landing page | https://ploutos-cgp.fr |
| GitHub | https://github.com/Ecopatrimoine/ploutos (privé) |
| Supabase | https://ysbgfiqsuvdwzkcsiqir.supabase.co |
| Netlify app | extraordinary-brigadeiros-e46e18 |

## Développement local

```bash
# Installer les dépendances
npm install --legacy-peer-deps

# Dev web
npm run dev                    # http://localhost:5173

# Dev Electron (hot-reload)
npm run electron:dev

# Tests
npm run test
npm run test:watch

# Build web
npm run build                  # génère dist/
```

## Déploiement

### Web (Netlify)
```bash
npm run build
# Glisser dist/ sur app.netlify.com → Deploys
```

### Edge Functions Supabase
```powershell
# ⚠️ BOM Unicode — toujours renommer .env avant de déployer
Rename-Item .env .env.bak
npx supabase functions deploy [nom] --project-ref ysbgfiqsuvdwzkcsiqir
Rename-Item .env.bak .env
```

### Electron Windows (release)
```powershell
npm version X.X.X --no-git-tag-version
$env:GH_TOKEN = [System.Environment]::GetEnvironmentVariable('GH_TOKEN', 'User')
npm run release
# → GitHub → Releases → Publier la Draft manuellement
```

### Electron Mac (release)
```bash
npm version X.X.X --no-git-tag-version
export GH_TOKEN='ghp_...'
npm run release:mac
```

## Variables d'environnement

Fichier `.env` à la racine (jamais committé) :
```
VITE_SUPABASE_URL=https://ysbgfiqsuvdwzkcsiqir.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Netlify : mêmes variables dans Environment Variables du site.

Secrets Supabase (Edge Functions) :
- `STRIPE_SECRET_KEY` (sk_live_...)
- `STRIPE_WEBHOOK_SECRET` (whsec_...)
- `RESEND_API_KEY`

## Architecture

```
src/
├── App.tsx                  # Composant principal (~1 800 lignes)
├── useClients.tsx           # CRUD clients + sync Supabase
├── hooks/
│   ├── useAuth.ts           # Auth + grace period 72h
│   ├── useLicense.ts        # Vérification licence
│   └── useAdmin.ts          # Dashboard admin
├── components/
│   ├── AuthGate.tsx         # Login/register/reset
│   ├── LicenceGate.tsx      # Écran abonnement expiré
│   ├── AdminDashboard.tsx   # Dashboard admin
│   ├── shared.tsx           # UI helpers (Field, MetricCard...)
│   └── tabs/                # TabFamiliale, TabIR, TabSuccession...
├── lib/
│   ├── calculs/             # ir.ts · ifi.ts · succession.ts · credit.ts
│   ├── pdf/                 # pdfReport.ts · pdfMission.ts
│   └── supabase.ts          # Client Supabase
├── types/
│   └── patrimoine.ts        # Tous les types TypeScript
└── constants/
    └── index.ts             # BRAND · SURFACE · barèmes fiscaux

electron/
├── main.cjs                 # Process Electron + auto-updater
└── preload.cjs              # contextBridge (readCabinet/writeCabinet)

supabase/functions/
├── stripe-webhook/          # Événements Stripe → mise à jour licences
├── send-email/              # Emails Resend (welcome, trial_expiring...)
├── create-portal-session/   # Stripe Billing Portal
└── get-sub-details/         # Détails abonnement Stripe
```

## Tests

```bash
npm run test          # 113 tests Vitest
npm run test:watch    # Mode watch
```

Couverture : IR · IFI · Succession (filiation, legs, AV) · Crédit immobilier · Fiscalité AV

## Notes importantes

- **BOM Unicode** : toujours renommer `.env` → `.env.bak` avant `supabase functions deploy`
- **Stripe PRODUCTION** : cartes test 4242 refusées
- **JWT désactivé** : sur toutes les Edge Functions
- **Logo/signature** : jamais en Supabase — localStorage + Electron uniquement
- **v1.0.0** : ne reçoit pas les MAJ auto Electron (pas d'electron-updater intégré)
- **Barème km 2026** : disponible après 4 avril → mettre à jour `src/constants/index.ts`
- **Renouvellement Stripe** : premier renouvellement réel le 21 avril → tester avant

## Licence

Propriétaire — EcoPatrimoine Conseil · David PERRY — Confidentiel
