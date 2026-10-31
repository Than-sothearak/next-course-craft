import { parseGradient } from "@/lib/color";

export function SvgGradient({ id, value }: { id: string; value: string }) {
  const gradient = parseGradient(value);
  if (!gradient) return null;
  const radians = gradient.angle * Math.PI / 180;
  const x = Math.sin(radians) * 50;
  const y = Math.cos(radians) * 50;
  return <defs><linearGradient id={id} x1={`${50 - x}%`} y1={`${50 + y}%`} x2={`${50 + x}%`} y2={`${50 - y}%`}><stop offset="0%" stopColor={gradient.start} /><stop offset="100%" stopColor={gradient.end} /></linearGradient></defs>;
}
