#!/bin/bash
set -e
npm install
npx drizzle-kit push --force
psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS session (sid VARCHAR NOT NULL COLLATE \"default\", sess JSON NOT NULL, expire TIMESTAMP(6) NOT NULL, CONSTRAINT session_pkey PRIMARY KEY (sid)); CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);"
