const express = require("express");
const extractIdentity = require("../middleware/extractIdentity");
const asyncHandler = require("../utils/asyncHandler");
const nilai = require("../controllers/inputNilaiController");

/**
 * Rute API Input Nilai Sprint 4 (PB-05), dipasang di /api/student/nilai.
 * Kontrak: docs/api/openapi.yaml. Rute lama (/nilai, /nilai/siswa,
 * /nilai/assignments) di studentRoutes.js tidak bentrok dan tetap berjalan.
 *
 * extractIdentity dipasang per rute (bukan router.use) supaya permintaan ke
 * rute lama yang tidak cocok di sini lewat tanpa disentuh.
 */
const router = express.Router();

router.get("/pengampu", extractIdentity, asyncHandler(nilai.daftarPengampu));
router.get("/pengampu/:mapel_id", extractIdentity, asyncHandler(nilai.tabelNilai));
router.put("/pengampu/:mapel_id", extractIdentity, asyncHandler(nilai.simpanNilai));
router.put("/pengampu/:mapel_id/bobot", extractIdentity, asyncHandler(nilai.simpanBobot));
router.put(
  "/pengampu/:mapel_id/konversi-perilaku",
  extractIdentity,
  asyncHandler(nilai.simpanKonversiPerilaku),
);
router.get("/pengampu/:mapel_id/harian", extractIdentity, asyncHandler(nilai.daftarHarian));
router.post("/pengampu/:mapel_id/harian", extractIdentity, asyncHandler(nilai.buatHarian));
router.get("/harian/:id", extractIdentity, asyncHandler(nilai.detailHarian));
router.put("/harian/:id", extractIdentity, asyncHandler(nilai.simpanHarian));
router.delete("/harian/:id", extractIdentity, asyncHandler(nilai.hapusHarian));

module.exports = router;