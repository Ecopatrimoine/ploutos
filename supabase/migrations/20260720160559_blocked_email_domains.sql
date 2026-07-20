-- 20260720160559_blocked_email_domains.sql
--
-- Validation des domaines email au signup (chantier anti-jetable). Table de
-- reference des domaines bloques, consultee par l'Edge Function
-- validate-signup-email AVANT supabase.auth.signUp.
--
-- Politique FAIL-OPEN cote appelant : cette table ne sert qu'au refus EXPLICITE
-- d'un domaine connu (reason 'disposable' au seed). Toute erreur technique cote
-- EF/front laisse passer ; le clic de confirmation email reste le juge final.
--
-- EXECUTION MANUELLE (SQL Editor, statement par statement) — ne jamais rejouer
-- automatiquement. Acces service_role uniquement : RLS activee, AUCUNE policy
-- publique (le front ne lit jamais cette table directement).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.blocked_email_domains (
  domain     text PRIMARY KEY CHECK (domain = lower(domain)),
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;

-- Aucune policy : sans policy, RLS refuse tout acces aux roles anon/authenticated.
-- Seul le client service_role (Edge Function) contourne la RLS et peut lire.

INSERT INTO public.blocked_email_domains (domain, reason) VALUES
  ('yopmail.com',      'disposable'),
  ('mailinator.com',   'disposable'),
  ('guerrillamail.com','disposable'),
  ('temp-mail.org',    'disposable'),
  ('10minutemail.com', 'disposable'),
  ('tempmail.com',     'disposable'),
  ('throwawaymail.com','disposable'),
  ('maildrop.cc',      'disposable'),
  ('getnada.com',      'disposable'),
  ('trashmail.com',    'disposable');
