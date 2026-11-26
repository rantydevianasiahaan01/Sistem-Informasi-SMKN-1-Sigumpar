// ./frontend/src/components/ui/CustomModal.jsx
export default function CustomModal({ 
    show, 
    title, 
    message, 
    type = "info", 
    showForceLateBtn = false, // <--- [DITAMBAHKAN] Props untuk menampilkan tombol kirim terlambat
    onForceLate,              // <--- [DITAMBAHKAN] Callback saat tombol kirim terlambat diklik
    onClose 
  }) {
      if (!show) return null;
    
      const icons = {
        success: "✓",
        error: "✕",
        warning: "!",
        info: "ℹ"
      };
    
      const iconColors = {
        success: "bg-green-100 text-green-600",
        error: "bg-red-100 text-red-600",
        warning: "bg-yellow-100 text-yellow-600",
        info: "bg-blue-100 text-blue-600"
      };
    
      return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl text-center transform transition-all">
            <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 font-bold text-lg ${iconColors[type] || iconColors.info}`}>
              {icons[type] || icons.info}
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
            <p className="text-sm text-gray-600 mb-6">{message}</p>
            
            {/* <--- [DITAMBAHKAN] Render tombol tambahan jika status force late aktif */}
            <div className="flex flex-col gap-2">
              {showForceLateBtn && (
                <button
                  onClick={onForceLate}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 rounded-xl transition shadow-sm"
                >
                  ⏰ Kirim Terlambat
                </button>
              )}
              <button
                onClick={onClose}
                className={`w-full py-2.5 rounded-xl font-medium transition ${
                  showForceLateBtn 
                    ? "bg-gray-100 hover:bg-gray-200 text-gray-700" 
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {showForceLateBtn ? "Batal" : "Tutup"}
              </button>
            </div>
          </div>
        </div>
      );
    }