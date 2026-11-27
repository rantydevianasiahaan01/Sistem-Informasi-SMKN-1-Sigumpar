# Daftar Endpoint Sprint 4

Ringkasan dari [`openapi.yaml`](openapi.yaml). Detail request, response, dan contoh error
ada di file itu. Konvensi umum: [`README.md`](README.md).

- Semua endpoint memakai `Authorization: Bearer <token>`.
- **(baru)** = dibuat di Sprint 4. Endpoint lama tidak diubah.
- Tahun ajaran: parameter `tahun_ajaran_id` opsional, default tahun ajaran aktif.
- Nilai kosong = `null`, bukan 0 (K-02).

Halaman Figma: Input Nilai & BK di file `KVxCP0BxFlOtqFoV2MGNcd`, PKL di file
`KUK6SetBz9D5vSHXja8odf` (lihat `AGENTS.md`). Kolom "Halaman Figma" memakai nama halaman di file tersebut.

## Input Nilai (student-service)

`mapel_id` = id `mata_pelajaran`. Di skema yang berjalan (K-41) satu baris `mata_pelajaran`
berisi mapel + kelas + guru, jadi berperan sebagai "pengampu".

| Modul | Method | Endpoint | Deskripsi | Role | Halaman Figma |
|---|---|---|---|---|---|
| Input Nilai | GET | `/api/student/nilai/pengampu` | (baru) Daftar mapel + kelas yang diampu guru (dropdown) | guru-mapel | fitur guru mapel - input nilai & Rekap |
| Input Nilai | GET | `/api/student/nilai/pengampu/{mapel_id}?semester=` | (baru) Tabel nilai: siswa, komponen, kolom P1..Pn, rata-rata Harian, perilaku, nilai akhir (K-02), bobot, konversi | guru-mapel | fitur guru mapel - input nilai & Rekap |
| Input Nilai | PUT | `/api/student/nilai/pengampu/{mapel_id}` | (baru) Simpan nilai banyak siswa; hanya kolom yang dikirim yang diubah; tercatat di riwayat | guru-mapel | fitur guru mapel - input nilai & Rekap |
| Input Nilai | PUT | `/api/student/nilai/pengampu/{mapel_id}/bobot` | (baru) Panel Atur Bobot, total wajib 100 (K-03) | guru-mapel | fitur guru mapel - input nilai & Rekap |
| Input Nilai | PUT | `/api/student/nilai/pengampu/{mapel_id}/konversi-perilaku` | (baru) Modal Konversi Nilai Perilaku A-E, diisi guru (K-04) | guru-mapel | fitur guru mapel - input nilai & Rekap |
| Input Nilai | GET | `/api/student/nilai/pengampu/{mapel_id}/harian?semester=` | (baru) Daftar penilaian harian P1, P2, ... | guru-mapel | fitur guru mapel - input nilai & Rekap |
| Input Nilai | POST | `/api/student/nilai/pengampu/{mapel_id}/harian` | (baru) Tombol "+ Tambah" penilaian harian; nomor P otomatis (K-01) | guru-mapel | fitur guru mapel - input nilai & Rekap |
| Input Nilai | GET | `/api/student/nilai/harian/{id}` | (baru) Satu penilaian harian + nilai semua siswa | guru-mapel | fitur guru mapel - input nilai & Rekap |
| Input Nilai | PUT | `/api/student/nilai/harian/{id}` | (baru) Isi nilai harian dan/atau ubah judul, jenis, tanggal | guru-mapel | fitur guru mapel - input nilai & Rekap |
| Input Nilai | DELETE | `/api/student/nilai/harian/{id}` | (baru) Hapus kolom penilaian harian beserta nilainya | guru-mapel | fitur guru mapel - input nilai & Rekap |

Endpoint lama yang tetap: `GET/POST /api/student/nilai`, `GET /api/student/nilai/siswa`,
`GET /api/student/nilai/assignments`, `GET /api/student/rekap-nilai` (dipakai halaman sebelum Sprint 4).

## BK (student-service)

