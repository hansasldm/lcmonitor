-- Create browser_history table
CREATE TABLE IF NOT EXISTS public.browser_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.work_sessions(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT,
  duration_seconds INT NOT NULL DEFAULT 0,
  visited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_browser_history_user_visited ON public.browser_history (user_id, visited_at);
CREATE INDEX IF NOT EXISTS idx_browser_history_session ON public.browser_history (session_id);

-- Enable RLS
ALTER TABLE public.browser_history ENABLE ROW LEVEL SECURITY;

-- Policies

-- 1. Allow users (via extension authenticated session) to insert their own records
CREATE POLICY "Allow users to insert their own browser history"
ON public.browser_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 2. Allow users to view their own records
CREATE POLICY "Allow users to select their own browser history"
ON public.browser_history FOR SELECT
USING (auth.uid() = user_id);

-- 3. Allow admins to view all records
CREATE POLICY "Allow admins to select all browser history"
ON public.browser_history FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
);

-- 4. Allow managers to view only their team members' records
CREATE POLICY "Allow managers to select their team's browser history"
ON public.browser_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users AS caller
    JOIN public.users AS target ON target.team_id = caller.team_id
    WHERE caller.id = auth.uid() 
      AND caller.role = 'MANAGER' 
      AND target.id = browser_history.user_id
  )
);
