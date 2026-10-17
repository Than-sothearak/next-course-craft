const allowedProtocols = new Set(["http:", "https:", "mailto:", "tel:"]);

export function isSafeLinkHref(value: string) {
  const href = value.trim();
  if (!href || href.length > 2_048 || /[\u0000-\u001f\u007f]/.test(href)) return false;
  if (href.startsWith("//") || href.startsWith("/\\")) return false;
  if (href.startsWith("/") || href.startsWith("#")) return true;

  try {
    return allowedProtocols.has(new URL(href).protocol);
  } catch {
    return false;
  }
}

export function normalizeLinkHref(value: string) {
  const href = value.trim();
  if (!href || href.startsWith("//")) return null;
  if (isSafeLinkHref(href)) return href;
  if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith("/")) return null;

  const withProtocol = `https://${href}`;
  return isSafeLinkHref(withProtocol) ? withProtocol : null;
}
