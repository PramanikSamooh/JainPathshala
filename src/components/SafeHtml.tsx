"use client";

import DOMPurify from "dompurify";

interface SafeHtmlProps {
  html: string;
  className?: string;
}

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "a", "img",
  "table", "thead", "tbody", "tr", "th", "td",
  "hr", "span", "div", "mark", "sub", "sup",
  "iframe",
];

const ALLOWED_ATTR = [
  "href", "target", "rel", "src", "alt", "width", "height",
  "class", "style", "data-youtube-video",
  "colspan", "rowspan", "allow", "allowfullscreen", "frameborder",
];

export default function SafeHtml({ html, className = "" }: SafeHtmlProps) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });

  return (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

/** Strip all HTML tags — useful for inline text previews of rich content. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
