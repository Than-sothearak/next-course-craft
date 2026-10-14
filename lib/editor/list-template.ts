/** Apply a list template's marker style while retaining the authored list content. */
export function applyListTemplateToHtml(contentHtml: string, templateHtml: string) {
  const contentDocument = new DOMParser().parseFromString(contentHtml, "text/html");
  const templateDocument = new DOMParser().parseFromString(templateHtml, "text/html");
  const templateList = templateDocument.body.querySelector("ul, ol");
  if (!templateList) return contentHtml;

  const templateTag = templateList.tagName.toLowerCase();
  const listStyle = templateList.getAttribute("data-list-style");
  const orderedType = templateList.getAttribute("type");
  const contentLists = [...contentDocument.body.querySelectorAll("ul, ol")];
  if (!contentLists.length) return contentHtml;

  for (const contentList of contentLists) {
    const replacement = contentDocument.createElement(templateTag);
    for (const attribute of [...contentList.attributes]) {
      if (attribute.name === "type" || attribute.name === "data-list-style") continue;
      replacement.setAttribute(attribute.name, attribute.value);
    }
    if (templateTag === "ul" && listStyle) {
      replacement.setAttribute("data-list-style", listStyle);
    }
    if (templateTag === "ol" && orderedType) {
      replacement.setAttribute("type", orderedType);
    }
    while (contentList.firstChild) {
      replacement.append(contentList.firstChild);
    }
    contentList.replaceWith(replacement);
  }

  return contentDocument.body.innerHTML;
}
