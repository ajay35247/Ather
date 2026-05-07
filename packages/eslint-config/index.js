// @ather/eslint-config — shared ESLint config (scaffold)
// Consumers can extend this once rules are added.
module.exports = {
  root: false,
  env: { node: true, es2022: true },
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  rules: {},
};
