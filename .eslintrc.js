module.exports = {
  "extends": [
      "airbnb-base",
  ],
  "globals": {
    // https://stackoverflow.com/questions/30398825/eslint-window-is-not-defined-how-to-allow-global-variables-in-package-json
    document: true,
    window: true,
  },
  "rules": {
    "no-unused-expressions": [
      "error", { "allowTernary": true }
    ],
    // Disable the capitalization of classes due to Leaflet's factory functions convention
    "new-cap": "off",
    // Disable unnamed functions due to Leaflet's factory functions convention
    "func-names": "off",
  }
};