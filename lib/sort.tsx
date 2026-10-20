"use client";

import { useState, useMemo, type ReactNode } from "react";

export type SortDir = "asc" | "desc";

export interface SortState<K extends string> {
  key: K | null;
  dir: SortDir;
  toggle: (key: K) => void;
}

// Reusable click-to-sort state for a table. First click on a column sorts
// ascending; clicking the same column again flips direction.
export function useSort<K extends string>(initialKey: K | null = null, initialDir: SortDir = "asc"): SortState<K> {
  const [key, setKey] = useState<K | null>(initialKey);
  const [dir, setDir] = useState<SortDir>(initialDir);
  const toggle = (k: K) => {
    if (k === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setKey(k);
      setDir("asc");
    }
  };
  
  return { key, dir, toggle };
}

// Sort a copy of `rows` using a per-key accessor map. Rows are left untouched
// when no sort key is active. Strings sort case-insensitively; other values
// compare with < / >.
export function useSorted<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  accessors: Record<K, (row: T) => string | number | null | undefined>
): T[] {
  
  return useMemo(() => {
    if (!sort.key) 

    return rows;
    const acc = accessors[sort.key];
    const mult = sort.dir === "asc" ? 1 : -1;
    
    return [...rows].sort((a, b) => {
      let av = acc(a);
      let bv = acc(b);
      if (av == null && bv == null) 

      return 0;
      if (av == null) 

      return 1; // nulls last
      if (bv == null) 

      return -1;
      if (typeof av === "string" && typeof bv === "string") {
        av = av.toLowerCase();
        bv = bv.toLowerCase();
      }
      if (av < bv) 

      return -1 * mult;
      if (av > bv) 

      return 1 * mult;
      
      return 0;
    });
  }, [rows, sort.key, sort.dir, accessors]);
}

// A sortable <th>. The label is a real button so it works from the keyboard;
// aria-sort tells screen readers the active column and direction.
export function SortHeader<K extends string>({
  sort, k, children, className,
}: {
  sort: SortState<K>;
  k: K;
  children: ReactNode;
  className?: string;
}) {
  const active = sort.key === k;
  const arrow = active ? (sort.dir === "asc" ? " ▲" : " ▼") : " ↕";
  
  return (
    <th
      className={className}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <button type="button" className="sort" onClick={() => sort.toggle(k)} title="Sort by this column">
        {children}
        <span aria-hidden="true" style={{ opacity: active ? 1 : 0.25 }}>{arrow}</span>
      </button>
    </th>
  );
}
