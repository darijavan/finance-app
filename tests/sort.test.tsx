// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SortHeader, useSort, useSorted } from "../lib/sort.tsx";

type Row = { name: string | null; amount: number };

function Table({ rows }: { rows: Row[] }) {
  const sort = useSort<"name" | "amount">();
  const sorted = useSorted(rows, sort, { name: (row) => row.name, amount: (row) => row.amount });

  return <table><thead><tr><SortHeader sort={sort} k="name">Name</SortHeader></tr></thead><tbody>{sorted.map((row) => <tr key={row.amount}><td>{row.name ?? "none"}</td></tr>)}</tbody></table>;
}

it("sorts strings case-insensitively, flips direction, and keeps null values last", () => {
  render(<Table rows={[{ name: null, amount: 1 }, { name: "beta", amount: 2 }, { name: "Alpha", amount: 3 }]} />);
  const button = screen.getByRole("button", { name: /name/i });

  fireEvent.click(button);
  expect(screen.getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Alpha", "beta", "none"]);
  expect(screen.getByRole("columnheader").getAttribute("aria-sort")).toBe("ascending");

  fireEvent.click(button);
  expect(screen.getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["beta", "Alpha", "none"]);
  expect(screen.getByRole("columnheader").getAttribute("aria-sort")).toBe("descending");
});
