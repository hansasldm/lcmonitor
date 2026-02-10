
-- Enums
CREATE TYPE public.user_role AS ENUM ('EMPLOYEE', 'MANAGER', 'ADMIN');
CREATE TYPE public.user_status AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE public.os_type AS ENUM ('WINDOWS', 'MACOS', 'LINUX');
CREATE TYPE public.event_type AS ENUM ('LOGIN', 'LOGOUT', 'ACTIVITY', 'IDLE_START', 'IDLE_END', 'MANUAL_CLOCK_IN', 'MANUAL_CLOCK_OUT');
CREATE TYPE public.session_source AS ENUM ('AUTO', 'MANUAL', 'MIXED');
CREATE TYPE public.attendance_status AS ENUM ('PRESENT', 'ABSENT', 'LEAVE', 'HOLIDAY');
CREATE TYPE public.correction_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Teams table (created first since users references it)
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  manager_id uuid, -- FK added after users table
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Users table
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'EMPLOYEE',
  team_id uuid REFERENCES public.teams(id),
  status public.user_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add manager FK on teams now that users exists
ALTER TABLE public.teams ADD CONSTRAINT fk_teams_manager FOREIGN KEY (manager_id) REFERENCES public.users(id);

-- Devices table
CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id),
  os_type public.os_type NOT NULL,
  last_seen_at timestamptz
);

-- Events table
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  device_id uuid REFERENCES public.devices(id),
  type public.event_type NOT NULL,
  "timestamp" timestamptz NOT NULL,
  metadata jsonb,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz
);

-- Work sessions table
CREATE TABLE public.work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  date date NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  total_active_seconds int NOT NULL DEFAULT 0,
  total_idle_seconds int NOT NULL DEFAULT 0,
  source public.session_source NOT NULL DEFAULT 'MANUAL',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- Attendance table
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  date date NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'PRESENT',
  total_work_seconds int NOT NULL DEFAULT 0,
  overtime_seconds int NOT NULL DEFAULT 0,
  undertime_seconds int NOT NULL DEFAULT 0,
  notes text,
  UNIQUE (user_id, date)
);

-- Attendance corrections table
CREATE TABLE public.attendance_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  date date NOT NULL,
  original_in timestamptz,
  original_out timestamptz,
  requested_in timestamptz NOT NULL,
  requested_out timestamptz NOT NULL,
  reason text NOT NULL,
  status public.correction_status NOT NULL DEFAULT 'PENDING',
  reviewer_id uuid REFERENCES public.users(id),
  reviewed_at timestamptz
);

-- Indexes
CREATE INDEX idx_events_user_timestamp ON public.events (user_id, "timestamp");
CREATE INDEX idx_events_device_timestamp ON public.events (device_id, "timestamp");
CREATE UNIQUE INDEX idx_devices_device_id ON public.devices (device_id);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_work_sessions_updated_at BEFORE UPDATE ON public.work_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Disable RLS on all tables (access control via edge functions + JWT)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_corrections DISABLE ROW LEVEL SECURITY;
