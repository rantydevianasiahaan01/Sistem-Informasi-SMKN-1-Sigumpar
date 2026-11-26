import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import LoginPage from "./pages/LoginPage";
import sesi from "./sesi";
import "./index.css";

/**
 * Saat aplikasi dibuka, cookie refresh ditukar dengan access token baru. Kalau
 * cookie-nya tidak ada atau sudah tidak berlaku, halaman masuk yang tampil —
 * tidak ada lagi pengalihan ke server login terpisah seperti zaman Keycloak.
 */
function AppWrapper() {
  const [siap, setSiap] = React.useState(false);
  const [masuk, setMasuk] = React.useState(false);

  React.useEffect(() => {
    let batal = false;

    sesi
      .perbarui()
      .catch(() => false)
      .then((berhasil) => {
        if (batal) return;
        setMasuk(Boolean(berhasil) && !sesi.harusGantiPassword);
        setSiap(true);
      });

    return () => {
      batal = true;
    };
  }, []);

  if (!siap) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Memuat sesi...
      </div>
    );
  }

  if (!masuk) {
    return <LoginPage onBerhasil={() => setMasuk(true)} />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>,
);
