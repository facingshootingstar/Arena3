import { execFileSync } from "node:child_process";

// Allowed occurrences: SVG icon definitions in arena-icons.tsx and test fixtures in *.test.ts
const ALLOWED_FILES = [
  "src/components/arena-icons.tsx",
  "src/lib/arena3/arena3.test.ts",
  "src/lib/arena3/tx.test.ts",
];

try {
  const out = execFileSync(
    "git",
    ["grep", "-nE", "'(badminton|basketball|volleyball)'|\"(badminton|basketball|volleyball)\"", "src"],
    { encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "NUL", GIT_CONFIG_SYSTEM: "NUL" } }
  );

  const lines = out.split("\n").filter((l) => l.trim().length > 0);
  const violations = [];

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    const filePath = colonIdx !== -1 ? line.slice(0, colonIdx) : "";
    if (!ALLOWED_FILES.some((allowed) => filePath.startsWith(allowed))) {
      violations.push(line);
    }
  }

  if (violations.length > 0) {
    console.error(`FAIL: Found ${violations.length} forbidden hardcoded sport string(s) in business code:`);
    for (const v of violations) console.error("  " + v);
    process.exit(1);
  }

  console.log(`SUCCESS: 0 forbidden hardcoded sport strings in business code (${lines.length} allowed in icons/tests).`);
  process.exit(0);
} catch (e) {
  if (e.status === 1) {
    console.log("SUCCESS: 0 matches found for hardcoded sport strings.");
    process.exit(0);
  }
  console.error("grep-sports execution error:", e.message);
  process.exit(1);
}
