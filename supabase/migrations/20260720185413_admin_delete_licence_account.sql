-- ARCHIVE : execute manuellement au Dashboard le 2026-07-20. NE PAS REJOUER.
-- Fonction admin de suppression gardee d'un compte licence, a l'unite.
-- Seul chemin de suppression manuelle autorise. Preconditions verifiees
-- par la fonction elle-meme ; refus = exception explicite nommant le blocage.
-- Testee le 2026-07-20 : 1 suppression reelle (compte de test) +
-- contre-epreuves REFUS ABSOLU (compte protege) et REFUS staff/admin.
--
-- Gardes : (1) acting_admin_email dans public.admins ; (2) motif non vide ;
-- (3) REFUS ABSOLU ecopatrimoine@gmail.com (regle CRITIQUE structurelle) ;
-- (4) jamais staff/admin ; (5) zero activite sur les tables de travail
-- (CASCADE massif — cf. blast radius auth.users) avec distinction
-- portal_access : cote cgp_user_id = activite reelle (bloque) ;
-- cote auth_user_id = compte portail client (ne bloque que si le CGP
-- lie est ecopatrimoine@gmail.com — extension de la regle CRITIQUE aux
-- comptes satellites) ; (6) reviewed_by NO ACTION verifie en amont
-- (le DELETE echouerait sinon). Journal AVANT delete, meme transaction.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Journal des suppressions admin (ecrit AVANT le DELETE, meme transaction).
CREATE TABLE IF NOT EXISTS public.admin_deletions_log (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deleted_email      text NOT NULL,
  deleted_user_id    uuid NOT NULL,
  motif              text NOT NULL,
  acting_admin_email text NOT NULL,
  deleted_at         timestamptz NOT NULL DEFAULT now()
);

-- 2. RLS activee, AUCUNE policy : acces service role uniquement.
ALTER TABLE public.admin_deletions_log ENABLE ROW LEVEL SECURITY;

