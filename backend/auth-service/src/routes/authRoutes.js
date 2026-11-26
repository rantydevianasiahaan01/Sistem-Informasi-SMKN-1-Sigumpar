const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const { wajibRole } = require("../middleware/auth");
const authController = require("../controllers/authController");
const { uploadFoto } = require("../middleware/upload");

// Multer melempar error tanpa statusCode, tanpa ini semua salah format atau
// file kebesaran terbaca sebagai 500.
const terimaFoto = (req, res, next) =>
  uploadFoto.single("foto")(req, res, (err) => {
    if (!err) return next();
    err.statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") err.message = "Ukuran foto maksimal 50 MB";
    next(err);
  });

// ========================================================
// SESI — satu-satunya rute yang boleh diakses tanpa token
// ========================================================
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

// ========================================================
// RUTE VERIFIKASI UNTUK NGINX / API GATEWAY
// ========================================================
router.get("/verify", verifyToken, (req, res) => {
  const user = req.user || {};

  res.setHeader("X-User-Id", user.sub || "unknown_id");
  res.setHeader("X-User-Role", (user.realm_access?.roles || []).join(",") || "user");

  res.status(200).send("OK");
});

// ========================================================
// RUTE USER GENERAL
// ========================================================
router.get("/", verifyToken, authController.getAll);
router.get("/me", verifyToken, authController.getMe);
router.get("/users/search", verifyToken, authController.searchUsers);

router.post("/me/foto", verifyToken, terimaFoto, authController.updateFotoProfil);
router.delete("/me/foto", verifyToken, authController.hapusFotoProfil);

// userId diambil dari token, bukan dari body
router.post("/change-password", verifyToken, authController.changePassword);

// ========================================================
// PENGELOLAAN AKUN — khusus tata usaha
// ========================================================
router.post("/users", verifyToken, wajibRole("tata-usaha"), authController.buatUser);
router.patch("/users/:id", verifyToken, wajibRole("tata-usaha"), authController.ubahUser);
router.post(
  "/users/:id/reset-password",
  verifyToken,
  wajibRole("tata-usaha"),
  authController.resetPassword,
);

module.exports = router;
