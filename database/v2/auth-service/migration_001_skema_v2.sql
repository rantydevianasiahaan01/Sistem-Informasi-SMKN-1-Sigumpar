-- =====================================================================
-- MIGRATION 001: Tabel dan indeks (skema v2)
-- Service : auth-service (akun, role, token, audit log)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Hanya CREATE TABLE/INDEX/COMMENT. Relasi ada di 002.
-- =====================================================================

CREATE TABLE "roles" (
  "id" serial PRIMARY KEY,
  "nama" varchar(50) UNIQUE NOT NULL,
  "label" varchar(100) NOT NULL
);

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "username" varchar(50) NOT NULL,
  "nama_lengkap" varchar(150) NOT NULL,
  "email" varchar(150),
  "password_hash" text NOT NULL,
  "role_id" int NOT NULL,
  "guru_id" int,
  "dibuat_oleh" uuid,
  "is_aktif" boolean NOT NULL DEFAULT true,
  "harus_ganti_password" boolean NOT NULL DEFAULT true,
  "foto_profil" varchar(255),
  "gagal_login" smallint NOT NULL DEFAULT 0,
  "terkunci_sampai" timestamptz,
  "password_updated_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "token_hash" text UNIQUE NOT NULL,
  "user_agent" text,
  "ip" text,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "replaced_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "jwt_keys" (
  "kid" text PRIMARY KEY,
  "private_pem" text NOT NULL,
  "public_pem" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "audit_log" (
  "id" bigserial PRIMARY KEY,
  "actor_user_id" uuid,
  "actor_username" varchar(50),
  "service" varchar(30) NOT NULL,
  "aksi" varchar(60) NOT NULL,
  "entitas" varchar(60) NOT NULL,
  "entitas_id" varchar(64),
  "data_lama" jsonb,
  "data_baru" jsonb,
  "ip" text,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE INDEX ON "users" ("guru_id");

CREATE UNIQUE INDEX ON "users" ("guru_id", "role_id");

CREATE INDEX ON "audit_log" ("created_at");

CREATE INDEX ON "audit_log" ("entitas", "entitas_id");

COMMENT ON COLUMN "roles"."nama" IS 'kepala-sekolah, waka-sekolah, tata-usaha, wali-kelas, guru-mapel, pramuka, vokasi, bk';

COMMENT ON COLUMN "users"."username" IS 'unik tanpa memperhatikan huruf besar/kecil: UNIQUE INDEX (LOWER(username))';

COMMENT ON COLUMN "users"."password_hash" IS 'scrypt$N$r$p$salt$hash';

COMMENT ON COLUMN "users"."role_id" IS '1 akun = 1 role; menggantikan tabel user_roles';

COMMENT ON COLUMN "users"."guru_id" IS 'orang di balik akun; null untuk staf non-guru. 1 guru boleh punya beberapa akun (1 per role)';

COMMENT ON COLUMN "users"."dibuat_oleh" IS 'akun Tata Usaha yang membuat akun ini; null hanya untuk akun admin pertama (dibuat sistem)';

COMMENT ON TABLE "audit_log" IS 'APPEND-ONLY: UPDATE dan DELETE ditolak trigger. Dipakai semua service (termasuk BK).';

COMMENT ON COLUMN "audit_log"."actor_username" IS 'snapshot saat kejadian (log historis, bukan data master)';

COMMENT ON COLUMN "audit_log"."service" IS 'auth, academic, learning, student, vocational, asset';

COMMENT ON COLUMN "audit_log"."aksi" IS 'mis. CREATE, UPDATE, DELETE, LOGIN, RESET_PASSWORD';

COMMENT ON COLUMN "audit_log"."entitas" IS 'nama tabel yang diubah';

COMMENT ON COLUMN "audit_log"."entitas_id" IS 'id baris yang diubah';
