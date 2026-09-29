// Fails when a .tsx file shows English to the user without t(): JSX text, user-facing string attributes,
// and toast("...") calls. Uses the TypeScript parser, so code like generics is never mistaken for text.
// Allow a line on purpose with a trailing comment: // i18n-ignore
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = new URL("../src/", import.meta.url).pathname;
const SKIP = [/\/components\/ui\//];
const ATTRS = new Set(["title", "placeholder", "aria-label", "alt", "label", "description"]);
const ALLOW = new Set(["Parhelion", "EN", "FAL_KEY", "Claude Code", "CapCut", "fal", "OK"]);
const hasWords = (s) => /[A-Za-z]{2,}/.test(s) && !ALLOW.has(s.trim());

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

const problems = [];
for (const file of files(ROOT)) {
  if (SKIP.some((r) => r.test(file))) continue;
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const report = (node, what) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
    if (/i18n-ignore/.test(lines[line])) return;
    problems.push(`${relative(ROOT, file)}:${line + 1}  ${what}`);
  };
  const visit = (node) => {
    if (ts.isJsxText(node) && hasWords(node.text.trim())) report(node, `text "${node.text.trim().slice(0, 60)}"`);
    if (ts.isJsxAttribute(node) && ATTRS.has(node.name.getText()) && node.initializer) {
      const init = node.initializer;
      const lit = ts.isStringLiteral(init) ? init : ts.isJsxExpression(init) && init.expression && ts.isStringLiteral(init.expression) ? init.expression : null;
      if (lit && hasWords(lit.text)) report(node, `${node.name.getText()}="${lit.text.slice(0, 60)}"`);
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText();
      if (/^toast(\.(success|error|info|warning|message))?$/.test(callee)) {
        const a = node.arguments[0];
        if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a) || ts.isTemplateExpression(a)) && hasWords(a.getText())) report(node, `${callee}(${a.getText().slice(0, 60)})`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

if (problems.length) {
  console.error(`i18n: ${problems.length} untranslated string(s):\n` + problems.join("\n"));
  process.exit(1);
}
console.log("i18n: no untranslated strings");
