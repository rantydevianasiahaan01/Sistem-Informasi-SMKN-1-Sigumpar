const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const mime = require("mime-types");
const studentRoutes = require("./routes/studentRoutes");
const inputNilaiRoutes = require("./routes/inputNilaiRoutes");
const bkRoutes = require("./routes/bkRoutes");

const app = express();
const PORT = process.env.PORT || 3008;

app.use(helmet({ crossOriginResourcePolicy: false }));

// Tipe yang boleh dirender langsung di browser. Sisanya dipaksa terunduh:
// tanpa ini berkas HTML atau SVG berjalan sebagai halaman di origin aplikasi,
// bisa membaca token dan mengubah tampilan.
const TIPE_INLINE = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const opsiUpload = {
  index: false,
  dotfiles: "ignore",
  setHeaders: (res, filePath) => {
    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    const disposition = TIPE_INLINE.includes(mimeType) ? "inline" : "attachment";
    res.setHeader("Content-Type", mimeType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `${disposition}; filename="${path.basename(filePath)}"`);
  },
};

// Folder uploads dipakai bersama seluruh service lewat bind mount ./uploads,
// jadi student dikurung ke dua subfoldernya sendiri. Tanpa ini lampiran
// arsip surat bisa diambil tanpa token lewat endpoint ini.
for (const sub of ["parenting", "kebersihan"]) {
  const sajikan = express.static(
    path.join(__dirname, "../uploads", sub),
    opsiUpload,
  );
  app.use(`/uploads/${sub}`, sajikan);
  app.use(`/api/student/uploads/${sub}`, sajikan);
}
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "student-service",
    timestamp: new Date().toISOString(),
  });
});

// API Input Nilai Sprint 4 (docs/api/openapi.yaml). Dipasang sebelum
// studentRoutes; rute lama /api/student/nilai* tidak cocok di sini dan
// diteruskan ke studentRoutes.
app.use("/api/student/nilai", inputNilaiRoutes);
// Modul BK Sprint 4 (docs/api/openapi.yaml). Tidak ada rute lama di /bk.
app.use("/api/student/bk", bkRoutes);
app.use("/api/student", studentRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route '${req.originalUrl}' tidak ditemukan`,
  });
});

app.use((err, req, res, next) => {
  console.error("Student service error:", err);
  // Tolakan multer (tipe salah, file kebesaran) memasang statusCode 400.
  // Tanpa dibaca di sini semuanya terbaca sebagai kegagalan server.
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Student Service running on port ${PORT}`);
});