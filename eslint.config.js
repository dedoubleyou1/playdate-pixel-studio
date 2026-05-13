import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "dist-electron",
      "release",
      "scripts/build-electron.mjs",
      "node_modules",
      "eslint.config.js",
      "companion/playdate-preview/build",
      "companion/playdate-preview/Source/pdex.*",
      "companion/playdate-preview/*.pdx",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "electron/*.ts",
            "electron/*.cts",
            "scripts/*.mjs",
            "companion/stream/server.ts",
            "companion/stream/server.test.ts",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
);
