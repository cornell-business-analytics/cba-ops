import type { ReactNode } from "react";

// Matches http(s):// URLs and bare www. hostnames. The trailing character class
// deliberately excludes common sentence punctuation so "see https://cba.org."
// does not swallow the full stop into the href.
const URL_PATTERN =
  /\b(?:https?:\/\/|www\.)[^\s<]*[^\s<.,:;"')\]}!?]/gi;

/**
 * Turns URLs inside a plain-text string into anchor elements.
 *
 * Members paste signup links straight into an event description, where they
 * previously rendered as dead text. This returns React nodes rather than an
 * HTML string, so the surrounding text is still escaped by React and there is
 * no `dangerouslySetInnerHTML` in the path. Only http/https and bare `www.`
 * matches are ever linked, so a `javascript:` payload in a description stays
 * inert text.
 */
export function linkify(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const matched = match[0];
    const start = match.index;

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    const href = matched.toLowerCase().startsWith("www.") ? `https://${matched}` : matched;
    nodes.push(
      <a
        key={`${start}-${matched}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-cba-green underline underline-offset-2 hover:text-cba-dark break-words"
      >
        {matched}
      </a>,
    );

    lastIndex = start + matched.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
