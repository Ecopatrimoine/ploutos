# Spec — Fusion stripe-webhook multi-produit (idempotence + routage)
Statut : A FAIRE (P1). Proprietaire : Ploutos. Redige le 12/07/2026.

## Contexte
La prod (v33, byte-identique a cette source) porte l'idempotence complete (stripe_events, garde d'ordre, undoAndFail) mais est mono-produit : tout event est traite comme Ploutos via lookup licences.stripe_sub. Le routage Lunelos n'existait que dans l'ex-copie Kleios (supprimee le 12/07, source en historique git Kleios, commit 340fcee). stripe_events etait vide au 12/07 : aucun event rate a rejouer.

## Cible
Un seul webhook, un seul endpoint Stripe (existant), routage par produit AVANT l'application metier :
1. Determination du produit : a l'event, extraire le price id (subscription items / invoice lines / checkout line_items via l'API si absent du payload). Mapping price->produit dans une NOUVELLE colonne stripe_price_ids (jsonb, tableau) de argos_products (axe 3 : plus de produits en dur ; migration SQL a executer manuellement au Dashboard, versionnee dans le repo Argos). Produit inconnu -> log warn + traitement Ploutos par defaut (comportement actuel) + event marque product='unknown'.
2. Colonne product (text) ajoutee a stripe_events (meme migration) — renseignee a l'insert d'idempotence. L'idempotence reste globale sur event_id.
3. Application metier par produit : ploutos -> logique actuelle inchangee (licences). lunelos -> reprendre la logique de l'ex-copie Kleios (updateLunelosLicense sur le projet blsubmbtxtphluuhxdmf, second client cree avec secrets LUNELOS_URL + LUNELOS_SERVICE_ROLE_KEY — verifier leur presence au Dashboard avant deploy). Les mappings type->status Ploutos sont INCHANGES (cancelling/cancel_at inclus).
4. La garde d'ordre et undoAndFail s'appliquent a tous les produits.

## Contraintes
- Zero regression Ploutos : les cas actuels doivent produire exactement les memes ecritures licences.
- Recon prealable obligatoire : relire l'ex-copie Kleios (git show 340fcee:Supabase/functions/stripe-webhook/index.ts) pour extraire la logique Lunelos exacte.
- Tests : scenarios golden documentes dans la spec d'implementation (checkout ploutos, checkout lunelos, updated cancelling, deleted, event duplique, event stale, price inconnu). Validation finale par events de test Stripe (mode test) avant bascule.
- Deploiement : nomme, --no-verify-jwt (signature Stripe), workaround BOM.

## Hors perimetre
Migration de l'endpoint Stripe, refonte des emails, autres produits que Ploutos/Lunelos (le registre les accueillera naturellement).
