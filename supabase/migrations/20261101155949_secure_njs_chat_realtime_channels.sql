
drop policy if exists "NJS conversation members can receive chat realtime" on realtime.messages;
drop policy if exists "NJS conversation members can send chat realtime" on realtime.messages;

create policy "NJS conversation members can receive chat realtime"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and exists (
    select 1
    from public.conversations c
    where realtime.topic() = 'njs-chat:' || c.id::text
      and (c.user_a = (select auth.uid()) or c.user_b = (select auth.uid()))
      and exists (
        select 1
        from public.connections cn
        where cn.status = 'accepted'
          and (
            (cn.requester_id = c.user_a and cn.recipient_id = c.user_b)
            or
            (cn.requester_id = c.user_b and cn.recipient_id = c.user_a)
          )
      )
  )
);

create policy "NJS conversation members can send chat realtime"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and exists (
    select 1
    from public.conversations c
    where realtime.topic() = 'njs-chat:' || c.id::text
      and (c.user_a = (select auth.uid()) or c.user_b = (select auth.uid()))
      and exists (
        select 1
        from public.connections cn
        where cn.status = 'accepted'
          and (
            (cn.requester_id = c.user_a and cn.recipient_id = c.user_b)
            or
            (cn.requester_id = c.user_b and cn.recipient_id = c.user_a)
          )
      )
  )
);
