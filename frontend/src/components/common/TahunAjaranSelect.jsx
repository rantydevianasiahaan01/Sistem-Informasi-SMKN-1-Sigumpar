import React from "react";

/**
 * Dropdown pemilih tahun ajaran untuk filter halaman.
 * Dipakai bersama hook useTahunAjaran.
 */
export default function TahunAjaranSelect({
  value,
  onChange,
  daftar = [],
  loading = false,
  label = "Tahun Ajaran",
  labelClassName = "block text-xs text-gray-400 mb-1",
  className = "",
  selectClassName = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500",
}) {
  return (
    <div className={className}>
      {label && <label className={labelClassName}>{label}</label>}

      <select
        value={value || ""}
        disabled={loading || daftar.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className={selectClassName}
      >
        {loading && <option value="">Memuat tahun ajaran...</option>}

        {!loading && daftar.length === 0 && (
          <option value="">Belum ada tahun ajaran</option>
        )}

        {daftar.map((tahun) => (
          <option key={tahun.id} value={String(tahun.id)}>
            {tahun.label}
            {tahun.is_active ? " (aktif)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
