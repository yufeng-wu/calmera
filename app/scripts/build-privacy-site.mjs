// Writes the public Privacy Policy pages from lib/privacyPolicy.mjs, the same text the app
// shows, so the website and the app can't drift apart.
//   node scripts/build-privacy-site.mjs [outDir]   (default: site)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { HEALTH_DATA_POLICY, PRIVACY_EFFECTIVE_DATE, PRIVACY_POLICY, placeholdersRemaining } from "../src/lib/privacy/privacyPolicy.mjs";

const PAGES = { [PRIVACY_POLICY.id]: "privacy/index.html", [HEALTH_DATA_POLICY.id]: "privacy/health-data/index.html" };

export const escapeHTML = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);

// Links between pages are relative, so the site works under any host or folder.
function href(from, toId) {
  return path.posix.relative(path.posix.dirname(PAGES[from]), PAGES[toId]).replace(/index\.html$/, "") || "./";
}

function block(b, docId) {
  if (b.type === "p") return `<p>${escapeHTML(b.text)}</p>`;
  if (b.type === "list") return `<ul>${b.items.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`;
  if (b.type === "terms") return `<dl>${b.items.map(({ term, text }) => `<dt>${escapeHTML(term)}</dt><dd>${escapeHTML(text)}</dd>`).join("")}</dl>`;
  if (b.type === "link") return `<p><a href="${escapeHTML(b.url)}">${escapeHTML(b.text)}</a></p>`;
  if (b.type === "doc") return `<p><a href="${escapeHTML(href(docId, b.id))}">${escapeHTML(b.id === HEALTH_DATA_POLICY.id ? HEALTH_DATA_POLICY.title : PRIVACY_POLICY.title)}</a></p>`;
  return "";
}

export function renderPolicyPage(doc) {
  const sibling = doc.id === PRIVACY_POLICY.id ? HEALTH_DATA_POLICY : PRIVACY_POLICY;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHTML(doc.title)} · calmera</title>
<style>
  :root { color-scheme: light dark; --bg: #FFFBF9; --ink: #2B211C; --soft: #6F625A; --accent: #BC5A19; --rule: #EDE3DA; }
  @media (prefers-color-scheme: dark) { :root { --bg: #1C1714; --ink: #F5EEE9; --soft: #B9AAA0; --accent: #F2A066; --rule: #3A302A; } }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 680px; margin: 0 auto; padding: 40px 16px 64px; }
  .brand { font-weight: 700; color: var(--accent); letter-spacing: -0.02em; margin: 0 0 24px; }
  h1 { font-size: 28px; line-height: 1.25; margin: 0 0 4px; }
  h2 { font-size: 19px; margin: 32px 0 8px; }
  .effective { color: var(--soft); margin: 0 0 24px; }
  ul { padding-left: 20px; } li { margin: 4px 0; }
  dt { font-weight: 600; margin-top: 10px; } dd { margin: 0; }
  a { color: var(--accent); }
  footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--rule); color: var(--soft); font-size: 14px; }
</style>
</head>
<body>
<main>
<p class="brand">calmera.</p>
<h1>${escapeHTML(doc.title)}</h1>
<p class="effective">Effective ${escapeHTML(PRIVACY_EFFECTIVE_DATE)}</p>
${doc.intro.map((b) => block(b, doc.id)).join("\n")}
${doc.sections.map((s) => `<section id="${escapeHTML(s.id)}">\n<h2>${escapeHTML(s.heading)}</h2>\n${s.blocks.map((b) => block(b, doc.id)).join("\n")}\n</section>`).join("\n")}
<footer><a href="${escapeHTML(href(doc.id, sibling.id))}">${escapeHTML(sibling.title)}</a></footer>
</main>
</body>
</html>
`;
}

async function main() {
  const outDir = path.resolve(process.argv[2] || "site");
  const missing = placeholdersRemaining();
  if (missing.length) console.warn(`Warning: placeholders still in the policy: ${missing.join(", ")}`);
  for (const doc of [PRIVACY_POLICY, HEALTH_DATA_POLICY]) {
    const file = path.join(outDir, PAGES[doc.id]);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, renderPolicyPage(doc));
    console.log(`Wrote ${path.relative(process.cwd(), file)}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
