#!/usr/bin/env node

const { runNestloneTui } = require("../scripts/run");

runNestloneTui().catch((error) => {
  console.error("Failed to start nestlone-tui:", error.message);
  process.exit(1);
});
