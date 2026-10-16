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
  ["sdks/go/README.md", /github\.com\/1RB\/cheki\/sdks\/go@v(\d+\.\d+\.\d+)/],
];

describe("package and SDK versions", () => {
  it.each(sources)("%s matches package.json", (file, pattern) => {
    expect(read(file).match(pattern)?.[1]).toBe(version);
  });

  it.each(["CHANGELOG.md", "sdks/dart/CHANGELOG.md"])("%s has an entry for this version", (file) => {
    expect(read(file)).toMatch(new RegExp(`^## ${version.replace(/\./g, "\\.")}$`, "m"));
  });

  it("scripts/bump-version.sh rewrites every file this test checks", () => {
    const script = read("scripts/bump-version.sh");
    for (const [file] of sources) expect(script, file).toContain(file);
  });

  it("sdks/php/composer.json has no version (Packagist reads the tag)", () => {
    expect(JSON.parse(read("sdks/php/composer.json")).version).toBeUndefined();
  });

  // Packagist publishes the ROOT composer.json; sdks/php/composer.json is the
  // one PHP developers work with. Everything but the paths must agree.
  it("root composer.json matches sdks/php/composer.json (Packagist reads the root one)", () => {
    const root = JSON.parse(read("composer.json"));
    const sdk = JSON.parse(read("sdks/php/composer.json"));
    const pathKeys = new Set(["autoload", "autoload-dev", "require-dev", "scripts"]);
    const strip = (c: Record<string, unknown>) => Object.fromEntries(Object.entries(c).filter(([k]) => !pathKeys.has(k)));
    expect(strip(root)).toEqual(strip(sdk));
    expect(root.version).toBeUndefined();
    expect(root.autoload).toEqual({ "psr-4": { "Cheki\\": "sdks/php/src/" } });
    expect(sdk.autoload).toEqual({ "psr-4": { "Cheki\\": "src/" } });
  });
});
