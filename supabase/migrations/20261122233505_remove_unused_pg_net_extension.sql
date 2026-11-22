-- The webhook worker was retired and no other project functions, triggers, or cron jobs use pg_net.
drop extension if exists pg_net;
