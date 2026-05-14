CREATE TABLE public.task_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_activity_task_id ON public.task_activity(task_id, created_at DESC);
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;