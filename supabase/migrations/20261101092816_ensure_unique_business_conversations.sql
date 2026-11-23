create unique index if not exists conversations_unordered_pair_key on public.conversations (least(user_a, user_b), greatest(user_a, user_b));
