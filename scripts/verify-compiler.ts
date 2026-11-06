import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const candidate = process.argv[2];
if (!candidate) throw new Error("Pass the compiler candidate checkout path.");
const files = execFileSync("git", ["ls-files", "-z", "--", "src", "package.json"], {
  cwd: candidate, encoding: "utf8",
}).split("\0").filter(Boolean);
assert(files.includes("src/core/cpu-codegen.ts") && files.includes("src/compiler/ts/source-file.ts"), "Incomplete candidate checkout");
for (const file of files)
  assert.deepEqual(readFileSync(resolve("node_modules/typeshade", file)), readFileSync(resolve(candidate, file)), `Compiler candidate mismatch: ${file}`);
console.log(`Verified ${files.length} installed compiler files against the candidate checkout.`);
