const express = require("express");
const multer = require("multer");
const extractIdentity = require("../middleware/extractIdentity");
const asyncHandler = require("../utils/asyncHandler");
const bk = require("../controllers/bkController");

/**
 * Rute modul BK Sprint 4, dipasang di /api/student/bk.
 * Kontrak: docs/api/openapi.yaml. Hak akses per role diperiksa di
 * bkController. Tidak ada DELETE (K-11, K-12).
 */
const router = express.Router();

router.use(extractIdentity);

// Pendukung
router.get("/siswa", asyncHandler(bk.cariSiswa));
router.get("/siswa/:id", asyncHandler(bk.profilSiswa));

// Pemanggilan orang tua
router.get("/pemanggilan", asyncHandler(bk.daftarPemanggilan));
router.post("/pemanggilan", asyncHandler(bk.buatPemanggilan));
router.get("/pemanggilan/:id", asyncHandler(bk.detailPemanggilan));
router.put("/pemanggilan/:id", asyncHandler(bk.ubahPemanggilan));

// Pendampingan / pembinaan
router.get("/pendampingan", asyncHandler(bk.daftarPendampingan));
router.post("/pendampingan", asyncHandler(bk.buatPendampingan));
router.get("/pendampingan/:id", asyncHandler(bk.detailPendampingan));
router.put("/pendampingan/:id", asyncHandler(bk.ubahPendampingan));

// Pengembalian siswa ke orang tua
router.get("/pengembalian", asyncHandler(bk.daftarPengembalian));
router.post("/pengembalian", asyncHandler(bk.ajukanPengembalian));
router.get("/pengembalian/:id", asyncHandler(bk.detailPengembalian));
router.put("/pengembalian/:id", asyncHandler(bk.ubahPengembalian));
router.post("/pengembalian/:id/keputusan", asyncHandler(bk.putuskanPengembalian));
router.post("/pengembalian/:id/selesai", asyncHandler(bk.selesaikanPengembalian));

// Lampiran. File ditampung di memori dulu (maks 5 MB) supaya jenisnya bisa
// dicek dari isi sebelum ditulis ke disk.
const uploadLampiran = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: bk.MAKS_LAMPIRAN, files: 1 },
}).single("file");

const terimaLampiran = (req, res, next) => {
  uploadLampiran(req, res, (err) => {
    if (!err) return next();
    const e = new Error(
      err.code === "LIMIT_FILE_SIZE" ? "Ukuran file maksimal 5 MB" : `Unggahan ditolak: ${err.message}`,
    );
    e.statusCode = 400;
    next(e);
  });
};

router.get("/lampiran", asyncHandler(bk.daftarLampiran));
router.post("/lampiran", terimaLampiran, asyncHandler(bk.unggahLampiran));
router.get("/lampiran/:id", asyncHandler(bk.unduhLampiran));

// Surat dari template + arsip read-only (K-11). Tidak ada ubah/hapus.
// "/surat/pratinjau" didaftarkan sebelum "/surat/:id".
router.get("/surat/pratinjau", asyncHandler(bk.pratinjauSurat));
router.get("/surat", asyncHandler(bk.daftarSurat));
router.post("/surat", asyncHandler(bk.terbitkanSurat));
router.get("/surat/:id", asyncHandler(bk.detailSurat));

module.exports = router;