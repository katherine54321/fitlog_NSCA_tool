-- FitLog production schema. Apply in Supabase SQL editor or through Supabase CLI.
-- Personal and assessment data is protected by row-level security throughout.

create extension if not exists pgcrypto;

create type public.fitlog_sex as enum ('female', 'male', 'unspecified');
create type public.plan_status as enum ('draft', 'active', 'archived', 'completed');
create type public.workout_status as enum ('scheduled', 'in_progress', 'completed', 'skipped');
create type public.subscription_status as enum ('trialing', 'active', 'grace_period', 'expired', 'revoked');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  birth_date date,
  biological_sex public.fitlog_sex not null default 'unspecified',
  height_cm numeric(5,1) check (height_cm between 80 and 250),
  weight_kg numeric(5,1) check (weight_kg between 20 and 350),
  training_goal text check (char_length(training_goal) <= 80),
  unit_system text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in ('privacy', 'health_data', 'marketing')),
  policy_version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, consent_type, policy_version)
);

create table public.exercises (
  id text primary key,
  name_zh text not null,
  name_en text not null,
  category text not null,
  level text not null,
  equipment text not null,
  force text,
  mechanic text,
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  instructions_zh text[] not null default '{}',
  instructions_en text[] not null default '{}',
  content_version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exercise_media (
  id uuid primary key default gen_random_uuid(),
  exercise_id text not null references public.exercises(id) on delete cascade,
  media_type text not null check (media_type in ('start_image', 'end_image', 'video')),
  storage_path text not null,
  alt_text text,
  sort_order smallint not null default 0,
  unique (exercise_id, media_type, sort_order)
);

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  goal text,
  training_level text,
  start_date date,
  duration_weeks smallint check (duration_weeks between 1 and 52),
  status public.plan_status not null default 'draft',
  generation_inputs jsonb not null default '{}'::jsonb,
  plan_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_workouts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  week_number smallint not null check (week_number between 1 and 52),
  day_number smallint not null check (day_number between 1 and 7),
  title text not null,
  split text,
  warmup_exercise_ids text[] not null default '{}',
  stretch_exercise_ids text[] not null default '{}',
  notes text,
  unique (plan_id, week_number, day_number)
);

create table public.plan_workout_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_workout_id uuid not null references public.plan_workouts(id) on delete cascade,
  exercise_id text references public.exercises(id) on delete set null,
  exercise_name_snapshot text not null,
  phase text not null check (phase in ('warmup', 'main', 'stretch')),
  sort_order smallint not null,
  sets smallint check (sets between 1 and 20),
  rep_min smallint check (rep_min between 1 and 100),
  rep_max smallint check (rep_max between 1 and 100),
  rm_target text,
  rest_seconds smallint check (rest_seconds between 0 and 1800),
  instructions_snapshot jsonb not null default '{}'::jsonb,
  unique (plan_workout_id, phase, sort_order)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_workout_id uuid references public.plan_workouts(id) on delete set null,
  performed_on date not null,
  status public.workout_status not null default 'scheduled',
  started_at timestamptz,
  completed_at timestamptz,
  total_volume_kg numeric(12,2) not null default 0,
  total_exercise_count smallint not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id text references public.exercises(id) on delete set null,
  exercise_name_snapshot text not null,
  phase text not null check (phase in ('warmup', 'main', 'stretch')),
  sort_order smallint not null,
  planned_sets smallint,
  planned_rep_min smallint,
  planned_rep_max smallint,
  planned_rm_target text,
  unique (workout_session_id, phase, sort_order)
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number smallint not null check (set_number between 1 and 50),
  weight_kg numeric(7,2) check (weight_kg between 0 and 2000),
  reps smallint check (reps between 0 and 500),
  rm_actual text,
  rest_seconds smallint check (rest_seconds between 0 and 3600),
  completed boolean not null default true,
  unique (workout_exercise_id, set_number)
);

