export type ScormManifestFile = { path: string };

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]!);
}

export function createScorm12Manifest({
  identifier,
  title,
  files,
}: {
  identifier: string;
  title: string;
  files: ScormManifestFile[];
}) {
  const fileEntries = [...new Set(["index.html", ...files.map(({ path }) => path)])]
    .map((path) => `      <file href="${escapeXml(path)}"/>`)
    .join("\n");
  const safeId = escapeXml(identifier.replace(/[^\w.-]/g, "_"));
  const safeTitle = escapeXml(title);

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${safeId}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="${safeId}-organization">
    <organization identifier="${safeId}-organization">
      <title>${safeTitle}</title>
      <item identifier="${safeId}-item" identifierref="${safeId}-resource">
        <title>${safeTitle}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="${safeId}-resource" type="webcontent" adlcp:scormtype="sco" href="index.html">
${fileEntries}
    </resource>
  </resources>
</manifest>`;
}
