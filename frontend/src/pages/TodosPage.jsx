import { useEffect, useState } from "react";
import useTodos from "../hooks/useTodos";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import PageLoading from "../components/common/PageLoading";
import PageActionsMenu from "../components/common/PageActionsMenu";
import SearchBar from "../components/common/SearchBar";
import { exportRowsToExcel } from "../utils/exportExcel";
import {
  downloadExcelTemplate,
  pickField,
  readExcelFile,
  summarizeImportResult,
} from "../utils/importExcel";
import toast from "react-hot-toast";

/**
 * Halaman manajemen Todos.
 * Mendukung filter status dan prioritas, serta update status langsung dari card.
 */
const TodosPage = () => {
  const { todos, loading, error, loadTodos, addTodo, editTodo, removeTodo } =
    useTodos();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);

  const [formData, setFormData] = useState({
    userId: "u-001",
    title: "",
    description: "",
    priority: "medium",
  });

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  const handleOpenCreate = () => {
    setSelectedTodo(null);
    setFormData({
      userId: "u-001",
      title: "",
      description: "",
      priority: "medium",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (todo) => {
    setSelectedTodo(todo);
    setFormData({
      userId: todo.userId,
      title: todo.title,
      description: todo.description || "",
      priority: todo.priority,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTodo(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    try {
      if (selectedTodo) {
        await editTodo(selectedTodo.id, formData);
      } else {
        await addTodo(formData);
      }
      handleCloseModal();
    } catch (err) {
      console.error(err.message);
    }
  };

  const handleStatusChange = async (todo, newStatus) => {
    try {
      await editTodo(todo.id, { status: newStatus });
    } catch (err) {
      console.error(err.message);
    }
  };

  const handleDelete = async (todo) => {
    if (!window.confirm(`Hapus todo "${todo.title}"?`)) return;
    try {
      await removeTodo(todo.id);
    } catch (err) {
      console.error(err.message);
    }
  };

  const handleFilter = () => {
    loadTodos({ status: statusFilter, priority: priorityFilter, search });
  };

  const handleReset = () => {
    setStatusFilter("");
    setPriorityFilter("");
    setSearch("");
    loadTodos();
  };

  const q = search.trim().toLowerCase();
  const filteredTodos = todos.filter((todo) => {
    if (statusFilter && todo.status !== statusFilter) return false;
    if (priorityFilter && todo.priority !== priorityFilter) return false;
    if (!q) return true;
    return (
      String(todo.title || "").toLowerCase().includes(q) ||
      String(todo.description || "").toLowerCase().includes(q)
    );
  });

  const handleExportExcel = () => {
    exportRowsToExcel(
      filteredTodos.map((todo, i) => ({
        No: i + 1,
        Judul: todo.title || "-",
        Deskripsi: todo.description || "-",
        Status: todo.status || "-",
        Prioritas: todo.priority || "-",
      })),
      { sheetName: "Todos", fileName: "todos" },
    );
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate({
      headers: ["Judul", "Deskripsi", "Prioritas"],
      sampleRows: [["Contoh todo", "Deskripsi singkat", "medium"]],
      sheetName: "Template Todos",
      fileName: "template-import-todos",
    });
  };

  const handleImportExcel = async (file) => {
    setImporting(true);
    try {
      const rows = await readExcelFile(file);
      if (!rows.length) {
        toast.error("File Excel kosong atau tidak berisi data");
        return;
      }

      let berhasil = 0;
      let gagal = 0;
      const pesanGagal = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const title = pickField(row, ["Judul", "judul", "title", "Title"]);
        const description = pickField(row, [
          "Deskripsi",
          "deskripsi",
          "description",
          "Description",
        ]);
        const priorityRaw = pickField(row, [
          "Prioritas",
          "prioritas",
          "priority",
          "Priority",
        ]).toLowerCase();
        const priority = ["low", "medium", "high"].includes(priorityRaw)
          ? priorityRaw
          : "medium";

        if (!title) {
          gagal += 1;
          pesanGagal.push(`Baris ${i + 2}: Judul wajib diisi`);
          continue;
        }

        try {
          await addTodo({
            userId: "u-001",
            title,
            description,
            priority,
          });
          berhasil += 1;
        } catch (err) {
          gagal += 1;
          pesanGagal.push(
            `Baris ${i + 2}: ${err?.message || "Gagal menyimpan"}`,
          );
        }
      }

      summarizeImportResult(toast, {
        berhasil,
        gagal,
        pesanGagal,
        label: "todo",
      });
      if (berhasil > 0) loadTodos();
    } catch (err) {
      console.error(err);
      toast.error("Gagal membaca file Excel");
    } finally {
      setImporting(false);
    }
  };

  const statusConfig = {
    pending: { variant: "warning", label: "Pending" },
    "in-progress": { variant: "info", label: "In Progress" },
    done: { variant: "success", label: "Done" },
  };

  const priorityConfig = {
    low: { variant: "default", label: "Low" },
    medium: { variant: "warning", label: "Medium" },
    high: { variant: "danger", label: "High" },
  };

  return (
    <div className="p-6">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Todos</h1>
          <p className="text-gray-500 text-sm mt-1">
            Total: {filteredTodos.length} todo
            {search || statusFilter || priorityFilter
              ? ` (dari ${todos.length})`
              : ""}
          </p>
        </div>
        <PageActionsMenu
          tambahLabel="Tambah Todo"
          onTambah={handleOpenCreate}
          onExport={handleExportExcel}
          exportDisabled={filteredTodos.length === 0}
          importProps={{
            onFile: handleImportExcel,
            loading: importing,
            onDownloadTemplate: handleDownloadTemplate,
            title: "Import Excel Todos",
            hint: "Unduh template, isi judul/deskripsi/prioritas, lalu unggah.",
          }}
        />
      </div>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Cari judul atau deskripsi todo..."
      />

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">Semua Status</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">Semua Prioritas</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <Button onClick={handleFilter} variant="primary" size="sm">
          Cari
        </Button>
        <Button onClick={handleReset} variant="ghost" size="sm">
          Reset
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          ⚠️ {error}
        </div>
      )}

      {loading && <PageLoading label="Memuat data..." />}

      {!loading && filteredTodos.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-3">✅</p>
          <p className="font-medium">
            {search || statusFilter || priorityFilter
              ? "Tidak ada todo yang cocok"
              : "Belum ada todo"}
          </p>
          {!search && !statusFilter && !priorityFilter && (
            <p className="text-sm mt-1">
              Gunakan menu Aksi → Tambah Todo untuk memulai
            </p>
          )}
        </div>
      )}

      {!loading && filteredTodos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTodos.map((todo) => (
            <div
              key={todo.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-gray-900 flex-1 pr-2 leading-snug">
                  {todo.title}
                </h3>
                <Badge variant={priorityConfig[todo.priority]?.variant}>
                  {priorityConfig[todo.priority]?.label}
                </Badge>
              </div>

              {todo.description && (
                <p className="text-gray-500 text-sm mb-3 line-clamp-2">
                  {todo.description}
                </p>
              )}

              <div className="mb-3">
                <Badge variant={statusConfig[todo.status]?.variant}>
                  {statusConfig[todo.status]?.label}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {todo.status !== "pending" && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(todo, "pending")}
                    className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    Pending
                  </button>
                )}
                {todo.status !== "in-progress" && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(todo, "in-progress")}
                    className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
                  >
                    In Progress
                  </button>
                )}
                {todo.status !== "done" && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(todo, "done")}
                    className="text-xs px-2 py-1 rounded border border-green-200 text-green-600 hover:bg-green-50"
                  >
                    Done
                  </button>
                )}
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <Button
                  onClick={() => handleOpenEdit(todo)}
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                >
                  Edit
                </Button>
                <Button
                  onClick={() => handleDelete(todo)}
                  variant="danger"
                  size="sm"
                  className="flex-1"
                >
                  Hapus
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={selectedTodo ? "Edit Todo" : "Tambah Todo"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Judul
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleFormChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deskripsi
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prioritas
            </label>
            <select
              name="priority"
              value={formData.priority}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" onClick={handleCloseModal} variant="ghost">
              Batal
            </Button>
            <Button type="submit" variant="primary">
              {selectedTodo ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TodosPage;
