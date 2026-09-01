export interface SparklinePoint {
  x: number;
  y: number;
}

// Maps values onto an evenly spaced x-axis and a min/max-scaled y-axis,
// insetting both axes by `pad` so extrema markers and strokes don't clip
// against the SVG viewBox edges.
export function sparklinePoints(values: number[], w: number, h: number, pad: number): SparklinePoint[] {
  if (values.length < 2)

    return [];
  const min = Math.min(...values);
  const max = Math.max(...values);

  return values.map((v, i) => ({
    x: pad + (i / (values.length - 1)) * (w - pad * 2),
    y: pad + (1 - (v - min) / (max - min || 1)) * (h - pad * 2),
  }));
}
