import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated TypeScript SDK build output (built from sdks/typescript/src).
    "sdks/typescript/index.js",
    "sdks/typescript/index.mjs",
    "sdks/typescript/index.d.ts",
    // Non-JS SDK toolchain caches.
    "sdks/dart/.dart_tool/**",
    "sdks/php/vendor/**",
    "python/**",
  ]),
  {
    rules: {
      // `_`-prefixed names are intentionally unused.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Pre-existing frontend debt (about 50 findings when CI lint was made
    // blocking). These are warnings so `npm run lint` can gate CI on every
    // other rule today; promote each back to "error" once its findings are fixed.
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx", "src/lib/i18n/**/*.tsx"],
    rules: {
      "@next/next/no-html-link-for-pages": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react/no-unescaped-entities": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    // Plain Node scripts.
    files: ["scripts/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);

export default eslintConfig;
