-- Droits d'accès explicites pour l'API Supabase (Data API).
-- Les projets Supabase récents n'exposent plus automatiquement les nouvelles
-- tables aux rôles de l'API : on accorde ici les droits nécessaires.
-- La sécurité ligne par ligne reste assurée par les règles RLS.

-- Les visiteurs non connectés n'ont accès à rien
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
revoke execute on function public.next_workout(uuid), public.is_staff(), public.is_admin(), public.current_role_name() from public;

-- Utilisateurs connectés : accès filtré par la RLS
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.gym_exercises, public.session_summaries, public.exercise_progress to authenticated;
grant execute on function
  public.next_workout(uuid),
  public.is_staff(),
  public.is_admin(),
  public.current_role_name()
to authenticated;

-- Fonctions serveur (invitation) : rôle de service
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Les fonctions de déclencheur ne sont pas appelables via l'API
revoke execute on function public.handle_new_user(), public.guard_profile_update() from authenticated;

-- Même règle pour les tables créées plus tard
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public revoke all on tables from anon;
