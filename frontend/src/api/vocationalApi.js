import axiosInstance from "./axiosInstance";

// Helper: fetch blob dari endpoint dan trigger download atau preview
const fetchBlob = async (url) => {
  const res = await axiosInstance.get(url, { responseType: "blob" });
  const mime = res.headers["content-type"] || "application/octet-stream";
  const blob = new Blob([res.data], { type: mime });
  return { blob, mime, url: URL.createObjectURL(blob) };
};

export const vocationalApi = {
  // ── Regu ────────────────────────────────────────────────────────────────
  getAllRegu: () => axiosInstance.get("/api/vocational/regu"),
  createRegu: (data) => axiosInstance.post("/api/vocational/regu", data),
  deleteRegu: (id) => axiosInstance.delete(`/api/vocational/regu/${id}`),

  // ── Anggota Regu ─────────────────────────────────────────────────────────
  getSiswaTersedia: () =>
    axiosInstance.get("/api/vocational/regu/siswa-tersedia"),
  assignSiswaToRegu: (data) =>
    axiosInstance.post("/api/vocational/regu/assign", data),
  getSiswaByRegu: (reguId) =>
    axiosInstance.get(`/api/vocational/regu/${reguId}/siswa`),

  // ── Absensi Pramuka ───────────────────────────────────────────────────────
  getAbsensiPramuka: (params) =>
    axiosInstance.get("/api/vocational/absensi", { params }),
  submitAbsensiPramuka: (data) =>
    axiosInstance.post("/api/vocational/absensi", data),
  getRekapAbsensiPramuka: (params) =>
    axiosInstance.get("/api/vocational/absensi/rekap", { params }),

  // ── Silabus Pramuka ───────────────────────────────────────────────────────
  getAllSilabus: (params = {}) =>
    axiosInstance.get("/api/vocational/silabus", { params }),
  createSilabus: (formData) =>
    axiosInstance.post("/api/vocational/silabus", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteSilabus: (id) => axiosInstance.delete(`/api/vocational/silabus/${id}`),

  // Preview silabus: gambar/PDF → inline, DOCX → download otomatis
  viewSilabus: async (id, fileName, previewWindow = null) => {
    const { mime, url } = await fetchBlob(`/api/vocational/silabus/${id}/view`);
    const inlineTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
    ];
    if (inlineTypes.includes(mime)) {
      if (previewWindow && !previewWindow.closed)
        previewWindow.location.href = url;
      return { url, mime, inline: true };
    }
    if (previewWindow && !previewWindow.closed) previewWindow.close();
    // DOCX dan lainnya — langsung download
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "file";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return { url: null, mime, inline: false };
  },

  // Download silabus (force attachment)
  downloadSilabus: async (id, fileName) => {
    const { url } = await fetchBlob(`/api/vocational/silabus/${id}/download`);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "silabus";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  // ── Laporan Kegiatan Pramuka ──────────────────────────────────────────────
  getAllLaporanKegiatan: (params = {}) =>
    axiosInstance.get("/api/vocational/laporan-kegiatan", { params }),
  createLaporanKegiatan: (formData) =>
    axiosInstance.post("/api/vocational/laporan-kegiatan", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteLaporanKegiatan: (id) =>
    axiosInstance.delete(`/api/vocational/laporan-kegiatan/${id}`),

  viewLaporanKegiatan: async (id, fileName, previewWindow = null) => {
    const { mime, url } = await fetchBlob(
      `/api/vocational/laporan-kegiatan/${id}/view`,
    );
    const inlineTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
    ];
    if (inlineTypes.includes(mime)) {
      if (previewWindow && !previewWindow.closed)
        previewWindow.location.href = url;
      return { url, mime, inline: true };
    }
    if (previewWindow && !previewWindow.closed) previewWindow.close();
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "file";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return { url: null, mime, inline: false };
  },

  downloadLaporanKegiatan: async (id, fileName) => {
    const { url } = await fetchBlob(
      `/api/vocational/laporan-kegiatan/${id}/download`,
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "laporan";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  // ── Siswa & Kelas ─────────────────────────────────────────────────────────
  getSiswaVokasi: (params) =>
    axiosInstance.get("/api/vocational/siswa", { params }),
  getKelasVokasi: () => axiosInstance.get("/api/vocational/kelas"),

  // ── PKL: Lokasi ───────────────────────────────────────────────────────────
  getAllLokasiPKL: (params = {}) =>
    axiosInstance.get("/api/vocational/pkl/lokasi", { params }),
  createLokasiPKL: (formData) =>
    axiosInstance.post("/api/vocational/pkl/lokasi", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  updateLokasiPKL: (id, formData) =>
    axiosInstance.put(`/api/vocational/pkl/lokasi/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteLokasiPKL: (id) =>
    axiosInstance.delete(`/api/vocational/pkl/lokasi/${id}`),

  // ── PKL: Progres ──────────────────────────────────────────────────────────
  getAllProgresPKL: (params = {}) =>
    axiosInstance.get("/api/vocational/pkl/progres", { params }),
  createProgresPKL: (data) =>
    axiosInstance.post("/api/vocational/pkl/progres", data),
  updateProgresPKL: (id, data) =>
    axiosInstance.put(`/api/vocational/pkl/progres/${id}`, data),
  deleteProgresPKL: (id) =>
    axiosInstance.delete(`/api/vocational/pkl/progres/${id}`),

  // ── PKL: Nilai ────────────────────────────────────────────────────────────
  getNilaiPKL: (params) =>
    axiosInstance.get("/api/vocational/pkl/nilai", { params }),
  saveNilaiPKLBulk: (data) =>
    axiosInstance.post("/api/vocational/pkl/nilai", data),
  deleteNilaiPKL: (id) =>
    axiosInstance.delete(`/api/vocational/pkl/nilai/${id}`),

  // ── UKK: Progres ──────────────────────────────────────────────────────────
  getProgresUKK: (params) =>
    axiosInstance.get("/api/vocational/ukk/progres", { params }),
  createProgresUKK: (data) =>
    axiosInstance.post("/api/vocational/ukk/progres", data),
  deleteProgresUKK: (id) =>
    axiosInstance.delete(`/api/vocational/ukk/progres/${id}`),

  // ── UKK: Nilai ────────────────────────────────────────────────────────────
  getBobotUKK: () => axiosInstance.get("/api/vocational/ukk/bobot"),
  updateBobotUKK: (data) =>
    axiosInstance.put("/api/vocational/ukk/bobot", data),
  getNilaiUKK: (params) =>
    axiosInstance.get("/api/vocational/ukk/nilai", { params }),
  createNilaiUKK: (data) =>
    axiosInstance.post("/api/vocational/ukk/nilai", data),
  deleteNilaiUKK: (id) =>
    axiosInstance.delete(`/api/vocational/ukk/nilai/${id}`),

  // ── UKK: Bank Soal ────────────────────────────────────────────────────────
  getSoalUKK: (params = {}) =>
    axiosInstance.get("/api/vocational/ukk/soal", { params }),
  createSoalUKK: (formData) =>
    axiosInstance.post("/api/vocational/ukk/soal", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // PDF dibuka inline di tab baru, DOC/DOCX langsung diunduh
  viewSoalUKK: async (id, fileName) => {
    const { mime, url } = await fetchBlob(
      `/api/vocational/ukk/soal/${id}/view`,
    );
    if (mime === "application/pdf") {
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return { inline: true, mime };
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "soal-ukk";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return { inline: false, mime };
  },

  downloadSoalUKK: async (id, fileName) => {
    const { url } = await fetchBlob(`/api/vocational/ukk/soal/${id}/download`);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "soal-ukk";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  // ── UKK: Sertifikat ───────────────────────────────────────────────────────
  getSertifikatUKK: (params) =>
    axiosInstance.get("/api/vocational/ukk/sertifikat", { params }),
  createSertifikatUKK: (formData) =>
    axiosInstance.post("/api/vocational/ukk/sertifikat", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteSertifikatUKK: (id) =>
    axiosInstance.delete(`/api/vocational/ukk/sertifikat/${id}`),

  // PDF & gambar dibuka inline di tab baru, DOC/DOCX langsung diunduh
  viewSertifikatUKK: async (id, fileName) => {
    const { mime, url } = await fetchBlob(
      `/api/vocational/ukk/sertifikat/${id}/view`,
    );
    const inlineTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];
    if (inlineTypes.includes(mime)) {
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return { inline: true, mime };
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "sertifikat-ukk";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return { inline: false, mime };
  },

  downloadSertifikatUKK: async (id, fileName) => {
    const { url } = await fetchBlob(
      `/api/vocational/ukk/sertifikat/${id}/download`,
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "sertifikat-ukk";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
};
