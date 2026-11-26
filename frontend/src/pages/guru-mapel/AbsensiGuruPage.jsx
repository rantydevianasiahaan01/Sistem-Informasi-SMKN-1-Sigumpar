import { useEffect, useMemo, useRef, useState } from "react";
import usePagination from "../../hooks/usePagination";
import TablePagination from "../../components/common/TablePagination";
import { learningApi } from "../../api/learningApi";
import CustomModal from "../../components/ui/CustomModal";
import PageActionsMenu from "../../components/common/PageActionsMenu";
import SearchBar from "../../components/common/SearchBar";
import { exportRowsToExcel } from "../../utils/exportExcel";
import useTahunAjaran from "../../hooks/useTahunAjaran";
import TahunAjaranSelect from "../../components/common/TahunAjaranSelect";
import { TableLoadingRow } from "../../components/common/PageLoading";
import toast from "react-hot-toast";



const tanggalJakarta = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const formatJam = (value) =>
  value
    ? `${new Date(value).toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
      })} WIB`
    : "-";

export default function AbsensiGuruPage() {
  const [foto, setFoto] = useState("");
  const [preview, setPreview] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingRiwayat, setLoadingRiwayat] = useState(true);
  const [previewRiwayat, setPreviewRiwayat] = useState(null);
  const [jenis, setJenis] = useState("Masuk");
  const [fileKey, setFileKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // State untuk Live Webcam
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // <--- [DITAMBAHKAN] State modal ditambah properti showForceLateBtn dan onForceLate
  const [modalAlert, setModalAlert] = useState({
    show: false,
    title: "",
    message: "",
    type: "info",
    showForceLateBtn: false,
    onForceLate: null,
  });

  const galleryRef = useRef(null);

  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();


  const loadAbsensi = async () => {
    setLoadingRiwayat(true);
    try {
      const res = await learningApi.getAbsensiGuru(
        tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {},
      );
      setRiwayat(res.data?.data || []);
    } catch (err) {
      // Abaikan console.error agar konsol tetap bersih
    } finally {
      setLoadingRiwayat(false);
    }
  };

  useEffect(() => {
    if (loadingTahunAjaran) return;

    loadAbsensi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunAjaranId, loadingTahunAjaran]);

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const absensiHariIni = useMemo(() => {
    const hariIni = tanggalJakarta();
    return riwayat.find(
      (item) => String(item.tanggal || "").slice(0, 10) === hariIni,
    );
  }, [riwayat]);

  const sudahMasuk = Boolean(absensiHariIni);
  const sudahPulang = Boolean(absensiHariIni?.jamKeluar);
  const selesai = sudahMasuk && sudahPulang;

  useEffect(() => {
    setJenis(sudahMasuk && !sudahPulang ? "Pulang" : "Masuk");
  }, [sudahMasuk, sudahPulang]);

  const handleFotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFoto(reader.result);
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    setShowPhotoOptions(false);
    try {
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setModalAlert({
        show: true,
        title: "Akses Kamera Ditolak",
        message:
          "Tidak dapat mengakses kamera. Pastikan izin browser sudah diaktifkan.",
        type: "error",
        showForceLateBtn: false,
      });
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg");
    setFoto(dataUrl);
    setPreview(dataUrl);
    stopCamera();
  };

  // <--- [DIUBAH] Fungsi submit menerima parameter isForceLate
  const executeSubmit = async (isForceLate = false) => {
    try {
      setLoading(true);

      await learningApi.createAbsensiGuru({
        foto,
        keterangan,
        jenis,
        forceTerlambat: isForceLate, // Mengirim flag ke backend
      });

      setModalAlert({
        show: true,
        title: "Berhasil",
        message: `Absensi ${jenis.toLowerCase()} ${isForceLate ? "(Terlambat)" : ""} berhasil disimpan.`,
        type: "success",
        showForceLateBtn: false,
      });

      setFoto("");
      setPreview("");
      setShowPhotoOptions(false);
      setKeterangan("");
      setFileKey((k) => k + 1);

      await loadAbsensi();
    } catch (err) {
      const resData = err.response?.data;
      // <--- [DIUBAH] Deteksi apakah error dari backend merupakan penolakan batas jam 07.30
      const isLateReject =
        resData?.canForceLate || resData?.message?.includes("07.30");

      setModalAlert({
        show: true,
        title: isLateReject ? "Peringatan Waktu" : "Gagal Menyimpan Absensi",
        message: resData?.message || "Gagal menyimpan absensi guru",
        type: isLateReject ? "warning" : "error",
        showForceLateBtn: Boolean(isLateReject), // Munculkan tombol Kirim Terlambat
        onForceLate: () => {
          setModalAlert({
            show: false,
            title: "",
            message: "",
            type: "info",
            showForceLateBtn: false,
          });
          executeSubmit(true); // Eksekusi ulang dengan mode force terlambat
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selesai) {
      setModalAlert({
        show: true,
        title: "Informasi",
        message: "Absensi masuk dan pulang hari ini sudah lengkap.",
        type: "info",
        showForceLateBtn: false,
      });
      return;
    }

    if (!foto) {
      setModalAlert({
        show: true,
        title: "Peringatan",
        message: "Foto absensi wajib diunggah.",
        type: "warning",
        showForceLateBtn: false,
      });
      return;
    }

    executeSubmit(false);
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = riwayat.filter((item) => {
    if (!q) return true;
    return (
      String(item.tanggal || "").toLowerCase().includes(q) ||
      formatJam(item.jamMasuk).toLowerCase().includes(q) ||
      formatJam(item.jamKeluar).toLowerCase().includes(q) ||
      String(item.status || "").toLowerCase().includes(q) ||
      String(item.keterangan || "").toLowerCase().includes(q)
    );
  });

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((item, index) => ({
        No: index + 1,
        Tanggal: item.tanggal ? String(item.tanggal).slice(0, 10) : "-",
        "Jam Masuk": formatJam(item.jamMasuk),
        "Jam Keluar": formatJam(item.jamKeluar),
        Status: item.status || "-",
        Keterangan: item.keterangan || "-",
      })),
      { sheetName: "Absensi Guru", fileName: "riwayat-absensi-guru" },
    );
  };

  const scrollToForm = () => {
    const el = document.getElementById("form-aksi");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof el.focus === "function") el.focus();
    }
  };

  const pg = usePagination(filtered);

  return (
    <div className="w-full">
      {/* <--- [DIUBAH] Meneruskan properti tambahan ke CustomModal */}
      <CustomModal
        show={modalAlert.show}
        title={modalAlert.title}
        message={modalAlert.message}
        type={modalAlert.type}
        showForceLateBtn={modalAlert.showForceLateBtn}
        onForceLate={modalAlert.onForceLate}
        onClose={() =>
          setModalAlert({
            show: false,
            title: "",
            message: "",
            type: "info",
            showForceLateBtn: false,
          })
        }
      />

      {isCameraOpen && (
        <div className="fixed inset-0 bg-black z-50">
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            <h3 className="absolute top-0 inset-x-0 z-10 px-4 py-4 text-center font-semibold text-white bg-black/40">
              Ambil Foto Kamera
            </h3>
            <div className="w-full h-full bg-black overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-0 inset-x-0 z-10 flex gap-3 p-4 bg-black/40">
              <button
                type="button"
                onClick={capturePhoto}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition"
              >
                Ambil Foto
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="flex-1 bg-white/90 hover:bg-white text-gray-800 py-3 rounded-lg font-medium transition"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {showPhotoOptions && (
        <div
          className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4"
          onClick={() => setShowPhotoOptions(false)}
        >
          <div
            className="bg-white rounded-xl p-5 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-gray-800 text-center mb-4">
              Tambah Foto Absensi
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={startCamera}
                disabled={selesai}
                className="py-3 border border-blue-200 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-sm transition disabled:opacity-40"
              >
                Buka Kamera
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPhotoOptions(false);
                  galleryRef.current?.click();
                }}
                disabled={selesai}
                className="py-3 border border-green-200 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 font-semibold text-sm transition disabled:opacity-40"
              >
                Pilih Gambar/File
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowPhotoOptions(false)}
              className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {previewRiwayat && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewRiwayat(null)}
        >
          <div
            className="bg-white rounded-xl p-4 max-w-3xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-800">Foto Absensi</h3>
              <button
                onClick={() => setPreviewRiwayat(null)}
                className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200"
              >
                Tutup
              </button>
            </div>

            <img
              src={previewRiwayat}
              alt="Preview Foto Absensi"
              className="max-w-full max-h-[75vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6 flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Absensi Guru</h1>
          <p className="text-gray-600">
            Guru mapel melakukan absensi masuk dan pulang menggunakan foto.
          </p>
        </div>
        <PageActionsMenu
          tambahLabel="Tambah Absensi"
          onTambah={scrollToForm}
          onExport={handleExportExcel}
          exportDisabled={filtered.length === 0}
          onImportUnavailable={() =>
            toast.error(
              "Import Excel tidak tersedia. Absensi guru dilakukan secara interaktif dengan foto.",
            )
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          id="form-aksi"
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow p-4 md:p-6"
        >
          <h2 className="text-lg font-semibold mb-4">Form Absensi</h2>

          <div className="mb-4">
            <label className="block font-medium mb-2">Jenis Absensi</label>
            <select
              value={jenis}
              onChange={(e) => setJenis(e.target.value)}
              disabled={selesai}
              className="w-full border rounded-lg p-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="Masuk" disabled={sudahMasuk}>
                Clock In &mdash; Absen Masuk
                {sudahMasuk ? " (sudah tercatat)" : ""}
              </option>
              <option value="Pulang" disabled={sudahPulang}>
                Clock Out &mdash; Absen Pulang
                {sudahPulang ? " (sudah tercatat)" : ""}
              </option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block font-medium mb-2">
              Foto Absensi {selesai ? "" : jenis}
            </label>

            <input
              key={`gal-${fileKey}`}
              ref={galleryRef}
              type="file"
              accept="image/*"
              onChange={handleFotoChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => setShowPhotoOptions(true)}
              disabled={selesai}
              className="w-full min-h-32 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {preview ? "Ganti Foto Absensi" : "Tambah Foto Absensi"}
              <span className="block mt-1 text-xs font-normal text-blue-600">
                Klik untuk memilih kamera atau gambar/file
              </span>
            </button>
          </div>

          {preview && (
            <div className="mb-4">
              <img
                src={preview}
                alt="Preview absensi"
                className="w-48 h-48 object-cover rounded-lg border"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block font-medium mb-2">Keterangan</label>
            <textarea
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              rows="3"
              disabled={selesai}
              className="w-full border rounded-lg p-2 disabled:bg-gray-100"
              placeholder="Opsional"
            />
          </div>

          <button
            type="submit"
            disabled={loading || selesai}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? "Menyimpan..."
              : selesai
                ? "Absensi hari ini sudah lengkap"
                : `Simpan Absensi ${jenis}`}
          </button>

          {sudahMasuk && !sudahPulang && (
            <p className="text-xs text-gray-500 mt-3">
              Absensi masuk sudah tercatat pukul{" "}
              {formatJam(absensiHariIni.jamMasuk)}. Pilih Clock Out lalu unggah
              foto untuk absen pulang.
            </p>
          )}
        </form>

        <div className="bg-white rounded-xl shadow p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">Riwayat Absensi</h2>

            <div className="flex flex-wrap items-end gap-3">
            <TahunAjaranSelect
              value={tahunAjaranId}
              onChange={setTahunAjaranId}
              daftar={daftarTahunAjaran}
              loading={loadingTahunAjaran}
              className="min-w-40"
            />
            </div>
          </div>

          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Cari tanggal, status, atau keterangan..."
          />

          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Foto Masuk</th>
                  <th className="border p-2 text-left">Foto Pulang</th>
                  <th className="border p-2 text-left">Tanggal</th>
                  <th className="border p-2 text-left">Jam Masuk</th>
                  <th className="border p-2 text-left">Jam Keluar</th>
                  <th className="border p-2 text-left">Status</th>
                  <th className="border p-2 text-left">Keterangan</th>
                </tr>
              </thead>

              <tbody>
                {loadingRiwayat ? (
                  <TableLoadingRow colSpan={7} label="Memuat riwayat absensi..." />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="border p-6 text-center text-gray-500"
                    >
                      {searchQuery
                        ? "Tidak ada riwayat yang cocok"
                        : "Belum ada riwayat absensi."}
                    </td>
                  </tr>
                ) : (
                  pg.items.map((item) => (
                    <tr key={item.id_absensiGuru || item.id}>
                      <td className="border p-2">
                        {item.foto ? (
                          <img
                            src={item.foto}
                            alt="Foto Absensi Masuk"
                            className="w-16 h-16 object-cover rounded-lg border cursor-pointer hover:opacity-80"
                            onClick={() => setPreviewRiwayat(item.foto)}
                          />
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="border p-2">
                        {item.fotoPulang ? (
                          <img
                            src={item.fotoPulang}
                            alt="Foto Absensi Pulang"
                            className="w-16 h-16 object-cover rounded-lg border cursor-pointer hover:opacity-80"
                            onClick={() => setPreviewRiwayat(item.fotoPulang)}
                          />
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="border p-2">
                        {item.tanggal ? String(item.tanggal).slice(0, 10) : "-"}
                      </td>

                      <td className="border p-2">{formatJam(item.jamMasuk)}</td>

                      <td className="border p-2">
                        {formatJam(item.jamKeluar)}
                      </td>

                      <td className="border p-2">{item.status || "-"}</td>

                      <td className="border p-2">{item.keterangan || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination pagination={pg} label="riwayat" />
        </div>
      </div>
    </div>
  );
}
