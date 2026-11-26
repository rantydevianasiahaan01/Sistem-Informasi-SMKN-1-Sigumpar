-- Skema akun aplikasi. Menggantikan Keycloak: akun dibuat oleh tata usaha
-- lewat halaman Data Guru, bukan lewat konsol admin terpisah.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username             VARCHAR(50)  NOT NULL,
    nama_lengkap         VARCHAR(150) NOT NULL,
    email                VARCHAR(150),
    -- scrypt (bawaan Node), bukan teks polos. Format: scrypt$N$r$p$salt$hash
    password_hash        TEXT         NOT NULL,
    -- penghubung ke academic.guru; boleh kosong untuk akun non-guru
    guru_id              INTEGER,
    is_aktif             BOOLEAN      NOT NULL DEFAULT TRUE,
    harus_ganti_password BOOLEAN      NOT NULL DEFAULT TRUE,
    foto_profil          VARCHAR(255),
    gagal_login          SMALLINT     NOT NULL DEFAULT 0,
    terkunci_sampai      TIMESTAMPTZ,
    password_updated_at  TIMESTAMPTZ,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Username dibandingkan tanpa memperhatikan besar kecil huruf saat login,
-- jadi keunikannya juga harus begitu.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_guru_id ON users (guru_id);

CREATE TABLE IF NOT EXISTS roles (
    id    SERIAL PRIMARY KEY,
    nama  VARCHAR(50)  NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Refresh token disimpan ter-hash, sama seperti password: bocornya isi tabel
-- ini tidak boleh cukup untuk memakai sesi orang lain.
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    user_agent  TEXT,
    ip          TEXT,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    -- diisi saat token dirotasi; dipakai mendeteksi token lama yang dipakai ulang
    replaced_by UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_hash ON refresh_tokens (token_hash);

-- Kunci penandatangan token. Disimpan di database, bukan di berkas, supaya
-- ikut selamat saat container dibuat ulang tanpa perlu volume tersendiri.
CREATE TABLE IF NOT EXISTS jwt_keys (
    kid         TEXT PRIMARY KEY,
    private_pem TEXT NOT NULL,
    public_pem  TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id             SERIAL PRIMARY KEY,
    actor_user_id  UUID,
    actor_username VARCHAR(50),
    aksi           VARCHAR(60) NOT NULL,
    target_user_id UUID,
    detail         JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at DESC);

-- Tujuh peran yang sudah dipakai frontend untuk menggating menu dan route.
INSERT INTO roles (nama, label) VALUES
    ('kepala-sekolah', 'Kepala Sekolah'),
    ('waka-sekolah',   'Wakil Kepala Sekolah'),
    ('tata-usaha',     'Tata Usaha'),
    ('wali-kelas',     'Wali Kelas'),
    ('guru-mapel',     'Guru Mata Pelajaran'),
    ('pramuka',        'Pembina Pramuka'),
    ('vokasi',         'Vokasi')
ON CONFLICT (nama) DO NOTHING;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO auth_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO auth_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO auth_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO auth_user;
