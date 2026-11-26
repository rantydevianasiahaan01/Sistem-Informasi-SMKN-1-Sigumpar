import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Bilah tipis di atas saat berpindah halaman — feedback cepat sebelum
 * indikator loading data di halaman selesai.
 */
export default function RouteLoadingBar() {
  const location = useLocation();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    const done = window.setTimeout(() => setActive(false), 500);
    return () => window.clearTimeout(done);
  }, [location.pathname, location.search]);

  if (!active) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] h-1 overflow-hidden bg-blue-100"
      aria-hidden="true"
    >
      <div className="h-full w-1/3 bg-blue-600 animate-[route-load_0.5s_ease-out_forwards]" />
      <style>{`
        @keyframes route-load {
          from { transform: translateX(-100%); width: 30%; }
          to { transform: translateX(250%); width: 40%; }
        }
      `}</style>
    </div>
  );
}
