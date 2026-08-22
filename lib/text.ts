const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, (e) => ENTITY_MAP[e] || e);
}
