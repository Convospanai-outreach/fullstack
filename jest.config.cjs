module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",

  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true }],
  },

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  extensionsToTreatAsEsm: [".ts"],
  moduleFileExtensions: ["js", "ts", "json"],

  transformIgnorePatterns: [
    "node_modules/(?!(uuid|@google)/)"
  ],

  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};
