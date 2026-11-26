import { useMemo, useState } from "react";

export const PAGE_SIZE = 10;

/**
 * Paginasi sederhana untuk tabel.
 *
 * Halaman di-clamp saat render (bukan lewat useEffect) supaya daftar yang
 * menyusut karena filter tidak menyisakan halaman kosong.
 */
export default function usePagination(data, pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);

  const items = useMemo(
    () => list.slice(startIndex, startIndex + pageSize),
    [list, startIndex, pageSize],
  );

  return {
    page: safePage,
    setPage,
    totalPages,
    total,
    startIndex,
    endIndex,
    items,
    pageSize,
  };
}
