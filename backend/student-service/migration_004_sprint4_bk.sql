-- =====================================================================
-- Migration 004 student-service: tabel modul BK Sprint 4 (task #2)
-- Keputusan : docs/keputusan.md K-10 (tiga submenu BK), K-11 (surat dari
--             template, arsip read-only), K-12 (tanpa hapus, lampiran 5 MB).
-- Acuan     : database/v2 tabel pemanggilan_ortu, pendampingan_ortu,
--             pengembalian_siswa, lampiran_bk.
--
-- Perbedaan dari database/v2 (karena sistem tetap di skema existing, K-41):
--  1. ENUM v2 diganti CHECK (gaya tabel existing; aman dijalankan ulang).
--  2. Tidak ada foreign key ke tabel service lain (siswa, orang_tua, users),
--     mengikuti konvensi existing. Foreign key hanya antar tabel BK sendiri.
--  3. Ditambah created_at (dan updated_at untuk tabel yang bisa diubah),
--     seperti tabel existing lain.
--  4. Tabel baru `arsip_surat_bk` untuk surat BK yang diterbitkan (K-11).
--     Tabel `arsip_surat` existing (academic) tidak dipakai karena masih bisa
--     diubah/dihapus oleh fitur Tata Usaha; memasang trigger read-only di
--     sana akan merusak fitur tersebut. Format nomor surat menunggu T-01,
--     jadi nomor_surat boleh kosong.
--  5. Tabel lama `surat_panggilan_siswa` tidak diubah dan tetap dipakai fitur
--     lama sampai front end BK baru siap.
--
-- Idempoten : aman dijalankan ulang setiap container start.
-- =====================================================================

-- Fungsi penolak UPDATE/DELETE untuk tabel read-only (sama dengan v2).
CREATE OR REPLACE FUNCTION tolak_ubah_data() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Tabel % bersifat read-only: operasi % tidak diizinkan',
    TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

-- --- Pemanggilan orang tua (PB-01) ---------------------------------------

CREATE TABLE IF NOT EXISTS pemanggilan_ortu (
    id SERIAL PRIMARY KEY,
    siswa_id INTEGER NOT NULL,
    orang_tua_id INTEGER,
    nomor_surat VARCHAR(60) UNIQUE,
    tanggal_surat DATE,
    tanggal_panggilan DATE NOT NULL,
    jam TIME,
    tempat VARCHAR(100),
    kategori VARCHAR(20) NOT NULL
      CHECK (kategori IN ('akademik', 'kedisiplinan', 'kehadiran', 'perilaku', 'lainnya')),
    alasan TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'dijadwalkan'
      CHECK (status IN ('dijadwalkan', 'hadir', 'tidak_hadir', 'dijadwal_ulang', 'selesai')),
    hasil_pertemuan TEXT,
    kesepakatan TEXT,
    tindak_lanjut TEXT,
    dibuat_oleh UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pemanggilan_ortu_siswa_id ON pemanggilan_ortu(siswa_id);

-- --- Pendampingan & pembinaan orang tua (PB-02) --------------------------

CREATE TABLE IF NOT EXISTS pendampingan_ortu (
    id SERIAL PRIMARY KEY,
    siswa_id INTEGER NOT NULL,
    orang_tua_id INTEGER,
    jenis VARCHAR(15) NOT NULL CHECK (jenis IN ('pendampingan', 'pembinaan')),
    tanggal DATE NOT NULL,
    sesi_ke SMALLINT CHECK (sesi_ke IS NULL OR sesi_ke > 0),
    topik VARCHAR(200) NOT NULL,
    permasalahan TEXT,
    uraian_kegiatan TEXT,
    hasil TEXT,
    rencana_tindak_lanjut TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'masih_berjalan'
      CHECK (status IN ('masih_berjalan', 'selesai')),
    dibuat_oleh UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pendampingan_ortu_siswa_id ON pendampingan_ortu(siswa_id);

-- --- Pengembalian siswa kepada orang tua (PB-03) -------------------------

CREATE TABLE IF NOT EXISTS pengembalian_siswa (
    id SERIAL PRIMARY KEY,
    siswa_id INTEGER NOT NULL,
    orang_tua_id INTEGER,
    nomor_surat VARCHAR(60) UNIQUE,
    tanggal_pengajuan DATE NOT NULL,
    jenis VARCHAR(10) NOT NULL CHECK (jenis IN ('sementara', 'permanen')),
    tanggal_mulai DATE,
    tanggal_sampai DATE,
    alasan TEXT NOT NULL,
    dasar_pertimbangan TEXT,
    status VARCHAR(10) NOT NULL DEFAULT 'diajukan'
      CHECK (status IN ('diajukan', 'disetujui', 'ditolak', 'selesai')),
    diajukan_oleh UUID NOT NULL,
    diputuskan_oleh UUID,
    tanggal_keputusan TIMESTAMP,
    catatan_keputusan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Sementara wajib punya periode; permanen tidak punya tanggal_sampai (v2)
    CONSTRAINT ck_pengembalian_periode CHECK (
      (jenis = 'sementara' AND tanggal_mulai IS NOT NULL AND tanggal_sampai IS NOT NULL
         AND tanggal_sampai >= tanggal_mulai)
      OR (jenis = 'permanen' AND tanggal_sampai IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_pengembalian_siswa_siswa_id ON pengembalian_siswa(siswa_id);

-- --- Lampiran BK (bukti), maks 5 MB diperiksa di API (K-12) --------------

CREATE TABLE IF NOT EXISTS lampiran_bk (
    id SERIAL PRIMARY KEY,
    pemanggilan_id INTEGER REFERENCES pemanggilan_ortu(id),
    pendampingan_id INTEGER REFERENCES pendampingan_ortu(id),
    pengembalian_id INTEGER REFERENCES pengembalian_siswa(id),
    file_path VARCHAR(255) NOT NULL,
    file_mime VARCHAR(100),
    diunggah_oleh UUID,
    diunggah_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Satu lampiran milik tepat satu catatan BK (v2)
    CONSTRAINT ck_lampiran_bk_satu_induk
      CHECK (num_nonnulls(pemanggilan_id, pendampingan_id, pengembalian_id) = 1)
);

CREATE INDEX IF NOT EXISTS idx_lampiran_bk_pemanggilan ON lampiran_bk(pemanggilan_id);
CREATE INDEX IF NOT EXISTS idx_lampiran_bk_pendampingan ON lampiran_bk(pendampingan_id);
CREATE INDEX IF NOT EXISTS idx_lampiran_bk_pengembalian ON lampiran_bk(pengembalian_id);

-- --- Arsip surat BK yang diterbitkan dari template (K-11, read-only) -----

CREATE TABLE IF NOT EXISTS arsip_surat_bk (
    id SERIAL PRIMARY KEY,
    pemanggilan_id INTEGER REFERENCES pemanggilan_ortu(id),
    pendampingan_id INTEGER REFERENCES pendampingan_ortu(id),
    pengembalian_id INTEGER REFERENCES pengembalian_siswa(id),
    jenis_surat VARCHAR(30) NOT NULL
      CHECK (jenis_surat IN ('pemanggilan_ortu', 'pendampingan_ortu', 'pengembalian_siswa')),
    -- Format nomor menunggu konfirmasi sekolah (docs/keputusan.md T-01)
    nomor_surat VARCHAR(100) UNIQUE,
    tanggal_surat DATE NOT NULL,
    -- Salinan data yang dipakai mengisi template saat diterbitkan, supaya isi
    -- surat tetap sama walaupun data sumbernya berubah kemudian.
    data_surat JSONB NOT NULL,
    file_path VARCHAR(255),
    diterbitkan_oleh UUID NOT NULL,
    diterbitkan_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_arsip_surat_bk_satu_induk
      CHECK (num_nonnulls(pemanggilan_id, pendampingan_id, pengembalian_id) = 1)
);

DROP TRIGGER IF EXISTS trg_arsip_surat_bk_read_only ON arsip_surat_bk;
CREATE TRIGGER trg_arsip_surat_bk_read_only
  BEFORE UPDATE OR DELETE ON arsip_surat_bk
  FOR EACH ROW EXECUTE FUNCTION tolak_ubah_data();

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO student_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO student_user;
