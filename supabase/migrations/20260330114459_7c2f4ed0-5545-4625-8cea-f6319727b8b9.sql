CREATE TABLE public.breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.work_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  break_start timestamp with time zone NOT NULL,
  break_end timestamp with time zone,
  duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.breaks ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_breaks_user_date ON public.breaks(user_id, date);
CREATE INDEX idx_breaks_session ON public.breaks(session_id);