const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const studentController = require("../controllers/studentController");
const extractIdentity = require("../middleware/extractIdentity");

/**
 * Ekstensi berkas ditentukan dari mimetype yang diizinkan, bukan dari
 * path.extname(file.originalname). Nama asli dikendalikan pengunggah, jadi
 * memakai ekstensinya berarti berkas .html bisa tersimpan lalu dijalankan di
 * origin aplikasi — membaca token dan mengubah tampilan.
 */
const EKSTENSI_GAMBAR = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const EKSTENSI_LAMPIRAN = { ...EKSTENSI_GAMBAR, "application/pdf": ".pdf" };

const namaAman = (peta, prefiks) => (req, file, cb) =>
  cb(null, `${prefiks}-${crypto.randomUUID()}${peta[file.mimetype]}`);

const saringan = (peta, pesan) => (req, file, cb) => {
  if (peta[file.mimetype]) return cb(null, true);
  const err = new Error(pesan);
  err.statusCode = 400;
  cb(err);
};

/**
 * Upload khusus Parenting.
 * Ini upload lama dari fitur parenting, jangan diubah agar fitur lain tidak terganggu.
 */
const uploadParentingDir = path.join(__dirname, "../../uploads/parenting");
fs.mkdirSync(uploadParentingDir, { recursive: true });

const parentingStorage = multer.diskStorage({
  destination: uploadParentingDir,
  filename: namaAman(EKSTENSI_LAMPIRAN, "parenting"),
});

const upload = multer({
  storage: parentingStorage,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: saringan(
    EKSTENSI_LAMPIRAN,
    "Lampiran parenting harus berupa gambar atau PDF",
  ),
});

/**
 * Upload khusus Kebersihan Kelas.
 * Dibuat terpisah dari parenting agar upload parenting tidak ikut berubah.
 */
const kebersihanUploadDir = path.join(__dirname, "../../uploads/kebersihan");

if (!fs.existsSync(kebersihanUploadDir)) {
  fs.mkdirSync(kebersihanUploadDir, { recursive: true });
}

const kebersihanStorage = multer.diskStorage({
  destination: kebersihanUploadDir,
  filename: namaAman(EKSTENSI_GAMBAR, "kebersihan"),
});

const uploadKebersihan = multer({
  storage: kebersihanStorage,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: saringan(
    EKSTENSI_GAMBAR,
    "File dokumentasi kebersihan harus berupa gambar",
  ),
});

// ─── KEBERSIHAN KELAS ─────────────────────────────────────────────

router.get("/kebersihan", studentController.getKebersihan);

router.post(
  "/kebersihan",
  extractIdentity,
  uploadKebersihan.single("foto"),
  studentController.createKebersihan,
);

router.put(
  "/kebersihan/:id",
  extractIdentity,
  uploadKebersihan.single("foto"),
  studentController.updateKebersihan,
);

router.delete(
  "/kebersihan/:id",
  extractIdentity,
  studentController.deleteKebersihan,
);

// ─── NILAI SISWA ──────────────────────────────────────────────────

router.get(
  "/nilai/assignments",
  extractIdentity,
  studentController.getGuruMapelAssignments,
);

router.get(
  "/nilai/siswa",
  extractIdentity,
  studentController.getSiswaUntukInputNilai,
);

router.get("/nilai", extractIdentity, studentController.getNilaiSiswa);

router.post(
  "/nilai",
  extractIdentity,
  studentController.createOrUpdateNilaiSiswa,
);

router.get("/rekap-nilai", extractIdentity, studentController.getRekapNilai);

// ─── PARENTING ────────────────────────────────────────────────────

router.get("/parenting", studentController.getParenting);

router.post(
  "/parenting",
  extractIdentity,
  upload.single("foto"),
  studentController.createParenting,
);

router.put(
  "/parenting/:id",
  extractIdentity,
  upload.single("foto"),
  studentController.updateParenting,
);

router.delete(
  "/parenting/:id",
  extractIdentity,
  studentController.deleteParenting,
);

// ─── REFLEKSI WALI KELAS ──────────────────────────────────────────

router.get("/refleksi", studentController.getRefleksi);

router.post("/refleksi", extractIdentity, studentController.createRefleksi);

router.put("/refleksi/:id", extractIdentity, studentController.updateRefleksi);

router.delete(
  "/refleksi/:id",
  extractIdentity,
  studentController.deleteRefleksi,
);

// ─── SURAT PANGGILAN SISWA ────────────────────────────────────────

router.get("/surat-panggilan", studentController.getSuratPanggilan);

router.post(
  "/surat-panggilan",
  extractIdentity,
  studentController.createSuratPanggilan,
);

router.put(
  "/surat-panggilan/:id",
  extractIdentity,
  studentController.updateSuratPanggilan,
);

router.delete(
  "/surat-panggilan/:id",
  extractIdentity,
  studentController.deleteSuratPanggilan,
);

// ─── REKAP KEHADIRAN / PRESENSI WALI KELAS ────────────────────────

router.get(
  "/rekap-kehadiran/kelas",
  extractIdentity,
  studentController.getKelasPresensiWali,
);

router.get(
  "/rekap-kehadiran/siswa",
  extractIdentity,
  studentController.getSiswaPresensiWali,
);

router.get(
  "/rekap-kehadiran",
  extractIdentity,
  studentController.getRekapKehadiran,
);

router.post(
  "/rekap-kehadiran",
  extractIdentity,
  studentController.createRekapKehadiran,
);

// ─── ABSENSI SISWA OLEH GURU-MAPEL ────────────────────────────────

router.get(
  "/absensi-mapel/jadwal",
  extractIdentity,
  studentController.getAbsensiMapelJadwal,
);

router.get(
  "/absensi-mapel/assignments",
  extractIdentity,
  studentController.getAbsensiMapelAssignments,
);

router.get(
  "/absensi-mapel/siswa",
  extractIdentity,
  studentController.getAbsensiMapelSiswa,
);

router.get(
  "/absensi-mapel",
  extractIdentity,
  studentController.getAbsensiMapel,
);

router.post(
  "/absensi-mapel",
  extractIdentity,
  studentController.createAbsensiMapel,
);

router.get(
  "/absensi-mapel/rekap",
  extractIdentity,
  studentController.getRekapAbsensiMapel,
);

// ─── KEPALA SEKOLAH ───────────────────────────────────────────────

router.get(
  "/kepala-sekolah/rekap-absensi",
  studentController.getRekapAbsensiKepalaSekolah,
);

module.exports = router;
