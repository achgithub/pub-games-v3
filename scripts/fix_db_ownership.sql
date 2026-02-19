-- Transfers ownership of all user tables and sequences in the public schema
-- to the activityhub user.
-- Run as postgres superuser against each app database:
--   sudo -u postgres psql -p 5555 -d <dbname> -f scripts/fix_db_ownership.sql

DO $$
DECLARE obj record;
BEGIN
  FOR obj IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(obj.tablename) || ' OWNER TO activityhub';
  END LOOP;
  FOR obj IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public' LOOP
    EXECUTE 'ALTER SEQUENCE public.' || quote_ident(obj.sequence_name) || ' OWNER TO activityhub';
  END LOOP;
END $$;
