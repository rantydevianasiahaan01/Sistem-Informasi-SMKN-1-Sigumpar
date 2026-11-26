-- Absensi guru: kolom untuk clock-out.
-- init.sql versi lama tidak punya kolom ini, jadi container yang sudah jalan
-- perlu ditambal lewat migrasi ini.

ALTER TABLE absensi_guru
  ADD COLUMN IF NOT EXISTS jam_keluar TIMESTAMP WITH TIME ZONE;

ALTER TABLE absensi_guru
  ADD COLUMN IF NOT EXISTS foto_pulang TEXT;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO learning_user;
