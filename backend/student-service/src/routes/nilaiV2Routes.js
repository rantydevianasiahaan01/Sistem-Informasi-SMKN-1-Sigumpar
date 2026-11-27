const express = require("express");
const extractIdentity = require("../middleware/extractIdentity");
const asyncHandler = require("../utils/asyncHandler");
const nilai = require("../controllers/nilaiV2Controller");

/**
 * Rute API Input Nilai skema v2, dipasang di /api/student/nilai.
 * Tidak bentrok dengan rute lama (/nilai, /nilai/siswa, /nilai/assignments)
 * di studentRoutes.js, jadi keduanya bisa hidup berdampingan.
 */
const router = express.Router();

// extractIdentity dipasang per rute (bukan router.use) supaya permintaan ke
// rute lama yang tidak cocok di sini lewat tanpa disentuh.
router.get("/pengampu", extractIdentity, asyncHandler(nilai.daftarPengampu));
router.get("/pengampu/:id", extractIdentity, asyncHandler(nilai.detailPengampu));
router.put("/pengampu/:id", extractIdentity, asyncHandler(nilai.simpanNilai));
router.put("/pengampu/:id/bobot", extractIdentity, asyncHandler(nilai.simpanBobot));
router.put(
  "/pengampu/:id/konversi-perilaku",
  extractIdentity,
  asyncHandler(nilai.simpanKonversiPerilaku),
);

// Ulangan / penilaian harian (P1, P2, ...)
router.get("/pengampu/:id/harian", extractIdentity, asyncHandler(nilai.daftarHarian));
router.post("/pengampu/:id/harian", extractIdentity, asyncHandler(nilai.buatHarian));
router.get("/harian/:id", extractIdentity, asyncHandler(nilai.detailHarian));
router.put("/harian/:id", extractIdentity, asyncHandler(nilai.simpanHarian));
router.delete("/harian/:id", extractIdentity, asyncHandler(nilai.hapusHarian));

module.exports = router;