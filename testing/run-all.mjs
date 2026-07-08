import { exitFromReport, repoRoot, runCommand, writeReport } from "./lib/harness-utils.mjs";

const steps = [
  await runCommand({
    name: "backend harness unit",
    command: process.execPath,
    args: ["testing/backend/harness.mjs", "unit"],
    cwd: repoRoot,
  }),
  await runCommand({
    name: "backend harness smoke",
    command: process.execPath,
    args: ["testing/backend/harness.mjs", "smoke"],
    cwd: repoRoot,
  }),
  await runCommand({
    name: "frontend harness smoke",
    command: process.execPath,
    args: ["testing/frontend/harness.mjs", "smoke"],
    cwd: repoRoot,
  }),
];

const report = writeReport("all", "harness", steps);
exitFromReport(report);
