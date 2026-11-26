import { Download } from "lucide-react";

export default function DownloadFileButton({ onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title || "Unduh"}
      className="inline-flex items-center justify-center w-8 h-8 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg text-xs font-semibold transition-colors"
    >
      <Download size={14} />
    </button>
  );
}
