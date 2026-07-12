-- 20260712203620_c3_lifecycle_tables.sql
--
-- Chantier C3 (cycle de vie des donnees — spec Argos). Tables du pipeline de
-- demande/purge d'effacement. DDL versionne a l'identique de ce qui a ete
-- applique au Dashboard (doctrine « repo = source unique du SQL »).
--
-- DOCUMENTATION EXECUTABLE — NE JAMAIS RE-EXECUTER : ces tables existent deja
-- en base (appliquees au Dashboard). Ce fichier fait foi pour la structure ;
-- il n'est pas rejoue par un pipeline de migration.
--
-- RLS et policies deja en place cote base (non re-decrites ici faute de DDL
-- source verbatim) : service_role ALL sur les trois ; SELECT self par
-- cgp_user_id / user_id sur deletion_requests et cgp_relationship ; SELECT
-- is_staff() sur les trois. Aucune ecriture client possible : toutes les
-- ecritures passent par le client service_role des Edge Functions.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE cgp_relationship (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  relation_ended_at timestamptz,
  purge_due_at      timestamptz,
  warn_sent_at      timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE deletion_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cgp_user_id         uuid NOT NULL,
  scope               text NOT NULL CHECK (scope IN ('cabinet','dossier')),
  origin              text NOT NULL CHECK (origin IN ('cgp','retention_auto')),
  target_client_id    uuid,
  target_contact_id   uuid,
  status              text NOT NULL DEFAULT 'demande'
                      CHECK (status IN ('demande','export_remis','grace','purge','annule')),
  requested_at        timestamptz NOT NULL DEFAULT now(),
  export_delivered_at timestamptz,
  grace_ends_at       timestamptz,
  purged_at           timestamptz,
  cancelled_at        timestamptz,
  export_path         text,
  CONSTRAINT dossier_needs_target
    CHECK (scope <> 'dossier' OR target_client_id IS NOT NULL)
);

CREATE TABLE data_lifecycle_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid REFERENCES deletion_requests(id),
  actor      text NOT NULL,
  action     text NOT NULL,
  before     jsonb,
  after      jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
