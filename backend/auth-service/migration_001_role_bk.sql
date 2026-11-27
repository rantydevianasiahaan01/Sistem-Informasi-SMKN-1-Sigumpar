-- =====================================================================
-- Migration 001 auth-service: role Guru BK (Sprint 4, task #2)
-- Keputusan: docs/keputusan.md K-10 (role baru `bk` untuk modul BK).
-- Acuan     : database/v2/seed/seed_001_data_awal.sql (daftar role v2).
-- Idempoten : aman dijalankan ulang setiap container start.
-- =====================================================================

INSERT INTO roles (nama, label) VALUES ('bk', 'Guru BK')
ON CONFLICT (nama) DO NOTHING;