Tidak ada `DELETE` untuk data BK, lampiran, maupun arsip surat (K-11, K-12). Semua tindakan
yang mengubah data dicatat di audit log. Wali kelas hanya melihat siswa kelas perwaliannya
pada tahun ajaran aktif; data lain dijawab 404.

| Modul | Method | Endpoint | Deskripsi | Role | Halaman Figma |
|---|---|---|---|---|---|
| BK | GET | `/api/student/bk/siswa?cari=` | (baru) Cari siswa aktif untuk form BK | bk, wali-kelas, kepala-sekolah, waka-sekolah | semua halaman BK |
| BK | GET | `/api/student/bk/siswa/{id}` | (baru) Profil siswa, orang tua, seluruh catatan BK | bk, wali-kelas, kepala-sekolah, waka-sekolah | semua halaman BK |
| BK Pemanggilan (PB-01) | GET | `/api/student/bk/pemanggilan` | (baru) Riwayat pemanggilan; filter status, kategori, siswa, tanggal | bk, wali-kelas, kepala-sekolah, waka-sekolah | fitur BK - pemanggilan orang tua |
| BK Pemanggilan (PB-01) | POST | `/api/student/bk/pemanggilan` | (baru) Buat pemanggilan (status awal `dijadwalkan`) | bk, wali-kelas | fitur BK - pemanggilan orang tua |
| BK Pemanggilan (PB-01) | GET | `/api/student/bk/pemanggilan/{id}` | (baru) Detail pemanggilan | bk, wali-kelas, kepala-sekolah, waka-sekolah | fitur BK - pemanggilan orang tua |
| BK Pemanggilan (PB-01) | PUT | `/api/student/bk/pemanggilan/{id}` | (baru) Ubah / ubah status / isi hasil pertemuan; selesai = terkunci | bk, wali-kelas (buatannya sendiri) | fitur BK - pemanggilan orang tua |
| BK Pendampingan (PB-02) | GET | `/api/student/bk/pendampingan` | (baru) Riwayat pendampingan & pembinaan | bk, wali-kelas, kepala-sekolah, waka-sekolah | fitur BK - Pendampingan & Pembinaan Orang Tua |
| BK Pendampingan (PB-02) | POST | `/api/student/bk/pendampingan` | (baru) Catat pendampingan / pembinaan; nomor sesi otomatis | bk | fitur BK - Pendampingan & Pembinaan Orang Tua |
| BK Pendampingan (PB-02) | GET | `/api/student/bk/pendampingan/{id}` | (baru) Detail pendampingan | bk, wali-kelas, kepala-sekolah, waka-sekolah | fitur BK - Pendampingan & Pembinaan Orang Tua |
| BK Pendampingan (PB-02) | PUT | `/api/student/bk/pendampingan/{id}` | (baru) Ubah / tandai selesai; selesai = terkunci | bk | fitur BK - Pendampingan & Pembinaan Orang Tua |
| BK Pengembalian (PB-03) | GET | `/api/student/bk/pengembalian` | (baru) Daftar pengajuan (yang `diajukan` di atas) | bk, wali-kelas, kepala-sekolah, waka-sekolah | fitur BK - Pengembalian mahasiswa |
| BK Pengembalian (PB-03) | POST | `/api/student/bk/pengembalian` | (baru) Ajukan pengembalian sementara/permanen | bk | fitur BK - Pengembalian mahasiswa |
| BK Pengembalian (PB-03) | GET | `/api/student/bk/pengembalian/{id}` | (baru) Detail pengembalian | bk, wali-kelas, kepala-sekolah, waka-sekolah | fitur BK - Pengembalian mahasiswa |
| BK Pengembalian (PB-03) | PUT | `/api/student/bk/pengembalian/{id}` | (baru) Ubah pengajuan selama masih `diajukan` | bk | fitur BK - Pengembalian mahasiswa |
| BK Pengembalian (PB-03) | POST | `/api/student/bk/pengembalian/{id}/keputusan` | (baru) Setujui / tolak; permanen disetujui = status siswa `dikembalikan` | kepala-sekolah | fitur BK - Pengembalian mahasiswa |
| BK Pengembalian (PB-03) | POST | `/api/student/bk/pengembalian/{id}/selesai` | (baru) Tandai pengembalian yang disetujui selesai | bk | fitur BK - Pengembalian mahasiswa |
| BK Lampiran | GET | `/api/student/bk/lampiran?pemanggilan_id=` (atau `pendampingan_id` / `pengembalian_id`) | (baru) Daftar lampiran satu catatan | bk, wali-kelas, kepala-sekolah, waka-sekolah | semua halaman BK |
| BK Lampiran | POST | `/api/student/bk/lampiran` | (baru) Unggah PDF/JPG/PNG maks 5 MB (multipart) | bk | semua halaman BK |
| BK Lampiran | GET | `/api/student/bk/lampiran/{id}` | (baru) Unduh file (hanya dengan token) | bk, wali-kelas, kepala-sekolah, waka-sekolah | semua halaman BK |
| BK Surat (PB-08) | GET | `/api/student/bk/surat/pratinjau?pemanggilan_id=` (atau lainnya) | (baru) Data pengisi template untuk pratinjau; tidak menyimpan | bk, wali-kelas | semua halaman BK (modal pratinjau cetak) |
| BK Surat (PB-08) | GET | `/api/student/bk/surat` | (baru) Daftar arsip surat BK | bk, wali-kelas, kepala-sekolah, waka-sekolah | semua halaman BK |
| BK Surat (PB-08) | POST | `/api/student/bk/surat` | (baru) Terbitkan surat, simpan ke arsip read-only | bk, wali-kelas | semua halaman BK (modal pratinjau cetak) |
| BK Surat (PB-08) | GET | `/api/student/bk/surat/{id}` | (baru) Detail arsip untuk cetak ulang | bk, wali-kelas, kepala-sekolah, waka-sekolah | semua halaman BK |

