import axios from "axios";
import sesi from "../sesi";
import toast from "react-hot-toast";
import { apiOrigin } from "./apiOrigin";

const axiosInstance = axios.create({
  baseURL: apiOrigin,
  withCredentials: true,
});

let pengalihanTerjadwal = false;

const alihkanKeLogin = (pesan) => {
  if (pengalihanTerjadwal) return;
  pengalihanTerjadwal = true;
  toast.error(pesan);
  setTimeout(() => sesi.login(), 1500);
};

axiosInstance.interceptors.request.use(
  async (config) => {
    // updateToken menukar cookie refresh dengan access token baru bila token
    // yang ada tinggal kurang dari 30 detik.
    try {
      await sesi.updateToken(30);
    } catch {
      // Diperlakukan sama seperti token yang tidak ada di bawah
    }

    if (!sesi.token) {
      alihkanKeLogin("Sesi Anda habis. Mengarahkan ke halaman masuk...");
      return Promise.reject(new Error("Token autentikasi tidak tersedia"));
    }

    config.headers.Authorization = `Bearer ${sesi.token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const asal = error.config;

    // 401 bisa berarti token kedaluwarsa duluan di sisi server. Coba perbarui
    // sekali, lalu ulangi request yang gagal, sebelum menyerah ke halaman masuk.
    if (status === 401 && asal && !asal._sudahCobaUlang) {
      asal._sudahCobaUlang = true;

      if (await sesi.perbarui().catch(() => false)) {
        asal.headers.Authorization = `Bearer ${sesi.token}`;
        return axiosInstance(asal);
      }

      alihkanKeLogin("Sesi Anda telah habis. Silakan masuk kembali.");
    } else if (status === 502) {
      toast.error("Server sedang bermasalah atau tidak dapat dijangkau.");
    } else if (!error.response) {
      toast.error("Gagal terhubung ke server.");
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
