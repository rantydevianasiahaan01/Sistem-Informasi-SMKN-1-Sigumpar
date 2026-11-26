# Aturan Kerja Git Tim

Repo ini dipakai bersama oleh seluruh anggota. Supaya tidak ada kode yang hilang
atau tertimpa, **tidak ada yang push langsung ke `main`**. Semua perubahan masuk
lewat Pull Request yang dicek dan di-merge oleh **Project Manager (PM)**.

## Ringkasan

| Siapa | Boleh | Tidak boleh |
|---|---|---|
| Semua anggota | Membuat branch sendiri, push ke branch sendiri, membuat Pull Request | Push langsung ke `main`, force push, menghapus branch orang lain |
| PM | Mereview dan merge Pull Request ke `main` | Merge PR yang belum dicek atau masih konflik |

## Alur kerja setiap task

```bash
# 1. Ambil kode terbaru sebelum mulai
git checkout main
git pull

# 2. Buat branch untuk task ini (lihat aturan nama di bawah)
git checkout -b fitur/PB-05-input-nilai

# 3. Kerjakan, lalu simpan perubahan sesering perlu
git add .
git commit -m "PB-05: tambah penilaian harian dinamis"

# 4. Kirim branch ke GitHub
git push -u origin fitur/PB-05-input-nilai
```

5. Buka repo di GitHub, klik **Compare & pull request**.
6. Isi judul dan deskripsi (lihat format di bawah), pilih PM sebagai **Reviewer**.
7. Tunggu PM menyetujui dan melakukan merge. Jika PM minta perbaikan, commit lagi
   di branch yang sama lalu `git push`: PR akan ikut ter-update.
8. Setelah di-merge, kembali ke langkah 1 untuk task berikutnya.

## Aturan nama branch

`<jenis>/<PB-ID>-<deskripsi-singkat>`, huruf kecil, pisahkan dengan tanda `-`.

| Jenis | Dipakai untuk | Contoh |
|---|---|---|
| `fitur/` | Fitur baru | `fitur/PB-01-bk-pemanggilan` |
| `perbaikan/` | Memperbaiki bug | `perbaikan/PB-05-nilai-akhir-salah` |
| `db/` | Perubahan database (migration/seed) | `db/tambah-kolom-pkl` |
| `dok/` | Dokumentasi saja | `dok/readme-cara-menjalankan` |

## Format commit

`<PB-ID>: <apa yang diubah>`, contoh:
- `PB-08: tambah pratinjau cetak surat BK`
- `PB-06: perbaiki validasi tanggal perpindahan PKL`

## Format Pull Request

- **Judul:** sama dengan task, misalnya `PB-05 Input Nilai: penilaian harian dinamis`
- **Deskripsi:**
  - Apa yang diubah
  - Cara mengetes (halaman mana, login sebagai role apa)
  - Screenshot tampilan (untuk perubahan front end)

## Checklist PM sebelum merge

- [ ] Tidak ada konflik dengan `main`
- [ ] Tidak ada file rahasia (`.env`, `.env.*` selain `.env.example`) atau isi `uploads/`
- [ ] Fitur sudah dicoba dan sesuai desain Figma
- [ ] Perubahan database ditulis sebagai file migration baru di `database/`, bukan mengubah tabel manual

## Jika terjadi konflik

```bash
git checkout fitur/PB-05-input-nilai
git pull origin main          # tarik perubahan terbaru dari main
# perbaiki file yang ditandai konflik (<<<<<<< ======= >>>>>>>), lalu:
git add .
git commit -m "PB-05: selesaikan konflik dengan main"
git push
```

Kalau ragu, **jangan hapus kode orang lain**: tanyakan ke pemilik kode atau PM dulu.

## Yang tidak boleh di-commit

- File `.env` dan semua cadangannya (`.env.old`, `.env.bak-*`): berisi password.
- Isi folder `uploads/`: berisi surat dan dokumen sekolah.
- `node_modules/`.

Semua sudah diatur di `.gitignore`. Sebelum commit, selalu cek dengan `git status`.

## Database

Struktur database ada di `database/v2/` (lihat `database/v2/README.md`).
Perubahan struktur database **wajib** lewat file migration baru dan dicatat di PR,
supaya semua anggota bisa membangun database yang sama.
