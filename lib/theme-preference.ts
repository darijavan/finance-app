export const V2_THEME_KEY = "finance-design-language-v2-theme";

export type V2Theme = "light" | "dark";

export function readV2Theme(storage: Pick<Storage, "getItem">): V2Theme | null {
  const v = storage.getItem(V2_THEME_KEY);

  return v === "light" || v === "dark" ? v : null;
}

export function writeV2Theme(storage: Pick<Storage, "setItem">, theme: V2Theme): void {
  storage.setItem(V2_THEME_KEY, theme);
}
