module.exports = {
  "extends": [
      "airbnb-base",
  ],
  "globals": {
    // https://stackoverflow.com/questions/30398825/eslint-window-is-not-defined-how-to-allow-global-variables-in-package-json
    document: true,
    window: true,
  }
};