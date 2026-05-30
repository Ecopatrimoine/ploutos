# Changelog — Ploutos

Toutes les modifications notables sont documentées ici.
Format : [Version] — Date · Added / Changed / Fixed / Removed

---

## [1.4.0] — 30 mai 2026

Module **Prévoyance personnelle** : projection des revenus de remplacement en cas d'arrêt maladie puis invalidité, par personne du foyer.

### Added
- Couverture par caisse : régime général (CPAM), indépendants (SSI), et caisses des libéraux — CARMF (médecins), CIPAV (libéraux non réglementés), CARPIMKO (paramédicaux)
- Architecture par étages : IJ obligatoires, maintien employeur, complémentaires collective et individuelle, pension d'invalidité
- Scénarios : maladie ordinaire (360 j) et affection longue durée (jusqu'à 3 ans), reprise en mi-temps thérapeutique, catégories d'invalidité projetées (Cat 1 / 2 / 3), gestion de la surcouverture
- Visualisation RDV client : graphique de projection jusqu'à la retraite ; couche pédagogique (bandeau résumé, légende, montants aux points-clés, jauge de couverture, encadrés explicatifs)
- Détection et signalement du « trou » de couverture : régime de base à sec (complémentaire seul) vs absence totale de revenu de remplacement
- Champ d'affiliation distinct pour les TNS (date de début d'activité / 1ʳᵉ affiliation, distincte de la date d'embauche)

### Changed
- Saisie du statut professionnel et de la caisse d'affiliation regroupée dans l'onglet Travail
- Informations du foyer (situation familiale, enfants, ressources du conjoint, date de mariage) dérivées automatiquement du dossier — fin des doubles saisies dans les blocs caisse

### Fixed
- Valeurs SSI 2026 vérifiées à la source (ameli) : plafonds des pensions d'invalidité (cat 1 = 1 201,50 € · cat 2 = 2 002,50 €), majoration tierce personne cat 3 (1 298,44 €), capital décès retraité corrigé (3 844,80 €), capital orphelin (2 403 €)
- Majoration familiale des IJ après le 31ᵉ jour (CPAM, ≥ 3 enfants) documentée comme supprimée (art. 85 LFSS, L.323-4 CSS) — test de non-régression ajouté

### Notes
- Les valeurs servant à la projection des caisses libérales (CARMF/CIPAV/CARPIMKO) sont vérifiées à la source. Certaines hypothèses de travail restent ouvertes, documentées en code et tests, en attente de vérification. Les caisses non encore documentées (MSA, CNBF…) sont signalées dans l'interface.

---

## [1.1.4] — Mars 2026

### Added
- Email `welcome_trial_mac` — détection automatique Mac à l'inscription, instructions clic droit → Ouvrir
- Edge Function `send-email` : nouveau type `welcome_trial_mac` dans le payload
- Dashboard admin : détail abonnement Stripe (plan mensuel/annuel · date renouvellement · cancel_at)
- Edge Function `get-sub-details` — récupère interval/period_end/cancel_at depuis Stripe
- Edge Function `create-portal-session` — Stripe Billing Portal
- Bouton Abonnement dans le header liste dossiers
- Netlify CI/CD via GitHub (branche main · .npmrc legacy-peer-deps)
- Electron Mac ARM64 — DMG + ZIP · auto-updater opérationnel
- preload.cjs — readCabinet/writeCabinet exposés · logo persiste entre releases
- Legs précis succession — bien→légataires · répartition auto quotités (TabSuccession.tsx refactorisé)
- HelpTooltip portal position:fixed — plus jamais coupé par overflow:hidden
- Tests automatisés étendus : 18 → 113 tests (succession · AV · crédit · filiation)

### Changed
- App.tsx : 2 893 → 1 788 lignes (−38%)
- PDF extraits en fonctions pures : src/lib/pdf/pdfReport.ts + pdfMission.ts
- useMemo IR/IFI/Succession — dépendances précises par calcul (perf ×3 à la saisie)
- UI helpers centralisés dans shared.tsx (HelpTooltip avec portal)
- Imports nettoyés dans App.tsx (Label · FilledBracket · TaxBracket · recharts non utilisés)
- LicenceGate mis à jour : Solo 30€/Annuel 25€ · liens Stripe live
- sw.js corrigé — POST ignorés · chrome-extension ignoré · CACHE_NAME ploutos-app-v2
- inscription.html — JS externalisé (inscription.js) · Cloudflare retiré
- index.html landing — liens téléchargement dynamiques API GitHub

### Fixed
- Bug : `calcCapitalRemaining` retournait des valeurs négatives si elapsed > duration → `Math.max(0, ...)`
- Bug : `yearsElapsedSince("not-a-date")` retournait NaN → guard `isNaN(d.getTime())`
- Bug : `priorDonations` soustrayait du taxable au lieu de réduire l'abattement résiduel
- Bug filiation parentLink : testament legs global — enfant person1_only + défunt person2 → relation `enfant_conjoint` correcte
- Webhook Stripe — JWT désactivé · `cancel_at` · `customer.subscription.updated`
- Sync cabinet Supabase — RLS 4 policies · isolation userId · clé localStorage `ploutos_cabinet_${userId}`

---

## [1.1.0] — 21 mars 2026

### Added
- Nouveau logo π SVG + lettrages (nav/footer/AuthGate/LoginTransition)
- Icônes régénérées : favicon · PNG 16/32/48/192/512/1024 · apple-touch-icon · build/icon.ico
- Migration domaine app.ploutos-cgp.fr — Netlify + Supabase (Site URL + Redirect URLs)
- Electron 1.1.0 — build et déploiement GitHub Releases · auto-updater fonctionnel

### Fixed
- LoginTransition : logoSrc base64 sans préfixe → `data:image/svg+xml;base64,${...}`
- Fix LicenceGate : nom Vision EcoPat → Ploutos · tarifs · liens Stripe
- Fix header ClientManager : `cabinet.nom` → `cabinet.cabinetName`

---

## [1.0.9] — 19 mars 2026

### Added
- HelpMenu — bouton ? dans le header, bug report / suggestion via mailto
- LoginTransition + son de connexion
- PWA manifest.webmanifest + sw.js manuels (sans vite-plugin-pwa)
- sitemap.xml + robots.txt
- Achat domaine ploutos-cgp.fr

### Fixed
- Bug critique filiation successorale — parentLink enfant vs enfant_conjoint
- Doublon champ Handicap enfants (App.tsx)
- HelpMenu dropdown position:fixed (overflow:hidden)

---

## [1.0.7] — 16-18 mars 2026

### Added
- Phase 1 : Refacto architecture — modules séparés (types, constantes, calculs)
- Phase 2 : Tests automatisés Vitest — 18 tests IR/IFI/Succession
- Phase 3 : Système de licences — Supabase + Stripe + Webhook
- Phase 4 : Dashboard Admin — gestion licences et utilisateurs
- Landing page ploutos-cgp.fr
- Edge Functions : stripe-webhook · send-email · Resend emails
- Variables .env — VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY dans Netlify

---

## [1.0.3] — 15-16 mars 2026

### Added
- Auto-updater electron-updater GitHub Releases
- Synchronisation Supabase offline-first (web ↔ Windows)
- Paramètres cabinet synchronisés sur tous appareils (Supabase)
- Assurance emprunteur DC immobilier (quotité par personne)
- Fiscalité AV rachat (annualWithdrawal)
- Widget exposition aux marchés (placements)

### Fixed
- Race condition auth : setUser + setAuthState appelés ensemble
- Double appel API Supabase au démarrage (INITIAL_SESSION ignoré)
- Sync Web → Supabase : side effects dans callbacks setState
- Clés localStorage orphelines (userId vide)

---

## [1.0.0] — Mars 2026 (version initiale)

### Added
- Collecte patrimoniale complète (famille · travail · revenus · immobilier · placements)
- Calcul IR barème 2024 + QF + PFU + frais réels
- Calcul IFI avec abattements et décote
- Calcul Succession avec héritiers, AV, testament
- Hypothèses comparatives (3 scénarios)
- Profil investisseur (lettre de mission)
- PDF Rapport patrimonial + PDF Lettre de mission
- Personnalisation cabinet (logo · couleurs · signature)
- PWA installable
- Déploiement Netlify
