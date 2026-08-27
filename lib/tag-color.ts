export function tagTextColor(background: string): "#000" | "#fff" {
  const hex = background.replace("#", "");
  const expanded = hex.length === 3 ? [...hex].map((channel) => channel.repeat(2)).join("") : hex;
  const channels = [0, 2, 4].map((i) => Number.parseInt(expanded.slice(i, i + 2), 16) / 255);
  const luminance = channels.reduce((total, channel, i) => {
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

    return total + linear * [0.2126, 0.7152, 0.0722][i];
  }, 0);
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);

  return blackContrast >= whiteContrast ? "#000" : "#fff";
}
