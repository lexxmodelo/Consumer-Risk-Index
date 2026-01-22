import tsParser from "@typescript-eslint/parser";
import eslintPluginTs from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default [
  {
    ignores: ["dist/**", "node_modules/**"]
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module"
    },
    plugins: {
      "@typescript-eslint": eslintPluginTs,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin
    },
    settings: {
      react: { version: "detect" }
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
    }
  }
]
