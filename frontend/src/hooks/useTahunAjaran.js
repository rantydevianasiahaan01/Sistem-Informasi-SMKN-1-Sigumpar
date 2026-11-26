import { useCallback, useEffect, useMemo, useState } from "react";
import { academicApi } from "../api/academicApi";

/**
 * Daftar tahun ajaran untuk filter halaman.
 *
 * Pilihan awal jatuh ke tahun yang sedang aktif, jadi tampilan default tetap
 * sama seperti sebelum filter ini ada. Mengganti pilihan hanya mengubah data
 * yang dibaca halaman, tidak menyentuh tahun aktif di Tata Usaha.
 */
export default function useTahunAjaran() {
  const [daftar, setDaftar] = useState([]);
  const [tahunAjaranId, setTahunAjaranId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let aktif = true;

    academicApi
      .getAllTahunAjaran()
      .then((res) => {
        if (!aktif) return;

        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];

        setDaftar(list);

        const terpilih = list.find((item) => item.is_active) || list[0];
        if (terpilih) setTahunAjaranId(String(terpilih.id));
      })
      .catch((err) => {
        if (!aktif) return;

        console.error("Gagal memuat daftar tahun ajaran:", err);
        setDaftar([]);
      })
      .finally(() => {
        if (aktif) setLoading(false);
      });

    return () => {
      aktif = false;
    };
  }, []);

  const tahunAjaran = useMemo(
    () =>
      daftar.find((item) => String(item.id) === String(tahunAjaranId)) || null,
    [daftar, tahunAjaranId],
  );

  const gantiTahunAjaran = useCallback((id) => setTahunAjaranId(String(id)), []);

  return {
    daftarTahunAjaran: daftar,
    tahunAjaranId,
    setTahunAjaranId: gantiTahunAjaran,
    tahunAjaran,
    labelTahunAjaran: tahunAjaran?.label || "",
    loadingTahunAjaran: loading,
  };
}
