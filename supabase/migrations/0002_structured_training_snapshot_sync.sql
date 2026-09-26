-- Migrate local-first training snapshots into structured workout tables.
-- The legacy user_sync_snapshots table remains the compatibility bridge for
-- older clients and for restoring devices before structured rows are rebuilt.

alter table public.workout_sessions
  add column if not exists client_id text,
  add column if not exists source_snapshot_key text,
  add column if not exists source_snapshot_version integer not null default 1;

alter table public.workout_exercises
  add column if not exists client_id text,
  add column if not exists source_snapshot_key text,
  add column if not exists source_snapshot_version integer not null default 1;

alter table public.workout_sets
  add column if not exists client_id text,
  add column if not exists source_snapshot_key text,
  add column if not exists source_snapshot_version integer not null default 1;

create unique index if not exists workout_sessions_user_client_id_uidx
  on public.workout_sessions(user_id, client_id)
  where client_id is not null;

create unique index if not exists workout_exercises_session_client_id_uidx
  on public.workout_exercises(workout_session_id, client_id)
  where client_id is not null;

create unique index if not exists workout_sets_exercise_client_id_uidx
  on public.workout_sets(workout_exercise_id, client_id)
  where client_id is not null;
