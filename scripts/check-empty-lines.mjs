import fs from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

function protectedRanges(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const ranges = [];
  const visit = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      ranges.push([ts.isJsxText(node) ? node.pos : node.getStart(source), node.getEnd()]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return ranges;
}

export function checkEmptyLines(file, text, fix = false) {
  const ranges = protectedRanges(file, text);
  const lines = text.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g).filter(Boolean);
  const output = [];
  const warnings = [];
  let offset = 0;
  let emptyLines = 0;

  for (const line of lines) {
    const content = line.replace(/(?:\r\n|\n|\r)$/, "");
    const protectedText = ranges.some(([start, end]) => offset < end && offset + content.length >= start);
    const empty = !protectedText && !content.trim();
    emptyLines = empty ? emptyLines + 1 : 0;

    if (emptyLines === 2) warnings.push(output.length + 1);
    if (!fix || emptyLines < 2) output.push(line);
    offset += line.length;
  }

  return { text: output.join(""), warnings };
}

function main() {
  const fix = process.argv[2] === "--fix";
  for (const file of process.argv.slice(fix ? 3 : 2)) {
    const text = fs.readFileSync(file, "utf8");
    const result = checkEmptyLines(file, text, fix);
    if (fix && result.text !== text) fs.writeFileSync(file, result.text);
    for (const line of result.warnings) console.warn(`${file}:${line}: warning: no more than one successive empty line`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main();
