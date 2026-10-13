export function normalizeFontSize(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const match = String(value).trim().match(/^(\d+)(?:px)?$/i);
  if (!match) return null;
  const pixels = Number(match[1]);
  return Number.isInteger(pixels) && pixels >= 8 && pixels <= 200 ? `${pixels}px` : null;
}

export function normalizeHexColor(value: string | null | undefined) {
  const input = value?.trim();
  if (!input) return null;
  const color = input.startsWith("#") ? input : `#${input}`;

  const shortHex = color.match(/^#([\da-f])([\da-f])([\da-f])$/i);
  if (shortHex) return `#${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}${shortHex[3]}${shortHex[3]}`.toLowerCase();
  if (/^#[\da-f]{6}$/i.test(color)) return color.toLowerCase();

  const rgb = input.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(1(?:\.0+)?))?\s*\)$/i);
  if (!rgb) return null;
  const channels = rgb.slice(1, 4).map(Number);
  if (channels.some((channel) => channel > 255)) return null;
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
