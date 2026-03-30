
CREATE TYPE public.task_status AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');
CREATE TYPE public.task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status task_status NOT NULL DEFAULT 'TODO',
  priority task_priority NOT NULL DEFAULT 'MEDIUM',
  assignee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  due_date date,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_team ON public.tasks(team_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
