const express = require("express");
const router = express.Router();

const kelasController = require("../controllers/kelasController");
const siswaController = require("../controllers/siswaController");
const tahunAjaranController = require("../controllers/tahunAjaranController");
const pengumumanController = require("../controllers/pengumumanController");
const arsipSuratController = require("../controllers/arsipSuratController");
const mapelController = require("../controllers/mapelController");
const jadwalController = require("../controllers/jadwalController");
const piketController = require("../controllers/piketController");
const upacaraController = require("../controllers/upacaraController");
const guruDataController = require("../controllers/guruDataController");
const wakilController = require("../controllers/wakilController");

const upload = require("../middleware/upload");
const extractIdentity = require("../middleware/extractIdentity");

// Kelas
router.get("/kelas", extractIdentity, kelasController.getAllKelas);
router.post("/kelas", extractIdentity, kelasController.createKelas);
router.put("/kelas/:id", extractIdentity, kelasController.updateKelas);
router.delete("/kelas/:id", extractIdentity, kelasController.deleteKelas);
router.get(
  "/kelas/wali/:waliId",
  extractIdentity,
  kelasController.getKelasByWali,
);

// Siswa
router.get("/siswa", extractIdentity, siswaController.getAllSiswa);
router.post("/siswa", extractIdentity, siswaController.createSiswa);
router.put("/siswa/:id", extractIdentity, siswaController.updateSiswa);
router.delete("/siswa/:id", extractIdentity, siswaController.deleteSiswa);
router.post(
  "/siswa/assign-kelas",
  extractIdentity,
  siswaController.assignSiswaKelasTahunAjaran,
);
router.get(
  "/siswa/:siswaId/riwayat-kelas",
  extractIdentity,
  siswaController.getRiwayatKelasSiswa,
);

// Tahun Ajaran
router.get(
  "/tahun-ajaran",
  extractIdentity,
  tahunAjaranController.getAllTahunAjaran,
);
router.get(
  "/tahun-ajaran/aktif",
  extractIdentity,
  tahunAjaranController.getActiveTahunAjaran,
);
router.post(
  "/tahun-ajaran",
  extractIdentity,
  tahunAjaranController.createTahunAjaran,
);
router.put(
  "/tahun-ajaran/:id",
  extractIdentity,
  tahunAjaranController.updateTahunAjaran,
);
router.put(
  "/tahun-ajaran/:id/aktifkan",
  extractIdentity,
  tahunAjaranController.setActiveTahunAjaran,
);
router.delete(
  "/tahun-ajaran/:id",
  extractIdentity,
  tahunAjaranController.deleteTahunAjaran,
);

// Kelas Tahun Ajaran (buka rombel per tahun ajaran)
router.get(
  "/kelas-tahun-ajaran",
  extractIdentity,
  kelasController.getKelasTahunAjaran,
);
router.post(
  "/kelas-tahun-ajaran",
  extractIdentity,
  kelasController.openKelasTahunAjaran,
);

// Guru helper (Rute spesifik /search harus diletakkan DI ATAS /:id atau /guru)
router.get("/guru/search", extractIdentity, guruDataController.searchGuru);
router.get("/guru", extractIdentity, guruDataController.getAllGuru);
router.post("/guru", extractIdentity, guruDataController.createGuru);
router.put("/guru/:id", extractIdentity, guruDataController.updateGuru);
router.delete("/guru/:id", extractIdentity, guruDataController.deleteGuru);

// Pengumuman
router.get(
  "/pengumuman",
  extractIdentity,
  pengumumanController.getAllPengumuman,
);
router.post(
  "/pengumuman",
  extractIdentity,
  pengumumanController.createPengumuman,
);
router.put(
  "/pengumuman/:id",
  extractIdentity,
  pengumumanController.updatePengumuman,
);
router.delete(
  "/pengumuman/:id",
  extractIdentity,
  pengumumanController.deletePengumuman,
);

