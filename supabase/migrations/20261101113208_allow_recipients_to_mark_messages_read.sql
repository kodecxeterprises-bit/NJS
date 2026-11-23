REVOKE UPDATE ON TABLE public.messages FROM authenticated;
GRANT UPDATE (is_read) ON TABLE public.messages TO authenticated;

DROP POLICY IF EXISTS "Recipients can mark received messages as read" ON public.messages;
CREATE POLICY "Recipients can mark received messages as read"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  sender_id <> (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.conversations conv
    JOIN public.connections c
      ON c.status = 'accepted'
     AND (
       (c.requester_id = conv.user_a AND c.recipient_id = conv.user_b)
       OR
       (c.requester_id = conv.user_b AND c.recipient_id = conv.user_a)
     )
    WHERE conv.id = messages.conversation_id
      AND (conv.user_a = (SELECT auth.uid()) OR conv.user_b = (SELECT auth.uid()))
  )
)
WITH CHECK (
  is_read = true
  AND sender_id <> (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.conversations conv
    JOIN public.connections c
      ON c.status = 'accepted'
     AND (
       (c.requester_id = conv.user_a AND c.recipient_id = conv.user_b)
       OR
       (c.requester_id = conv.user_b AND c.recipient_id = conv.user_a)
     )
    WHERE conv.id = messages.conversation_id
      AND (conv.user_a = (SELECT auth.uid()) OR conv.user_b = (SELECT auth.uid()))
  )
);
