import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "public/**", "app.js"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Application code runs in the browser (fetch, localStorage, DOM APIs).
    files: ["js/**/*.{js,ts}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser }
    }
  },
  {
    // Build/tooling config files run under Node, not the browser.
    files: ["*.config.{js,ts}", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node }
    }
  },
  // Must be last: turns off ESLint stylistic rules that would otherwise
  // fight with Prettier over formatting.
  eslintConfigPrettier
);
