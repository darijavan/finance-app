import fs from "node:fs";
import ts from "typescript";

const fix = process.argv[2] === "--fix";
const files = process.argv.slice(fix ? 3 : 2);
const errors = [];

for (const file of files) {
  let text = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const positions = [];
  const visit = (node) => {
    if (ts.isReturnStatement(node)) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
      const previous = text.split("\n")[line - 1];
      if (line > 0 && previous.trim()) positions.push(node.getStart(source));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  if (fix) {
    for (const position of positions.reverse()) {
      const lineStart = text.lastIndexOf("\n", position - 1) + 1;
      const indent = text.slice(lineStart, position).match(/^\s*/)?.[0] ?? "";
      text = `${text.slice(0, position)}\n\n${indent}${text.slice(position)}`;
    }
    fs.writeFileSync(file, text);
  } else {
    errors.push(...positions.map((position) => `${file}:${source.getLineAndCharacterOfPosition(position).line + 1}: expected an empty line before return`));
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
