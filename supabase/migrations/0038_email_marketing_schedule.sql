-- RealAminos — schedule the email marketing job
-- Run this in the Supabase SQL Editor AFTER 0037 — and FIRST replace
-- YOUR_CRON_SECRET below with the same CRON_SECRET value that's set in Vercel
-- (and used by your abandoned-checkout job).
--
-- Every 10 minutes it pings /api/cron/email-marketing. That does NOT mean an
-- email every 10 minutes — the endpoint only starts a new send when the
-- interval (default 48 hours) has passed, and the 10-minute pings just
-- finish delivering a send that's already in progress. Nothing is sent until
-- you turn sending on at /admin/email-marketing.

create extension if not exists pg_net;

select cron.schedule(
  'email-marketing',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://shoprealaminos.com/api/cron/email-marketing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
