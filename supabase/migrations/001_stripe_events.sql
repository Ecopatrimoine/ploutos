-- 001_stripe_events.sql
--
-- Premier SQL versionné de l'histoire du repo (comble L10 progressivement :
-- jusqu'ici le schéma, la RLS et les triggers n'existaient que dans la base live).
--
-- Cette table a été EXÉCUTÉE MANUELLEMENT au Dashboard Supabase le 2026-07-10
-- (numérotée « SQL 003 » côté Dashboard ; « 001 » ici car c'est la première
-- migration versionnée du repo). Ce fichier est le reflet EXACT de l'existant :
-- il ne doit PAS être rejoué tel quel en prod (la table existe déjà) — il sert de
-- source de vérité versionnée.
--
-- Rôle : support de l'idempotence et de la garde d'ordre du webhook Stripe
-- (cf. supabase/functions/stripe-webhook/index.ts — constat L4 du RECON licences).
-- Invariant tenu par le webhook (stratégie delete-on-failure) : une ligne présente
-- = un event appliqué avec succès. La garde d'ordre lit donc max(event_created)
-- sur les lignes présentes = sur les seuls events déjà appliqués.

create table public.stripe_events (
  event_id text primary key,
  event_type text not null,
  event_created timestamptz not null,
  stripe_sub text,
  processed_at timestamptz not null default now(),
  payload jsonb
);
create index stripe_events_sub_created on public.stripe_events (stripe_sub, event_created desc);

-- RLS activée au Dashboard (hors de ce fichier, non rejouée ici) : policies
-- « service_role ALL » + « select staff ». Le webhook écrit en service_role et
-- contourne donc la RLS. Le détail exact des policies reste à versionner
-- ultérieurement (ne pas inventer ici).
