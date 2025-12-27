import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import importX from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "test/*.ts",
            "test/alfred/*.ts",
            "test/cli/*.ts",
            "test/client/*.ts",
            "test/Client/*.ts",
            "test/Command/*.ts",
            "test/Helper/*.ts",
            "test/Service/*.ts",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      "import-x/resolver": {
        typescript: true,
      },
    },
  },
  {
    rules: {
      "no-console": "error",
      "sort-keys": ["error", "asc", { allowLineSeparatedGroups: true, caseSensitive: true, natural: true }],
    },
  },
  {
    ignores: ["dist/", "node_modules/"],
  },
);
