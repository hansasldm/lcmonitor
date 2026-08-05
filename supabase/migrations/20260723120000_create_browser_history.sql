-- Create browser_history table
CREATE TABLE public.browser_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  url text NOT NULL,
  title text,
  duration_seconds int DEFAULT 0,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_browser_history_user_timestamp ON public.browser_history (user_id, "timestamp");

-- Enable RLS
ALTER TABLE public.browser_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own history
CREATE POLICY "Users can insert their own browser history"
  ON public.browser_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to read their own history
CREATE POLICY "Users can view their own browser history"
  ON public.browser_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
