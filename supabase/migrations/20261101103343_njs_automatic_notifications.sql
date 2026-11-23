
create or replace function public.create_njs_connection_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
begin
  select coalesce(nullif(bp.business_name, ''), 'A business')
    into sender_name
  from public.business_profiles bp
  where bp.owner_id = new.requester_id
  limit 1;

  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (user_id, type, title, message, link)
    values (
      new.recipient_id,
      'connection_request',
      'New connection request',
      coalesce(sender_name, 'A business') || ' wants to connect with you.',
      '/connections'
    );
  elsif tg_op = 'UPDATE'
    and old.status is distinct from new.status
    and new.status = 'accepted' then
    insert into public.notifications (user_id, type, title, message, link)
    values (
      new.requester_id,
      'connection_accepted',
      'Connection accepted',
      coalesce(sender_name, 'Your connection') || ' accepted your connection request.',
      '/connections'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists njs_connection_notification_insert on public.connections;
create trigger njs_connection_notification_insert
after insert on public.connections
for each row execute function public.create_njs_connection_notification();

drop trigger if exists njs_connection_notification_update on public.connections;
create trigger njs_connection_notification_update
after update of status on public.connections
for each row execute function public.create_njs_connection_notification();

create or replace function public.create_njs_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  sender_name text;
begin
  select case
    when c.user_a = new.sender_id then c.user_b
    else c.user_a
  end
  into recipient
  from public.conversations c
  where c.id = new.conversation_id
    and (c.user_a = new.sender_id or c.user_b = new.sender_id);

  if recipient is null then
    return new;
  end if;

  select coalesce(nullif(bp.business_name, ''), 'A business')
    into sender_name
  from public.business_profiles bp
  where bp.owner_id = new.sender_id
  limit 1;

  insert into public.notifications (user_id, type, title, message, link)
  values (
    recipient,
    'new_message',
    'New message',
    coalesce(sender_name, 'A business') || ' sent you a message.',
    '/messages'
  );

  return new;
end;
$$;

drop trigger if exists njs_message_notification_insert on public.messages;
create trigger njs_message_notification_insert
after insert on public.messages
for each row execute function public.create_njs_message_notification();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

grant select, update on public.notifications to authenticated;
