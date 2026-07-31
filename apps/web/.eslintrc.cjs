module.exports = {
  root: true,
  extends: [require.resolve("@erp/config/eslint-preset.cjs")],
  env: { browser: true },
  parserOptions: { ecmaFeatures: { jsx: true } },
};
