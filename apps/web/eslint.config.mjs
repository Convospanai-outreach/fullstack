import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const relaxedProjectRules = {
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-empty-object-type": "off",
    "@typescript-eslint/no-require-imports": "off",

    "react-hooks/exhaustive-deps": "off",
    "react-hooks/immutability": "off",
    "react-hooks/preserve-manual-memoization": "off",
    "react-hooks/purity": "off",
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/static-components": "off",
    "react-hooks/use-memo": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",

    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",
    "@next/next/no-assign-module-variable": "off",

    "prefer-const": "off",
    "no-unused-vars": "off",
    "no-console": "off",
    "no-debugger": "off",
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",
  },
};

export default [
  ...nextCoreWebVitals,
  ...nextTypescript,
  relaxedProjectRules,
];
