import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

export default [
  // Base recommended rules
  js.configs.recommended,

  // Global ignores
  {
    ignores: [
      "build/**",
      "dist/**",
      "node_modules/**",
      "config/**",
      "scripts/**",
      "public/**",
      "electron/**",
      "*.config.js",
      // Unused API providers
      "src/api/API.Anthropic.js",
      "src/api/API.Gemini.js",
      "src/api/API.Groq.js",
      "src/api/API.ChatGPT.js",
    ],
  },

  // Main configuration for source files
  {
    files: ["src/**/*.js"],

    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        process: "readonly", // For environment checks
      },
    },

    settings: {
      react: {
        version: "detect",
      },
    },

    rules: {
      // React rules
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      "react/prop-types": "off", // Turn off if not using PropTypes
      "react/react-in-jsx-scope": "off", // Not needed in React 17+
      "react/jsx-key": "warn",
      "react/no-array-index-key": "off", // Allow array index as key
      "react/jsx-no-duplicate-props": "error",
      "react/jsx-no-undef": "error",
      "react/no-unescaped-entities": "warn",

      // React Hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Accessibility rules
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/anchor-is-valid": "warn",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-static-element-interactions": "off",

      // General JavaScript rules
      "no-console": "off", // Allow console for debugging
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none", // Don't warn on unused catch binding
        },
      ],
      "no-undef": "error",
      "no-redeclare": "error",
      "no-constant-condition": "warn",
      "no-case-declarations": "off", // Allow declarations in case blocks (common pattern)
      "no-fallthrough": "warn",
      "no-useless-escape": "warn",
      "no-prototype-builtins": "warn",

      // Code style - turn off rules that conflict with Prettier
      semi: "off",
      quotes: "off",
      "comma-dangle": "off", // Let Prettier handle trailing commas
      indent: "off",
      "object-curly-spacing": "off",
      "array-bracket-spacing": "off",
      "arrow-spacing": "off",
      "keyword-spacing": "off",
      "space-before-blocks": "off",
      "brace-style": "off",

      // Keep these non-Prettier rules
      eqeqeq: ["warn", "always", { null: "ignore" }],
      curly: "off", // Allow single-line if statements without braces
    },
  },
];
