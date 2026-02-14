/**
 * Auto-proper-case a name string.
 * Capitalizes first letter of each word, lowercases the rest.
 * Unicode-safe — Devanagari/Hindi has no case distinction so passes through unchanged.
 */
export function properCaseName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => {
      if (!word) return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Trim whitespace and collapse internal multiple spaces.
 */
export function trimWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
