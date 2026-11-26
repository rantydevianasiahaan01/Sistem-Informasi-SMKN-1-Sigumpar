const express = require("express");
const verifyToken = require('../middleware/auth'); // Import middleware
const router = express.Router();
const {
  getAllTodos,
  getTodoById,
  createTodo,
  updateTodo,
  deleteTodo,
} = require("../controllers/assetController");

/**
 * Routes untuk resource /todos
 *
 * GET    /todos       => Ambil semua todos (support filter via query params)
 * POST   /todos       => Buat todo baru
 * GET    /todos/:id   => Ambil todo tertentu
 * PUT    /todos/:id   => Update todo tertentu
 * DELETE /todos/:id   => Hapus todo tertentu
 */

router.route("/").get(verifyToken, getAllTodos).post(verifyToken, createTodo);
router.route("/:id").get(verifyToken, getTodoById).put(verifyToken, updateTodo).delete(verifyToken, deleteTodo);

module.exports = router;