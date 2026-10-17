"use client";

/* eslint-disable @next/next/no-img-element -- Shared browser renderer must also work in static exports. */
import { useEffect, useRef, type CSSProperties } from "react";
import { ArrowRight, Check, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSlideTemplate, type TemplateSlotDefinition } from "@/lib/slides/template-definitions";
import type { SlideTemplateContent, TemplateSlot } from "@/lib/slides/template-schema";
import { mixSlideColors, readableSlideColor, slideContrast, type SlideTheme } from "@/lib/slides/themes";
import type { SlideAction } from "@/lib/slides/schema";
import styles from "./template-surface.module.css";

export type TemplateAuthoring = {
  selectedSlot: string | null;
  disabled?: boolean;
  onSelect: (key: string) => void;
  onTextChange: (key: string, content: string) => void;
  onChooseImage: (key: string) => void;
};

function EditableText({ value, definition, authoring, className }: { value: string; definition: TemplateSlotDefinition; authoring?: TemplateAuthoring; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) ref.current.textContent = value;
  }, [value, authoring]);
  if (!authoring) return definition.role === "heading" ? <h2 className={className}>{value}</h2> : <p className={className}>{value}</p>;
  return <div ref={ref} contentEditable={!authoring.disabled} suppressContentEditableWarning role="textbox" aria-multiline={definition.role !== "eyebrow"} aria-label={definition.label} tabIndex={0} data-placeholder={`Add ${definition.label.toLowerCase()}`} className={`${className} ${styles.editable} ${authoring.selectedSlot === definition.key ? styles.selected : ""}`}
    onFocus={() => authoring.onSelect(definition.key)}
    onInput={(event) => {
      const raw = event.currentTarget.innerText ?? event.currentTarget.textContent ?? "";
      const content = raw.slice(0, definition.maximum ?? 5_000);
      if (raw !== content) event.currentTarget.textContent = content;
      authoring.onTextChange(definition.key, content);
    }}
    onBlur={(event) => {
      const content = (event.currentTarget.innerText ?? event.currentTarget.textContent ?? "").slice(0, definition.maximum ?? 5_000);
      event.currentTarget.textContent = content;
      authoring.onTextChange(definition.key, content);
    }}
    onKeyDown={(event) => { if (event.key === "Escape") event.currentTarget.blur(); }}
    onPaste={(event) => {
      event.preventDefault();
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      const plain = event.clipboardData.getData("text/plain").slice(0, definition.maximum ?? 5_000);
      range.deleteContents(); const node = document.createTextNode(plain); range.insertNode(node); range.setStartAfter(node); range.collapse(true);
      selection.removeAllRanges(); selection.addRange(range);
      const raw = ref.current?.innerText ?? ref.current?.textContent ?? "";
      const content = raw.slice(0, definition.maximum ?? 5_000);
      if (ref.current && raw !== content) ref.current.textContent = content;
      authoring.onTextChange(definition.key, content);
    }} />;
}

export function ImagePlaceholder() {
  return <div className={styles.placeholder} aria-hidden="true"><svg viewBox="0 0 600 520" fill="none"><circle cx="400" cy="145" r="86" fill="var(--slide-accent)" opacity=".58" /><path d="M0 400 210 160 600 520H0Z" fill="var(--slide-primary)" opacity=".85" /><path d="m230 520 250-270 120 140v130Z" fill="var(--slide-secondary)" opacity=".75" /><path d="M0 455c150-120 350 110 600-70v135H0Z" fill="var(--slide-primary)" opacity=".22" /></svg></div>;
}

