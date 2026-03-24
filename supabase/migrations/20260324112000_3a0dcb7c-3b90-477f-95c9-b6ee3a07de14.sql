
-- Chat group types
CREATE TYPE public.chat_group_type AS ENUM ('GENERAL', 'TEAM', 'PROJECT');

-- Chat member roles
CREATE TYPE public.chat_member_role AS ENUM ('ADMIN', 'MEMBER');

-- Chat groups
CREATE TABLE public.chat_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  group_type chat_group_type NOT NULL DEFAULT 'GENERAL',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat group members
CREATE TABLE public.chat_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role chat_member_role NOT NULL DEFAULT 'MEMBER',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Permissive SELECT policies for realtime (app uses custom JWT auth via edge functions for all writes)
CREATE POLICY "Allow read chat_groups" ON public.chat_groups FOR SELECT USING (true);
CREATE POLICY "Allow read chat_group_members" ON public.chat_group_members FOR SELECT USING (true);
CREATE POLICY "Allow read chat_messages" ON public.chat_messages FOR SELECT USING (true);

-- Enable realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Index for fast message queries
CREATE INDEX idx_chat_messages_group_created ON public.chat_messages(group_id, created_at DESC);
CREATE INDEX idx_chat_group_members_user ON public.chat_group_members(user_id);
