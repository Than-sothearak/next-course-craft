export type Scorm2004ManifestFile = { path: string };

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]!);
}

export function createScorm2004Manifest({
  identifier,
  title,
  files,
}: {
  identifier: string;
  title: string;
  files: Scorm2004ManifestFile[];
}) {
  const fileEntries = [...new Set(["index.html", ...files.map(({ path }) => path)])]
    .map((path) => `      <file href="${escapeXml(path)}"/>`)
    .join("\n");
  const safeId = escapeXml(identifier.replace(/[^\w.-]/g, "_"));
  const safeTitle = escapeXml(title);

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${safeId}" version="1.0"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 SCORM-schemas/imscp_v1p1.xsd http://www.adlnet.org/xsd/adlcp_v1p3 SCORM-schemas/adlcp_v1p3.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="${safeId}-organization">
    <organization identifier="${safeId}-organization">
      <title>${safeTitle}</title>
      <item identifier="${safeId}-item" identifierref="${safeId}-resource" isvisible="true">
        <title>${safeTitle}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="${safeId}-resource" type="webcontent" adlcp:scormType="sco" href="index.html">
${fileEntries}
    </resource>
  </resources>
</manifest>`;
}
