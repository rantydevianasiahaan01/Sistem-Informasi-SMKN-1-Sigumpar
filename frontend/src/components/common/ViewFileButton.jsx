import { Eye } from "lucide-react";

export default function ViewFileButton({ onClick, href, title }) {
  const className =
    "inline-flex items-center justify-center w-8 h-8 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors";

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        title={title}
        aria-label={title || "Lihat"}
        className={className}
      >
        <Eye size={14} />
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title || "Lihat"}
      className={className}
    >
      <Eye size={14} />
    </button>
  );
}