Endpoint lama yang tetap: `/api/student/surat-panggilan` (fitur lama, sampai halaman BK baru siap).

## PKL (vocational-service)

API perpindahan dikerjakan di Sprint 5 (K-42). Data perpindahan permanen, tanpa ubah/hapus (K-21).

| Modul | Method | Endpoint | Deskripsi | Role | Halaman Figma |
|---|---|---|---|---|---|
| PKL | GET | `/api/vocational/pkl/lokasi` | Daftar penempatan / lokasi PKL (endpoint lama, tetap) | vokasi, kepala-sekolah, waka-sekolah | Menu PKL |
| PKL | GET | `/api/vocational/pkl/perpindahan?siswa_id=` | (baru, Sprint 5) Riwayat perpindahan lokasi | vokasi, kepala-sekolah, waka-sekolah | Menu PKL |
| PKL | POST | `/api/vocational/pkl/perpindahan` | (baru, Sprint 5) Catat perpindahan; `urutan` otomatis | vokasi | Menu PKL |

## Pertanyaan terbuka

| No | Pertanyaan | Dampak | Tanya ke |
|---|---|---|---|
| 1 | Format penomoran surat BK (T-01) | Sementara `nomor_surat` diisi manual dan `nomor_surat_usulan` di pratinjau selalu `null` | SMKN 1 Sigumpar lewat SA |
| 2 | Aturan akses BK: apakah pemanggilan oleh BK **dan** wali kelas, keputusan pengembalian hanya kepala sekolah (bukan waka)? Diambil dari catatan PDM v2 | `x-roles` endpoint BK | SA / PM |
| 3 | Siapa yang boleh mencatat perpindahan PKL: hanya role `vokasi`? Siapa yang boleh melihat? | `x-roles` endpoint PKL | SA / PM |
| 4 | Siapa penandatangan surat BK di template (Guru BK, Kepala Sekolah, atau keduanya)? | Isi `penandatangan` di `DataSurat` | SA / Desainer |
| 5 | Halaman Figma BK "Pengembalian mahasiswa": apakah maksudnya "Pengembalian siswa"? | Penamaan saja | Desainer |
| 6 | KKM per mapel belum ada di skema yang berjalan. Apakah tabel nilai perlu menampilkan tuntas/tidak tuntas? | Belum ada kolom `tuntas` di respons | SA |