// Arsip Surat
router.get(
  "/arsip-surat",
  extractIdentity,
  arsipSuratController.getAllArsipSurat,
);
router.post(
  "/arsip-surat",
  extractIdentity,
  upload.single("file"),
  arsipSuratController.createArsipSurat,
);
router.put(
  "/arsip-surat/:id",
  extractIdentity,
  upload.single("file"),
  arsipSuratController.updateArsipSurat,
);
router.delete(
  "/arsip-surat/:id",
  extractIdentity,
  arsipSuratController.deleteArsipSurat,
);
router.get(
  "/arsip-surat/:id/preview",
  extractIdentity,
  arsipSuratController.previewArsipSurat,
);

// Mapel
router.get("/mapel", extractIdentity, mapelController.getAllMapel);
router.get(
  "/mapel/guru/:guruId",
  extractIdentity,
  mapelController.getMapelByGuru,
);
router.post("/mapel", extractIdentity, mapelController.createMapel);
router.put("/mapel/:id", extractIdentity, mapelController.updateMapel);
router.delete("/mapel/:id", extractIdentity, mapelController.deleteMapel);

// Jadwal Mengajar
router.get("/jadwal", extractIdentity, jadwalController.getAllJadwal);
router.post("/jadwal", extractIdentity, jadwalController.createJadwal);
router.put("/jadwal/:id", extractIdentity, jadwalController.updateJadwal);
router.delete("/jadwal/:id", extractIdentity, jadwalController.deleteJadwal);

// Piket
router.get("/piket", extractIdentity, piketController.getAllPiket);
router.post("/piket", extractIdentity, piketController.createPiket);
router.put("/piket/:id", extractIdentity, piketController.updatePiket);
router.delete("/piket/:id", extractIdentity, piketController.deletePiket);

// Upacara
router.get("/upacara", extractIdentity, upacaraController.getAllUpacara);
router.post("/upacara", extractIdentity, upacaraController.createUpacara);
router.put("/upacara/:id", extractIdentity, upacaraController.updateUpacara);
router.delete("/upacara/:id", extractIdentity, upacaraController.deleteUpacara);

// Wakil Kepala Sekolah
router.get("/wakil/supervisi", extractIdentity, wakilController.getAllSupervisi);
router.get(
  "/wakil/supervisi/:id",
  extractIdentity,
  wakilController.getSupervisiById,
);
router.post(
  "/wakil/supervisi",
  extractIdentity,
  wakilController.createSupervisi,
);
router.put(
  "/wakil/supervisi/:id",
  extractIdentity,
  wakilController.updateSupervisi,
);
router.delete(
  "/wakil/supervisi/:id",
  extractIdentity,
  wakilController.deleteSupervisi,
);

router.get(
  "/wakil/program-kerja",
  extractIdentity,
  wakilController.getAllProgramKerja,
);
router.get(
  "/wakil/program-kerja/:id",
  extractIdentity,
  wakilController.getProgramKerjaById,
);
router.post(
  "/wakil/program-kerja",
  extractIdentity,
  wakilController.createProgramKerja,
);
router.put(
  "/wakil/program-kerja/:id",
  extractIdentity,
  wakilController.updateProgramKerja,
);
router.delete(
  "/wakil/program-kerja/:id",
  extractIdentity,
  wakilController.deleteProgramKerja,
);

// Rute /perangkat-guru harus di atas /perangkat-guru/:guruId sudah otomatis
// karena path-nya berbeda panjang.
router.get(
  "/wakil/perangkat-guru",
  extractIdentity,
  wakilController.getDaftarGuruPerangkat,
);
router.get(
  "/wakil/perangkat-guru/:guruId",
  extractIdentity,
  wakilController.getPerangkatByGuru,
);
router.get(
  "/wakil/perangkat",
  extractIdentity,
  wakilController.getAllPerangkatGuru,
);
router.post(
  "/wakil/perangkat",
  extractIdentity,
  wakilController.createPerangkatGuru,
);
router.put(
  "/wakil/perangkat/:id",
  extractIdentity,
  wakilController.updatePerangkatGuru,
);
router.delete(
  "/wakil/perangkat/:id",
  extractIdentity,
  wakilController.deletePerangkatGuru,
);

module.exports = router;
