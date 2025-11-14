// frontend/eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";

/**
 * ВАЖНО:
 *  - НЕТ импорта "typescript-eslint"
 *  - Используем:
 *      @typescript-eslint/parser
 *      @typescript-eslint/eslint-plugin
 *      eslint-plugin-react-hooks
 *      eslint-plugin-react-refresh
 *  - Работает с ESLint 8.57.1 (как в CI)
 */

export default defineConfig([
  // Глобальные игноры
  globalIgnores(["dist", "build", "node_modules"]),

  // Базовые JS-правила для всех файлов
  js.configs.recommended,

  // TS/TSX-файлы
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
        // если захочешь "type-aware" lint, можно добавить:
        // project: "./tsconfig.json",
      },
      globals: globals.browser,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // Рекомендованные TS-правила
      ...tsPlugin.configs.recommended.rules,

      // Хуки React
      ...reactHooks.configs["recommended-latest"].rules,

      // Vite React Refresh (если используешь)
      ...reactRefresh.configs.vite.rules,

      // здесь можно включать свои правила, если нужно
      // "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
]);
