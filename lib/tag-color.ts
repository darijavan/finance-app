export function tagTextColor(background: string): "#000" | "#fff" {
  const hex = background.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

  return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? "#000" : "#fff";
}
