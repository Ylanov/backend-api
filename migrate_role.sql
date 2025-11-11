DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = ''userrole'') THEN
    CREATE TYPE userrole AS ENUM (''admin_mchs'',''team_lead'',''senior_pyro'',''pyrotechnician'',''trainee'');
  END IF;
END$$;

ALTER TABLE IF EXISTS pyrotechnicians
  ADD COLUMN IF NOT EXISTS role userrole NOT NULL DEFAULT ''pyrotechnician'';

CREATE INDEX IF NOT EXISTS ix_pyrotechnicians_role ON pyrotechnicians (role);