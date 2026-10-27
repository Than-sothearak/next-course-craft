const audioTypesByExtension: Record<string, string> = {
  mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", oga: "audio/ogg",
  wav: "audio/wav", webm: "audio/webm", weba: "audio/webm",
};
const audioAliases: Record<string, string> = {
  "audio/mp3": "audio/mpeg", "audio/x-m4a": "audio/mp4",
  "audio/x-wav": "audio/wav", "audio/wave": "audio/wav", "audio/vnd.wave": "audio/wav",
};

export function audioUploadContentType(file: { name: string; type: string }) {
  const type = file.type.toLowerCase();
  if (audioAliases[type]) return audioAliases[type];
  if (Object.values(audioTypesByExtension).includes(type)) return type;
  if (!type || type === "application/octet-stream" || type === "video/webm") {
    return audioTypesByExtension[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? type;
  }
  return type;
}
