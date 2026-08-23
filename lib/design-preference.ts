export const BETA_DESIGN_KEY = "finance-design-language-v2";

export function readBetaDesign(storage: Pick<Storage, "getItem">): boolean {

  return storage.getItem(BETA_DESIGN_KEY) === "enabled";
}

export function writeBetaDesign(storage: Pick<Storage, "setItem">, enabled: boolean): void {
  storage.setItem(BETA_DESIGN_KEY, enabled ? "enabled" : "disabled");
}
