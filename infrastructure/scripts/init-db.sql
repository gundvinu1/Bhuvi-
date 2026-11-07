-- ============================================================
-- BHUVI PostgreSQL Initialization Script
-- Executed on initial container bootstrap
-- ============================================================

-- Ensure uuid-ossp extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE 'BHUVI PostgreSQL 16 database initialized successfully.';
END $$;

