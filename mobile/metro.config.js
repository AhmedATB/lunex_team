// Learn more https://docs.expo.io/guides/customizing-metro
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The app reads the site's own logic (ranking, search, chapter names, types…) straight from ../src/lib instead of keeping copies,
// so the two never drift apart. Only that folder is watched; `@/lib/*` points at it (tsconfig.json paths).
config.watchFolders = [path.resolve(__dirname, "../src/lib")];

module.exports = config;
