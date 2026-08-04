export function withQueryParam(search: string, key: string, value: string): string {
  const params = new URLSearchParams(search);
  if (value) params.set(key, value);
  else params.delete(key);

  return params.toString();
}
