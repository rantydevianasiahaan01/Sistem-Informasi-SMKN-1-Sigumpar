import axios from "axios";
import sesi from "../sesi";
import { apiOrigin } from "./apiOrigin";

const api = axios.create({
  baseURL: `${apiOrigin}/api`,
});

api.interceptors.request.use((config) => {
  if (sesi?.token) {
    config.headers.Authorization = `Bearer ${sesi.token}`;
  }
  return config;
});

export const academicApi = {
  // Kelas
  getKelas: (params = {}) => api.get("/academic/kelas", { params }),
  getAllKelas: (params = {}) => api.get("/academic/kelas", { params }),
  createKelas: (payload) => api.post("/academic/kelas", payload),
  updateKelas: (id, payload) => api.put(`/academic/kelas/${id}`, payload),
  deleteKelas: (id) => api.delete(`/academic/kelas/${id}`),

  getKelasByWali: (waliId) => api.get(`/academic/kelas/wali/${waliId}`),

  getSiswaByKelas: (kelasId) =>
    api.get(`/academic/siswa?kelas_id=${encodeURIComponent(kelasId)}`),

  // Search user general dari auth-service, difilter role wali-kelas
  searchWaliKelas: (query) =>
    api.get(
      `/auth/users/search?q=${encodeURIComponent(query)}&role=wali-kelas`,
    ),

  // Siswa
  getAllSiswa: (params = {}) => api.get("/academic/siswa", { params }),
  getSiswa: (params = {}) => api.get("/academic/siswa", { params }),
  createSiswa: (payload) => api.post("/academic/siswa", payload),
  updateSiswa: (id, payload) => api.put(`/academic/siswa/${id}`, payload),
  deleteSiswa: (id) => api.delete(`/academic/siswa/${id}`),

  // Pengumuman
  getAllPengumuman: () => api.get("/academic/pengumuman"),
  getPengumuman: () => api.get("/academic/pengumuman"),
  getPengumumanById: (id) => api.get(`/academic/pengumuman/${id}`),
  createPengumuman: (payload) => api.post("/academic/pengumuman", payload),
  updatePengumuman: (id, payload) =>
    api.put(`/academic/pengumuman/${id}`, payload),
  deletePengumuman: (id) => api.delete(`/academic/pengumuman/${id}`),

  // Arsip Surat
  getAllArsipSurat: () => api.get("/academic/arsip-surat"),
  getArsipSurat: () => api.get("/academic/arsip-surat"),
  createArsipSurat: (payload) => api.post("/academic/arsip-surat", payload),
  updateArsipSurat: (id, payload) =>
    api.put(`/academic/arsip-surat/${id}`, payload),
  deleteArsipSurat: (id) => api.delete(`/academic/arsip-surat/${id}`),
  previewArsipSurat: (id) =>
    api.get(`/academic/arsip-surat/${id}/preview`, {
      responseType: "blob",
    }),
  downloadArsipSurat: async (fileUrl, nomorSurat) => {
    if (!fileUrl) return;

    const API_BASE_URL = apiOrigin;
    const filename = fileUrl.split("/").pop();
    const url = `${API_BASE_URL}/uploads/${filename}`;

    const res = await fetch(url, {
      headers: sesi?.token
        ? { Authorization: `Bearer ${sesi.token}` }
        : {},
    });

    if (!res.ok) throw new Error("Gagal mengunduh file");

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const ext = filename.split(".").pop();
    const safeFileName = nomorSurat
      ? `Arsip_${nomorSurat.replace(/\//g, "-")}.${ext}`
      : filename;

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = safeFileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  },

  // Mapel
  getAllMapel: () => api.get("/academic/mapel"),
  getMapel: () => api.get("/academic/mapel"),
  createMapel: (payload) => api.post("/academic/mapel", payload),
  updateMapel: (id, payload) => api.put(`/academic/mapel/${id}`, payload),
  deleteMapel: (id) => api.delete(`/academic/mapel/${id}`),

  // Search guru mapel dari auth-service general
  searchGuruMapel: (query) =>
    api.get(
      `/auth/users/search?q=${encodeURIComponent(query)}&role=guru-mapel`,
    ),

  // Ambil mapel+kelas yang sudah diassign ke guru mapel
  getMapelByGuru: (guruId) => api.get(`/academic/mapel/guru/${guruId}`),

  // Jadwal Mengajar
  getAllJadwal: () => api.get("/academic/jadwal"),
  getJadwal: () => api.get("/academic/jadwal"),
  createJadwal: (payload) => api.post("/academic/jadwal", payload),
  updateJadwal: (id, payload) => api.put(`/academic/jadwal/${id}`, payload),
  deleteJadwal: (id) => api.delete(`/academic/jadwal/${id}`),

  // Jadwal Piket
  getAllPiket: (params = {}) => api.get("/academic/piket", { params }),
  getPiket: (params = {}) => api.get("/academic/piket", { params }),
  createPiket: (payload) => api.post("/academic/piket", payload),
  updatePiket: (id, payload) => api.put(`/academic/piket/${id}`, payload),
  deletePiket: (id) => api.delete(`/academic/piket/${id}`),

  // Search semua user untuk jadwal piket
  searchAllUsers: (query) =>
    api.get(`/auth/users/search?q=${encodeURIComponent(query)}`),

  // Jadwal Upacara
  getAllUpacara: () => api.get("/academic/upacara"),
  getUpacara: () => api.get("/academic/upacara"),
  createUpacara: (payload) => api.post("/academic/upacara", payload),
  updateUpacara: (id, payload) => api.put(`/academic/upacara/${id}`, payload),
  deleteUpacara: (id) => api.delete(`/academic/upacara/${id}`),

  // Guru
  getAllGuru: () => api.get("/academic/guru"),
  getGuru: () => api.get("/academic/guru"),
  createGuru: (payload) => api.post("/academic/guru", payload),
  updateGuru: (id, payload) => api.put(`/academic/guru/${id}`, payload),
  deleteGuru: (id) => api.delete(`/academic/guru/${id}`),

  // Wakil Kepala Sekolah — supervisi guru
  getAllSupervisi: (params = {}) =>
    api.get("/academic/wakil/supervisi", { params }),
  getSupervisiById: (id) => api.get(`/academic/wakil/supervisi/${id}`),
  createSupervisi: (payload) => api.post("/academic/wakil/supervisi", payload),
  updateSupervisi: (id, payload) =>
    api.put(`/academic/wakil/supervisi/${id}`, payload),
  deleteSupervisi: (id) => api.delete(`/academic/wakil/supervisi/${id}`),

  // Wakil Kepala Sekolah — program kerja
  getAllProgramKerja: (params = {}) =>
    api.get("/academic/wakil/program-kerja", { params }),
  getProgramKerjaById: (id) => api.get(`/academic/wakil/program-kerja/${id}`),
  createProgramKerja: (payload) =>
    api.post("/academic/wakil/program-kerja", payload),
  updateProgramKerja: (id, payload) =>
    api.put(`/academic/wakil/program-kerja/${id}`, payload),
  deleteProgramKerja: (id) => api.delete(`/academic/wakil/program-kerja/${id}`),

  // Wakil Kepala Sekolah — kelengkapan perangkat per guru
  getDaftarGuruPerangkat: (params = {}) =>
    api.get("/academic/wakil/perangkat-guru", { params }),
  getPerangkatByGuru: (guruId, params = {}) =>
    api.get(`/academic/wakil/perangkat-guru/${guruId}`, { params }),
  getAllPerangkatGuru: (params = {}) =>
    api.get("/academic/wakil/perangkat", { params }),
  createPerangkat: (payload) => api.post("/academic/wakil/perangkat", payload),
  updatePerangkat: (id, payload) =>
    api.put(`/academic/wakil/perangkat/${id}`, payload),
  deletePerangkat: (id) => api.delete(`/academic/wakil/perangkat/${id}`),

  // Tahun Ajaran
  getAllTahunAjaran: () => api.get("/academic/tahun-ajaran"),
  getActiveTahunAjaran: () => api.get("/academic/tahun-ajaran/aktif"),
  createTahunAjaran: (payload) => api.post("/academic/tahun-ajaran", payload),
  updateTahunAjaran: (id, payload) =>
    api.put(`/academic/tahun-ajaran/${id}`, payload),
  setActiveTahunAjaran: (id) =>
    api.put(`/academic/tahun-ajaran/${id}/aktifkan`),
  deleteTahunAjaran: (id) => api.delete(`/academic/tahun-ajaran/${id}`),

  // Kelas Tahun Ajaran (buka rombel per tahun ajaran)
  getKelasTahunAjaran: (params = {}) =>
    api.get("/academic/kelas-tahun-ajaran", { params }),
  openKelasTahunAjaran: (payload) =>
    api.post("/academic/kelas-tahun-ajaran", payload),

  // Assign siswa ke rombel / riwayat kelas siswa
  assignSiswaKelasTahunAjaran: (payload) =>
    api.post("/academic/siswa/assign-kelas", payload),
  getRiwayatKelasSiswa: (siswaId) =>
    api.get(`/academic/siswa/${siswaId}/riwayat-kelas`),
};

export default academicApi;
