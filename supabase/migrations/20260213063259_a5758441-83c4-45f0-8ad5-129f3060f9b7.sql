
-- Create heartbeats table
CREATE TABLE public.heartbeats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id),
  device_id UUID NOT NULL REFERENCES public.devices(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by user
CREATE INDEX idx_heartbeats_user_id ON public.heartbeats (user_id, timestamp DESC);

-- Enable RLS (edge function uses service role so policies are optional, but good practice)
ALTER TABLE public.heartbeats ENABLE ROW LEVEL SECURITY;
