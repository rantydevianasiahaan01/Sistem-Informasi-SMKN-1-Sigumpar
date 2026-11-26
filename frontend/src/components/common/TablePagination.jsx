/**
 * Footer paginasi tabel. Dipakai bersama hook usePagination:
 *
 *   const pg = usePagination(dataList);
 *   ...
 *   {pg.items.map(...)}
 *   <TablePagination pagination={pg} label="siswa" />
 */
export default function TablePagination({ pagination, label = "data" }) {
  const { page, setPage, totalPages, total, startIndex, endIndex } = pagination;

  // tanpa data tidak ada yang perlu dinavigasi
  if (!total) return null;

  const btnClass =
    "px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

  return (
    <div className="px-4 md:px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
      <span className="text-xs text-gray-400">
        Menampilkan{" "}
        <span className="font-semibold text-gray-600">
          {startIndex + 1}&ndash;{endIndex}
        </span>{" "}
        dari <span className="font-semibold text-gray-600">{total}</span> {label}
      </span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPage(page - 1)}
          disabled={page <= 1}
          className={btnClass}
        >
          &larr; Sebelumnya
        </button>

        <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
          Hal {page} / {totalPages}
        </span>

        <button
          type="button"
          onClick={() => setPage(page + 1)}
          disabled={page >= totalPages}
          className={btnClass}
        >
          Selanjutnya &rarr;
        </button>
      </div>
    </div>
  );
}
