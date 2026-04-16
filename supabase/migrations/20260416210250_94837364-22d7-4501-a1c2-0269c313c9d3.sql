
-- ============================================
-- CHAT SYSTEM (Discord-like)
-- ============================================

-- 1. CHANNELS
CREATE TABLE public.chat_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'public' CHECK (type IN ('public','private','dm','group')),
  icon TEXT NOT NULL DEFAULT 'hash',
  created_by UUID,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_channels_type ON public.chat_channels(type) WHERE archived = false;

-- 2. CHANNEL MEMBERS
CREATE TABLE public.chat_channel_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  muted BOOLEAN NOT NULL DEFAULT false,
  pinned BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_id, user_id)
);

CREATE INDEX idx_chat_members_user ON public.chat_channel_members(user_id);
CREATE INDEX idx_chat_members_channel ON public.chat_channel_members(channel_id);

-- 3. MESSAGES
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  content TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  parent_message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  pinned BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_channel_created ON public.chat_messages(channel_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_chat_messages_parent ON public.chat_messages(parent_message_id) WHERE parent_message_id IS NOT NULL;

-- 4. REACTIONS
CREATE TABLE public.chat_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX idx_chat_reactions_message ON public.chat_reactions(message_id);

-- 5. PRESENCE
CREATE TABLE public.chat_presence (
  user_id UUID NOT NULL PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online','away','busy','offline')),
  custom_status TEXT NOT NULL DEFAULT '',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- HELPER FUNCTIONS (security definer, search_path public)
-- ============================================

CREATE OR REPLACE FUNCTION public.is_chat_channel_member(_channel_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_channel_members
    WHERE channel_id = _channel_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_chat_channel_admin(_channel_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_channel_members
    WHERE channel_id = _channel_id AND user_id = _user_id AND role = 'admin'
  );
$$;

-- Counts unread messages per channel for the current user
CREATE OR REPLACE FUNCTION public.get_chat_unread_counts()
RETURNS TABLE (channel_id UUID, unread_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.channel_id, COUNT(*)::bigint AS unread_count
  FROM public.chat_messages m
  INNER JOIN public.chat_channel_members cm
    ON cm.channel_id = m.channel_id AND cm.user_id = auth.uid()
  WHERE m.deleted_at IS NULL
    AND m.author_id <> auth.uid()
    AND m.created_at > cm.last_read_at
  GROUP BY m.channel_id;
$$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_chat_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_chat_channels_updated
BEFORE UPDATE ON public.chat_channels
FOR EACH ROW EXECUTE FUNCTION public.update_chat_updated_at();

-- When a channel is created, auto-add creator as admin
CREATE OR REPLACE FUNCTION public.handle_new_chat_channel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.chat_channel_members (channel_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  -- Public channels: auto-enroll all existing users
  IF NEW.type = 'public' THEN
    INSERT INTO public.chat_channel_members (channel_id, user_id, role)
    SELECT NEW.id, p.id, CASE WHEN p.id = NEW.created_by THEN 'admin' ELSE 'member' END
    FROM public.profiles p
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_new_chat_channel
AFTER INSERT ON public.chat_channels
FOR EACH ROW EXECUTE FUNCTION public.handle_new_chat_channel();

-- When a new user signs up (profile created), auto-enroll in all public channels
CREATE OR REPLACE FUNCTION public.enroll_user_in_public_channels()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.chat_channel_members (channel_id, user_id, role)
  SELECT id, NEW.id, 'member' FROM public.chat_channels WHERE type = 'public' AND archived = false
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enroll_new_profile_chat
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enroll_user_in_public_channels();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_presence ENABLE ROW LEVEL SECURITY;

-- CHANNELS: members can see; admin manages public channels; anyone authenticated can create DM/group
CREATE POLICY "Members can view their channels" ON public.chat_channels
FOR SELECT TO authenticated
USING (public.is_chat_channel_member(id, auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can create public/private channels; users can create dm/group" ON public.chat_channels
FOR INSERT TO authenticated
WITH CHECK (
  (type IN ('public','private') AND has_role(auth.uid(), 'admin'))
  OR (type IN ('dm','group') AND created_by = auth.uid())
);

CREATE POLICY "Admin can update public channels; channel admin can update own" ON public.chat_channels
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR public.is_chat_channel_admin(id, auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin') OR public.is_chat_channel_admin(id, auth.uid()));

CREATE POLICY "Admin can delete channels" ON public.chat_channels
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- MEMBERS
CREATE POLICY "Members can view membership of their channels" ON public.chat_channel_members
FOR SELECT TO authenticated
USING (public.is_chat_channel_member(channel_id, auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Channel admin or system admin can add members" ON public.chat_channel_members
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR public.is_chat_channel_admin(channel_id, auth.uid())
  OR user_id = auth.uid()  -- self enrollment for public channels
);

CREATE POLICY "Users can update own membership; admins can update any" ON public.chat_channel_members
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR public.is_chat_channel_admin(channel_id, auth.uid()))
WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR public.is_chat_channel_admin(channel_id, auth.uid()));

CREATE POLICY "Users can leave; admins can remove" ON public.chat_channel_members
FOR DELETE TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR public.is_chat_channel_admin(channel_id, auth.uid()));

-- MESSAGES
CREATE POLICY "Members can view messages" ON public.chat_messages
FOR SELECT TO authenticated
USING (public.is_chat_channel_member(channel_id, auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can post messages" ON public.chat_messages
FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND public.is_chat_channel_member(channel_id, auth.uid()));

CREATE POLICY "Authors can update own messages; channel admin can pin" ON public.chat_messages
FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR public.is_chat_channel_admin(channel_id, auth.uid()) OR has_role(auth.uid(), 'admin'))
WITH CHECK (author_id = auth.uid() OR public.is_chat_channel_admin(channel_id, auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Authors and admins can delete messages" ON public.chat_messages
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.is_chat_channel_admin(channel_id, auth.uid()) OR has_role(auth.uid(), 'admin'));

-- REACTIONS
CREATE POLICY "Members can view reactions" ON public.chat_reactions
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = message_id AND public.is_chat_channel_member(m.channel_id, auth.uid())));

CREATE POLICY "Members can add own reactions" ON public.chat_reactions
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = message_id AND public.is_chat_channel_member(m.channel_id, auth.uid())));

CREATE POLICY "Users can remove own reactions" ON public.chat_reactions
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- PRESENCE: anyone authenticated reads, only own user updates
CREATE POLICY "Authenticated can view presence" ON public.chat_presence
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users manage own presence" ON public.chat_presence
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own presence" ON public.chat_presence
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================
-- REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channel_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channels;

ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.chat_channel_members REPLICA IDENTITY FULL;
ALTER TABLE public.chat_presence REPLICA IDENTITY FULL;
ALTER TABLE public.chat_channels REPLICA IDENTITY FULL;

-- ============================================
-- SEED initial public channels
-- ============================================
INSERT INTO public.chat_channels (name, description, type, icon) VALUES
  ('ti', 'Discussões e avisos do time de TI', 'public', 'monitor'),
  ('marketing', 'Discussões e avisos do time de Marketing', 'public', 'megaphone'),
  ('suporte-ti', 'Notificações automáticas de novos chamados e SLAs', 'public', 'life-buoy')
ON CONFLICT DO NOTHING;
