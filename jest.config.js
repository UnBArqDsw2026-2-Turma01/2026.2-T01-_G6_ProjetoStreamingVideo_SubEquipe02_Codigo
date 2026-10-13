module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  transform: { "^.+\\.ts$": "@swc/jest" },
  collectCoverageFrom: ["src/**/*.ts", "!src/demo/**"],
  coverageDirectory: "coverage"
};