-- 3. Fonction admin (verbatim pg_get_functiondef de l'etat deploye).
CREATE OR REPLACE FUNCTION public.admin_delete_licence_account(target_email text, motif text, acting_admin_email text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid;
  v_blockers text := '';
  v_count bigint;
BEGIN
  -- Garde 1 : admin valide (table admins = liste d'emails)
  IF NOT EXISTS (
    SELECT 1 FROM public.admins a
    WHERE lower(a.email) = lower(acting_admin_email)
  ) THEN
    RAISE EXCEPTION 'REFUS : % n''est pas administrateur', acting_admin_email;
  END IF;

  -- Garde 2 : motif obligatoire
  IF motif IS NULL OR btrim(motif) = '' THEN
    RAISE EXCEPTION 'REFUS : motif obligatoire';
  END IF;

  -- Garde 3 : refus absolu, regle CRITIQUE gravee dans le code
  IF lower(target_email) = 'ecopatrimoine@gmail.com' THEN
    RAISE EXCEPTION 'REFUS ABSOLU : compte protege (clients reels)';
  END IF;

  -- Cible
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(target_email);
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'REFUS : aucun compte pour %', target_email;
  END IF;

  -- Garde 4 : jamais un compte staff ou admin
  IF EXISTS (SELECT 1 FROM public.staff WHERE user_id = v_user_id)
     OR EXISTS (SELECT 1 FROM public.admins WHERE lower(email) = lower(target_email)) THEN
    RAISE EXCEPTION 'REFUS : compte staff/admin — suppression hors perimetre de cette fonction';
  END IF;

  -- Garde 5 : zero activite (tables de travail, CASCADE massif)
  SELECT count(*) INTO v_count FROM public.clients WHERE user_id = v_user_id;
  IF v_count > 0 THEN v_blockers := v_blockers || format('clients:%s ', v_count); END IF;
  SELECT count(*) INTO v_count FROM public.crm_contacts WHERE user_id = v_user_id;
  IF v_count > 0 THEN v_blockers := v_blockers || format('crm_contacts:%s ', v_count); END IF;
  SELECT count(*) INTO v_count FROM public.crm_documents WHERE user_id = v_user_id;
  IF v_count > 0 THEN v_blockers := v_blockers || format('crm_documents:%s ', v_count); END IF;
  SELECT count(*) INTO v_count FROM public.cgp_prospects WHERE user_id = v_user_id;
  IF v_count > 0 THEN v_blockers := v_blockers || format('cgp_prospects:%s ', v_count); END IF;
  SELECT count(*) INTO v_count FROM public.portal_invitations WHERE cgp_user_id = v_user_id;
  IF v_count > 0 THEN v_blockers := v_blockers || format('portal_invitations:%s ', v_count); END IF;
  SELECT count(*) INTO v_count FROM public.portal_messages WHERE cgp_user_id = v_user_id;
  IF v_count > 0 THEN v_blockers := v_blockers || format('portal_messages:%s ', v_count); END IF;

  -- portal_access, cote CGP : la cible a ACCORDE des acces -> activite reelle, bloque
  SELECT count(*) INTO v_count FROM public.portal_access WHERE cgp_user_id = v_user_id;
  IF v_count > 0 THEN v_blockers := v_blockers || format('portal_access_cgp:%s ', v_count); END IF;

  -- portal_access, cote client : ne bloque QUE si rattache au cabinet reel (extension de la regle CRITIQUE)
  SELECT count(*) INTO v_count
  FROM public.portal_access pa
  JOIN auth.users u ON u.id = pa.cgp_user_id
  WHERE pa.auth_user_id = v_user_id
    AND lower(u.email) = 'ecopatrimoine@gmail.com';
  IF v_count > 0 THEN v_blockers := v_blockers || format('portail_client_reel:%s ', v_count); END IF;

  SELECT count(*) INTO v_count FROM public.commission_contrats WHERE user_id = v_user_id;
  IF v_count > 0 THEN v_blockers := v_blockers || format('commission_contrats:%s ', v_count); END IF;
  SELECT count(*) INTO v_count FROM public.commission_lines WHERE user_id = v_user_id;
  IF v_count > 0 THEN v_blockers := v_blockers || format('commission_lines:%s ', v_count); END IF;
  SELECT count(*) INTO v_count FROM public.ploutos_pipeline WHERE cgp_user_id = v_user_id;
  IF v_count > 0 THEN v_blockers := v_blockers || format('ploutos_pipeline:%s ', v_count); END IF;
  SELECT count(*) INTO v_count FROM public.assureur_sync WHERE user_id = v_user_id;
  IF v_count > 0 THEN v_blockers := v_blockers || format('assureur_sync:%s ', v_count); END IF;
  SELECT count(*) INTO v_count FROM public.kleios_licences WHERE user_id = v_user_id;
  IF v_count > 0 THEN v_blockers := v_blockers || format('kleios_licences:%s ', v_count); END IF;
  SELECT count(*) INTO v_count FROM public.cgp_campaigns WHERE user_id = v_user_id;
  IF v_count > 0 THEN v_blockers := v_blockers || format('cgp_campaigns:%s ', v_count); END IF;
  SELECT count(*) INTO v_count FROM public.cgp_email_templates WHERE user_id = v_user_id;
  IF v_count > 0 THEN v_blockers := v_blockers || format('cgp_email_templates:%s ', v_count); END IF;

  -- Garde 6 : le piege NO ACTION (le DELETE echouerait)
  SELECT count(*) INTO v_count FROM public.portal_questionnaire_responses WHERE reviewed_by = v_user_id;
  IF v_count > 0 THEN v_blockers := v_blockers || format('reviewed_by:%s ', v_count); END IF;

  IF v_blockers <> '' THEN
    RAISE EXCEPTION 'REFUS : activite existante — %', v_blockers;
  END IF;

  -- Journal AVANT suppression, puis suppression (meme transaction : tout ou rien)
  INSERT INTO public.admin_deletions_log (deleted_email, deleted_user_id, motif, acting_admin_email)
  VALUES (lower(target_email), v_user_id, motif, lower(acting_admin_email));

  DELETE FROM auth.users WHERE id = v_user_id;

  RETURN format('Supprime : %s (%s) — motif : %s', lower(target_email), v_user_id, motif);
END;
$function$;

-- 4. Appelable uniquement en service role (SQL Editor / EF admin).
REVOKE EXECUTE ON FUNCTION public.admin_delete_licence_account(text, text, text)
  FROM PUBLIC, anon, authenticated;
