// Minimal markdown → HTML converter — deliberately hand-rolled instead
// of adding a markdown library dependency (react-markdown, marked,
// etc.), given how fragile this project's build has been to new
// packages. Escapes HTML first (so a post body can never inject
// arbitrary markup), then applies a small set of common patterns:
// headers, bold, italic, links, paragraphs, and simple lists. Not a
// full CommonMark implementation — enough for blog posts written by
// one person, not arbitrary untrusted input.

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function markdownToHtml(md: string): string {
  const escaped = escapeHtml(md);
  const lines = escaped.split("\n");
  const htmlLines: string[] = [];
  let inList = false;

  for (const line of lines) {
    let l = line;

    if (/^### (.+)/.test(l)) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      htmlLines.push(`<h3>${l.replace(/^### /, "")}</h3>`);
      continue;
    }
    if (/^## (.+)/.test(l)) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      htmlLines.push(`<h2>${l.replace(/^## /, "")}</h2>`);
      continue;
    }
    if (/^# (.+)/.test(l)) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      htmlLines.push(`<h1>${l.replace(/^# /, "")}</h1>`);
      continue;
    }
    if (/^[-*] (.+)/.test(l)) {
      if (!inList) { htmlLines.push("<ul>"); inList = true; }
      htmlLines.push(`<li>${applyInline(l.replace(/^[-*] /, ""))}</li>`);
      continue;
    }
    if (inList) { htmlLines.push("</ul>"); inList = false; }

    if (l.trim() === "") {
      htmlLines.push("");
    } else {
      htmlLines.push(`<p>${applyInline(l)}</p>`);
    }
  }
  if (inList) htmlLines.push("</ul>");

  return htmlLines.join("\n");
}

function applyInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}
