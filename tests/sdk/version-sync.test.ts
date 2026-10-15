import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// scripts/bump-version.sh rewrites every one of these; this keeps a hand edit
// (or a pattern the script no longer matches) from shipping mixed versions.
const root = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const version = JSON.parse(read("package.json")).version as string;

const sources: Array<[file: string, pattern: RegExp]> = [
  ["package-lock.json", /^ {2}"version": "([^"]+)"/m],
  ["sdks/typescript/package.json", /^ {2}"version": "([^"]+)"/m],
  ["sdks/typescript/src/index.ts", /^const VERSION = "([^"]+)";/m],
  ["sdks/typescript/index.js", /^const VERSION = "([^"]+)";/m],
  ["python/pyproject.toml", /^version = "([^"]+)"/m],
  ["python/cheki/_version.py", /^__version__ = "([^"]+)"/m],
  ["sdks/php/src/VerifyOptions.php", /public const VERSION = '([^']+)';/],
  ["sdks/dart/pubspec.yaml", /^version: (\S+)/m],
  ["sdks/dart/lib/src/cheki_client.dart", /^const String chekiSdkVersion = '([^']+)';/m],
  ["sdks/go/cheki.go", /^const Version = "([^"]+)"/m],
];

describe("package and SDK versions", () => {
  it.each(sources)("%s matches package.json", (file, pattern) => {
    expect(read(file).match(pattern)?.[1]).toBe(version);
  });

  it("the Dart changelog has an entry for this version (pub.dev shows it)", () => {
    expect(read("sdks/dart/CHANGELOG.md")).toMatch(new RegExp(`^## ${version.replace(/\./g, "\\.")}$`, "m"));
  });

  it("sdks/php/composer.json has no version (Packagist reads the tag)", () => {
    expect(JSON.parse(read("sdks/php/composer.json")).version).toBeUndefined();
  });
});
