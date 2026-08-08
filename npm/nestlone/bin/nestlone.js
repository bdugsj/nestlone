#!/usr/bin/env node

const { runNestlone } = require("../scripts/run");

runNestlone().catch((error) => {
  console.error("Failed to start nestlone:", error.message);
  process.exit(1);
});
