// frontend/eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

/**
 * Конфиг ESLint для ESLint 8.57.1 (flat config).
 * Без import из "eslint/config" и без пакета "typescript-eslint".
 * Используем только уже установленные пакеты.
 */

// Аккуратно достаём recommended-конфиги, чтобы не падать
const tsRecommended = (tsPlugin.configs && tsPlugin.configs.recommended) || {};
const tsRules = tsRecommended.rules || {};

const reactHooksRecommendedLatest =
  (reactHooks.configs &&
    (reactHooks.configs["recommended-latest"] ||
      reactHooks.configs.recommended)) ||
  {};
const reactHooksRules = reactHooksRecommendedLatest.rules || {};

const reactRefreshVite =
  (reactRefresh.configs && reactRefresh.configs.vite) || {};
const reactRefreshRules = reactRefreshVite.rules || {};

export default [
  // Глобальные игноры
  {
    ignores: ["dist/**", "build/**", "node_modules/**"],
  },

  // Базовые JS-настройки
  js.configs.recommended,

  // TS/TSX файлы
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
        // при желании можно включить type-aware lint:
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
      // TS
      ...tsRules,

      // React Hooks (берём либо recommended-latest, либо обычный recommended)
      ...reactHooksRules,

      // React Refresh (vite-конфиг, если есть)
      ...reactRefreshRules,

      // При желании можно добавить свои правила:
      // "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // "react-refresh/only-export-components": "off",
    },
  },
];