export function TemplateSurface({ template, theme: courseTheme, authoring, onAction, staticPreview = false }: { template: SlideTemplateContent; theme: SlideTheme; authoring?: TemplateAuthoring; onAction?: (actions: SlideAction[]) => void; staticPreview?: boolean }) {
  const definition = getSlideTemplate(template.id);
  const theme = { ...courseTheme, ...template.design.themeOverrides };
  const background = template.design.background === "primary" ? theme.primaryColor : template.design.background === "soft" ? mixSlideColors(theme.primaryColor, theme.backgroundColor, 0.1) : theme.backgroundColor;
  const text = readableSlideColor(background);
  const brand = slideContrast(theme.primaryColor, background) >= 4.5 ? theme.primaryColor : text;
  const soft = mixSlideColors(theme.primaryColor, background, 0.09);
  const cardBackground = theme.cardStyle === "outline" ? background : soft;
  const cardText = readableSlideColor(cardBackground);
  const customColors = theme.preset === "custom" || ["primaryColor", "secondaryColor", "accentColor", "backgroundColor"].some((key) => key in template.design.themeOverrides);
  const density = template.design.density === "theme" ? theme.density : template.design.density;
  const css = {
    "--slide-primary": theme.primaryColor, "--slide-secondary": theme.secondaryColor,
    "--slide-accent": theme.accentColor, "--slide-background": background, "--slide-text": text,
    "--slide-brand-text": brand, "--slide-on-primary": readableSlideColor(theme.primaryColor),
    "--slide-soft": soft, "--slide-card-text": cardText,
    "--slide-card-brand": slideContrast(theme.primaryColor, cardBackground) >= 4.5 ? theme.primaryColor : cardText,
    "--slide-line": mixSlideColors(text, background, 0.18),
    "--slide-padding": density === "compact" ? "4cqw" : density === "spacious" ? "6.5cqw" : "5.3cqw",
    "--slide-radius": `${theme.radius / 12.8}cqw`, "--slide-heading-scale": theme.headingScale, "--slide-body-scale": theme.bodyScale,
    fontFamily: theme.fontFamily === "serif" ? "Georgia, 'Times New Roman', serif" : theme.fontFamily === "rounded" ? "'Trebuchet MS', Arial, sans-serif" : "Arial, Helvetica, sans-serif",
  } as CSSProperties;
  const textSlot = (key: string) => {
    const slot = template.slots[key], spec = definition.slots.find((item) => item.key === key);
    if (!spec || slot?.type !== "text") return null;
    return <EditableText key={key} value={slot.content} definition={spec} authoring={authoring} className={spec.role === "heading" ? styles.heading : spec.role === "eyebrow" ? styles.eyebrow : styles.body} />;
  };
  const mediaSlot = template.slots.image;
  const media = <div className={`${styles.media} ${authoring?.selectedSlot === "image" ? styles.selected : ""}`}>
    {mediaSlot?.type === "image" && mediaSlot.src ? <img src={mediaSlot.src} alt={mediaSlot.alt} style={{ objectFit: template.design.imageFit, objectPosition: template.design.imagePosition }} /> : <ImagePlaceholder />}
    {authoring && <Button className={styles.replaceImage} variant="secondary" disabled={authoring.disabled} onClick={() => { authoring.onSelect("image"); authoring.onChooseImage("image"); }}><ImagePlus size={16} /> {mediaSlot?.type === "image" && mediaSlot.src ? "Replace image" : "Choose image"}</Button>}
  </div>;
  const navigation = template.slots.button;
  const actionButton = navigation?.type === "button" && navigation.visible ? staticPreview ? <span className={styles.action} data-style={theme.buttonStyle}>{navigation.label}<ArrowRight aria-hidden="true" size={18} /></span> : <Button className={styles.action} data-style={theme.buttonStyle} disabled={authoring?.disabled} onClick={() => authoring ? authoring.onSelect("button") : onAction?.([{ type: navigation.action }])}>{navigation.label}<ArrowRight aria-hidden="true" size={18} /></Button> : null;
  const list = template.slots.items;
  const cards = list?.type === "list" ? <div className={`${styles.items} ${authoring?.selectedSlot === "items" ? styles.selected : ""}`} data-card-style={theme.cardStyle} role={authoring ? "button" : undefined} tabIndex={authoring ? 0 : undefined} aria-label={authoring ? `Edit ${definition.slots.find((slot) => slot.key === "items")?.label.toLowerCase()}` : undefined} onClick={authoring ? () => authoring.onSelect("items") : undefined} onKeyDown={authoring ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); authoring.onSelect("items"); } } : undefined}>
    {list.items.map((item, index) => <article key={item.id} className={styles.card}><span className={styles.number} aria-hidden="true">{definition.kind === "list" ? <Check size={18} /> : String(index + 1).padStart(2, "0")}</span><div><h3>{item.title}</h3><p>{item.body}</p></div></article>)}
  </div> : null;
  const imageSide = template.design.variant === "alternate" ? definition.imageSide === "left" ? "right" : "left" : definition.imageSide;
  return <div className={styles.container} style={css} data-slide-template={template.id}>
    <section className={`${styles.surface} ${styles[definition.kind]}`} data-variant={template.design.variant} data-image-side={imageSide} data-creative={theme.preset === "creative" && !customColors} data-custom-colors={customColors} aria-label={definition.name}>
      {(definition.kind === "hero" || definition.kind === "section" || definition.kind === "completion") && <div className={styles.decoration} aria-hidden="true"><span /><span /><span /></div>}
      {definition.kind === "fullImage" && media}
      <div className={styles.content}>{textSlot("eyebrow")}{definition.kind === "quote" && <span className={styles.quoteMark} aria-hidden="true">“</span>}{textSlot("title")}{textSlot("body")}{actionButton}</div>
      {definition.kind === "split" && media}
      {cards}
      <span className={styles.footerMark} aria-hidden="true"><span /> LEARN SOMETHING NEW</span>
    </section>
  </div>;
}

export function updateTemplateSlot(template: SlideTemplateContent, key: string, updater: (slot: TemplateSlot) => TemplateSlot) {
  const slot = template.slots[key];
  return slot ? { ...template, slots: { ...template.slots, [key]: updater(slot) } } : template;
}