create table public.risk_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  questionnaire_version text not null,
  answers jsonb not null,
  risk_level text not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table public.cardio_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_version text not null,
  norms_version text not null,
  age_at_assessment smallint not null check (age_at_assessment between 20 and 79),
  biological_sex public.fitlog_sex not null,
  weight_kg numeric(5,1) not null check (weight_kg between 20 and 350),
  test_type text not null,
  run_minutes numeric(5,2) not null check (run_minutes > 0),
  resting_heart_rate smallint check (resting_heart_rate between 20 and 250),
  post_run_heart_rate smallint check (post_run_heart_rate between 20 and 250),
  estimated_vo2max numeric(5,2),
  percentile_band text,
  result_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table public.strength_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_version text not null,
  norms_version text not null,
  age_at_assessment smallint not null check (age_at_assessment between 20 and 79),
  biological_sex public.fitlog_sex not null,
  weight_kg numeric(5,1) not null check (weight_kg between 20 and 350),
  exercise_key text not null check (exercise_key in ('machine_bench_press', 'machine_leg_press')),
  ten_rm_kg numeric(7,2) not null check (ten_rm_kg > 0),
  estimated_one_rm_kg numeric(7,2) not null check (estimated_one_rm_kg > 0),
  relative_strength numeric(6,3) not null check (relative_strength > 0),
  percentile integer not null check (percentile between 0 and 100),
  interpretation text not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

-- Snapshot sync is a bridge for the current local-first PWA. Keep it while
-- old localStorage records are gradually migrated into the structured tables.
create table public.user_sync_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  client_updated_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('apple', 'web')),
  product_id text not null,
  status public.subscription_status not null,
  original_transaction_id text,
  expires_at timestamptz,
  app_account_token uuid,
  updated_at timestamptz not null default now(),
  unique (platform, original_transaction_id)
);

create table public.store_transactions (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  transaction_id text not null unique,
  original_transaction_id text,
  environment text not null check (environment in ('sandbox', 'production')),
  signed_payload text not null,
  purchased_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'processed', 'cancelled'))
);

create index training_plans_user_status_idx on public.training_plans(user_id, status, updated_at desc);
create index workout_sessions_user_date_idx on public.workout_sessions(user_id, performed_on desc);
create index cardio_assessments_user_date_idx on public.cardio_assessments(user_id, created_at desc);
create index strength_assessments_user_date_idx on public.strength_assessments(user_id, created_at desc);
create index risk_assessments_user_date_idx on public.risk_assessments(user_id, created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger exercises_updated_at before update on public.exercises for each row execute function public.set_updated_at();
create trigger plans_updated_at before update on public.training_plans for each row execute function public.set_updated_at();
create trigger workout_sessions_updated_at before update on public.workout_sessions for each row execute function public.set_updated_at();
create trigger sync_snapshots_updated_at before update on public.user_sync_snapshots for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_consents enable row level security;
alter table public.training_plans enable row level security;
alter table public.plan_workouts enable row level security;
alter table public.plan_workout_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.risk_assessments enable row level security;
alter table public.cardio_assessments enable row level security;
alter table public.strength_assessments enable row level security;
alter table public.user_sync_snapshots enable row level security;
alter table public.subscriptions enable row level security;
alter table public.account_deletion_requests enable row level security;

create policy "profiles own data" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "consents own data" on public.user_consents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "plans own data" on public.training_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "plan workouts own data" on public.plan_workouts for all using (exists (select 1 from public.training_plans p where p.id = plan_id and p.user_id = auth.uid())) with check (exists (select 1 from public.training_plans p where p.id = plan_id and p.user_id = auth.uid()));
create policy "plan exercise own data" on public.plan_workout_exercises for all using (exists (select 1 from public.plan_workouts w join public.training_plans p on p.id = w.plan_id where w.id = plan_workout_id and p.user_id = auth.uid())) with check (exists (select 1 from public.plan_workouts w join public.training_plans p on p.id = w.plan_id where w.id = plan_workout_id and p.user_id = auth.uid()));
create policy "sessions own data" on public.workout_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout exercises own data" on public.workout_exercises for all using (exists (select 1 from public.workout_sessions s where s.id = workout_session_id and s.user_id = auth.uid())) with check (exists (select 1 from public.workout_sessions s where s.id = workout_session_id and s.user_id = auth.uid()));
create policy "workout sets own data" on public.workout_sets for all using (exists (select 1 from public.workout_exercises e join public.workout_sessions s on s.id = e.workout_session_id where e.id = workout_exercise_id and s.user_id = auth.uid())) with check (exists (select 1 from public.workout_exercises e join public.workout_sessions s on s.id = e.workout_session_id where e.id = workout_exercise_id and s.user_id = auth.uid()));
create policy "risk own data" on public.risk_assessments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cardio own data" on public.cardio_assessments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "strength own data" on public.strength_assessments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "snapshots own data" on public.user_sync_snapshots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "subscriptions own read" on public.subscriptions for select using (auth.uid() = user_id);
create policy "deletion own data" on public.account_deletion_requests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.exercises enable row level security;
alter table public.exercise_media enable row level security;
create policy "public exercise read" on public.exercises for select using (is_active = true);
create policy "public exercise media read" on public.exercise_media for select using (true);
