import { useId } from "react";
import { ArrowRight, BookOpen, Check, FileText, Flag, Gift, Globe, Headphones, Heart, HelpCircle, Image, Info, Lightbulb, MapPin, MessageCircle, MousePointer2, Play, Plus, Search, Settings, Sparkles, Star, Video, Volume2 } from "lucide-react";
import type { interactionIcons } from "@/lib/editor/interaction-button";
import { parseGradient } from "@/lib/color";
import { SvgGradient } from "./svg-gradient";
const icons = { info: Info, help: HelpCircle, play: Play, volume: Volume2, book: BookOpen, lightbulb: Lightbulb, star: Star, plus: Plus, pin: MapPin, pointer: MousePointer2, check: Check, gift: Gift, image: Image, video: Video, message: MessageCircle, search: Search, flag: Flag, heart: Heart, globe: Globe, settings: Settings, arrow: ArrowRight, file: FileText, headphones: Headphones, sparkles: Sparkles };
export function InteractionIcon({ name, size = 32, className, color }: { name: typeof interactionIcons[number]; size?: number; className?: string; color?: string }) {
  const id = `interaction-icon-${useId().replaceAll(":", "")}`;
  const Icon = icons[name];
  return <Icon size={size} className={className} aria-hidden="true" stroke={color && parseGradient(color) ? `url(#${id})` : color ?? "currentColor"}>{color && <SvgGradient id={id} value={color} />}</Icon>;
}
