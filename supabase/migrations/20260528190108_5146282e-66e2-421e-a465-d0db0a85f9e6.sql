-- 1. tickets: drop anonymous read
DROP POLICY IF EXISTS "Anon can read tickets" ON public.tickets;

-- 2. user_invites: drop anonymous read (handled by SECURITY DEFINER trigger handle_new_user)
DROP POLICY IF EXISTS "Anon can check invites by email" ON public.user_invites;

-- 3. timesheet_logs: replace "true" policies with owner + admin/ti scoping
DROP POLICY IF EXISTS "Authenticated can read timesheet_logs" ON public.timesheet_logs;
DROP POLICY IF EXISTS "Authenticated can insert timesheet_logs" ON public.timesheet_logs;
DROP POLICY IF EXISTS "Authenticated can update timesheet_logs" ON public.timesheet_logs;
DROP POLICY IF EXISTS "Authenticated can delete timesheet_logs" ON public.timesheet_logs;

CREATE POLICY "Users read own timesheet; admin/ti read all"
ON public.timesheet_logs
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'ti'::app_role)
);

CREATE POLICY "Users insert own timesheet"
ON public.timesheet_logs
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users update own timesheet; admin can update any"
ON public.timesheet_logs
FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users delete own timesheet; admin can delete any"
ON public.timesheet_logs
FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 4. attachments: restrict DELETE to admin/ti
DROP POLICY IF EXISTS "Authenticated users can delete attachments" ON public.attachments;

CREATE POLICY "Admin and TI can delete attachments"
ON public.attachments
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'ti'::app_role)
);

-- 5. realtime.messages: add access control for Broadcast/Presence channels.
-- Default-deny to anon; authenticated users can only receive on topics they belong to.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated realtime receive scoped" ON realtime.messages;
CREATE POLICY "Authenticated realtime receive scoped"
ON realtime.messages
FOR SELECT TO authenticated
USING (
  -- Chat channel topics like "chat:<uuid>" → must be a member
  (
    topic LIKE 'chat:%'
    AND public.is_chat_channel_member(
      NULLIF(substring(topic from 6), '')::uuid,
      auth.uid()
    )
  )
  -- User-private topics like "user:<auth-uid>"
  OR topic = 'user:' || auth.uid()::text
  -- Presence/system topics broadcasted to all signed-in users
  OR topic IN ('presence', 'system')
);

DROP POLICY IF EXISTS "Authenticated realtime send scoped" ON realtime.messages;
CREATE POLICY "Authenticated realtime send scoped"
ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  (
    topic LIKE 'chat:%'
    AND public.is_chat_channel_member(
      NULLIF(substring(topic from 6), '')::uuid,
      auth.uid()
    )
  )
  OR topic = 'user:' || auth.uid()::text
  OR topic IN ('presence', 'system')
);

-- 6. get_user_emails: restrict to admin/ti
CREATE OR REPLACE FUNCTION public.get_user_emails()
RETURNS TABLE(user_id uuid, email text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'ti'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
    SELECT id AS user_id, u.email::text
    FROM auth.users u;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_emails() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_emails() TO authenticated;