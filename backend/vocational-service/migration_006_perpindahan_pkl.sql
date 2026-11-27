-- =====================================================================
-- Migration 006 vocational-service: riwayat perpindahan lokasi PKL
-- (Sprint 4, task #2). API-nya dikerjakan di Sprint 5 (K-42).
-- Keputusan : docs/keputusan.md K-21 (tanggal, alasan, pihak penyetuju;
--             data perpindahan permanen, tidak bisa diubah/dihapus).
-- Acuan     : database/v2 tabel `perpindahan_pkl`.
--
-- Perbedaan dari database/v2 (karena sistem tetap di skema existing, K-41):
--  1. v2 merujuk tabel `penempatan_pkl`, yang belum ada di skema existing.
--     Penempatan PKL existing tersimpan di `laporan_lokasi_pkl`, jadi lokasi
--     asal dan tujuan merujuk ke tabel itu. siswa_id disimpan langsung
--     supaya riwayat per siswa mudah dibaca.
--  2. ENUM `penyetuju_pindah_enum` diganti CHECK.
--  3. Tabel `koreksi_perpindahan` v2 belum dibuat (belum dibutuhkan Sprint 4).
--
-- Idempoten : aman dijalankan ulang setiap container start.
-- =====================================================================

CREATE OR REPLACE FUNCTION tolak_ubah_data() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Tabel % bersifat read-only: operasi % tidak diizinkan',
    TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS perpindahan_pkl (
    id SERIAL PRIMARY KEY,
    siswa_id INTEGER NOT NULL,
    lokasi_asal_id INTEGER NOT NULL REFERENCES laporan_lokasi_pkl(id),
    lokasi_tujuan_id INTEGER NOT NULL UNIQUE REFERENCES laporan_lokasi_pkl(id),
    urutan SMALLINT NOT NULL CHECK (urutan > 0),
    tanggal_pindah DATE NOT NULL,
    alasan TEXT NOT NULL,
    disetujui_oleh VARCHAR(20) NOT NULL
      CHECK (disetujui_oleh IN ('koordinator_pkl', 'waka_humas', 'kepala_sekolah')),
    dokumen_pendukung VARCHAR(255),
    dicatat_oleh UUID,
    dicatat_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_perpindahan_beda_lokasi CHECK (lokasi_asal_id <> lokasi_tujuan_id),
    CONSTRAINT uq_perpindahan_urutan UNIQUE (siswa_id, urutan)
);

CREATE INDEX IF NOT EXISTS idx_perpindahan_pkl_siswa_id ON perpindahan_pkl(siswa_id);

-- Perpindahan bersifat permanen (K-21)
DROP TRIGGER IF EXISTS trg_perpindahan_pkl_permanen ON perpindahan_pkl;
CREATE TRIGGER trg_perpindahan_pkl_permanen
  BEFORE UPDATE OR DELETE ON perpindahan_pkl
  FOR EACH ROW EXECUTE FUNCTION tolak_ubah_data();

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vocational_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vocational_user;
