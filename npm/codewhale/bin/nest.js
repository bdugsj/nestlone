#!/usr/bin/env node

const { run } = require("../scripts/run");

run("nest").catch((error) => {
  console.error("Failed to start nest:", error.message);
  process.exit(1);
});
