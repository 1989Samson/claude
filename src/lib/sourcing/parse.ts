// Shared tolerant parser: pull an array of JSON objects out of model text under a
// given key (e.g. "candidates" or "items"), brace-matching each object so a
// missing comma, stray token, or truncated final object never throws away the
// whole result.
export function parseObjectArray(text: string, key: string): unknown[] {
  const k = text.indexOf(`"${key}"`);
  const start = text.indexOf("[", k === -1 ? 0 : k);
  if (start === -1) return [];

  const out: unknown[] = [];
  let i = start + 1;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i]!)) i++; // skip whitespace/commas
    if (i >= text.length || text[i] === "]") break;
    if (text[i] !== "{") {
      const next = text.indexOf("{", i);
      if (next === -1) break;
      i = next;
    }
    let depth = 0;
    let j = i;
    let inStr = false;
    let esc = false;
    for (; j < text.length; j++) {
      const ch = text[j]!;
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    if (depth !== 0) break; // truncated final object: keep what we have
    try {
      out.push(JSON.parse(text.slice(i, j)));
    } catch {
      /* skip a malformed object, keep the rest */
    }
    i = j;
  }
  return out;
}

// Concatenate the assistant text blocks out of a Messages API response.
export function textOf(content: unknown[]): string {
  return content
    .filter(
      (b): b is { type: "text"; text: string } =>
        typeof b === "object" &&
        b !== null &&
        (b as { type?: unknown }).type === "text" &&
        typeof (b as { text?: unknown }).text === "string",
    )
    .map((b) => b.text)
    .join("\n");
}
