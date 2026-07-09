import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  exitFromReport,
  fetchJsonHealth,
  findCommand,
  repoRoot,
  runCommand,
  skippedStep,
  writeReport,
} from "../lib/harness-utils.mjs";

const mode = process.argv[2] ?? "unit";
const backendRoot = resolve(repoRoot, "backend");

const pythonCandidates = [
  process.env.PYTHON ? { command: process.env.PYTHON, args: ["--version"] } : null,
  { command: "python", args: ["--version"] },
  { command: "python3", args: ["--version"] },
  { command: "py", args: ["-3", "--version"], prefixArgs: ["-3"] },
].filter(Boolean);

async function runUnit() {
  const python = await findCommand(pythonCandidates);
  if (!python) {
    return [
      skippedStep(
        "pytest backend",
        "Python was not found. Set PYTHON to a Python 3.12 executable and install backend/requirements-dev.txt.",
      ),
    ];
  }
  const env = {
    DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/audio_inmersivo_test",
    JWT_SECRET_KEY: process.env.JWT_SECRET_KEY ?? "test-only-secret",
    MINIO_ROOT_USER: process.env.MINIO_ROOT_USER ?? "test",
    MINIO_ROOT_PASSWORD: process.env.MINIO_ROOT_PASSWORD ?? "test-password",
  };
  const coverage = await runCommand({
    name: "pytest backend with coverage",
    command: python.command,
    args: [...(python.prefixArgs ?? []), "-m", "pytest", "tests", "-v", "--cov=app", "--cov-report=term-missing"],
    cwd: backendRoot,
    env,
  });
  if (!coverage.stderr.includes("unrecognized arguments: --cov")) {
    return [coverage];
  }
  const plain = await runCommand({
    name: "pytest backend without coverage",
    command: python.command,
    args: [...(python.prefixArgs ?? []), "-m", "pytest", "tests", "-v"],
    cwd: backendRoot,
    env,
  });
  return [
    skippedStep("coverage plugin", "pytest-cov is not installed in this Python environment; install backend/requirements-dev.txt."),
    plain,
  ];
}

async function runSmoke() {
  const apiBase = process.env.BACKEND_URL ?? process.env.API_URL;
  if (!apiBase) {
    return [skippedStep("backend API smoke", "Set BACKEND_URL or API_URL to run live API smoke checks.")];
  }
  const healthUrl = new URL("/api/v1/health", apiBase).toString();
  return [await fetchJsonHealth(healthUrl)];
}

async function runLoad() {
  const apiBase = process.env.BACKEND_URL ?? process.env.API_URL;
  if (!apiBase) {
    return [skippedStep("backend health load", "Set BACKEND_URL or API_URL to run health-load checks.")];
  }
  const healthUrl = new URL("/api/v1/health", apiBase).toString();
  const startedAt = Date.now();
  const responses = await Promise.all(Array.from({ length: 25 }, () => fetchJsonHealth(healthUrl)));
  const failed = responses.filter((step) => step.status === "fail").length;
  return [
    {
      name: "25 concurrent health requests",
      status: failed === 0 ? "pass" : "fail",
      durationMs: Date.now() - startedAt,
      stdout: `${responses.length - failed}/${responses.length} passed`,
      stderr: failed ? `${failed} requests failed` : "",
    },
  ];
}

async function runPipeline() {
  const steps = [];
  const python = await findCommand(pythonCandidates);
  const composePath = resolve(repoRoot, "docker-compose.yml");
  const composeText = existsSync(composePath) ? readFileSync(composePath, "utf8") : "";
  if (python) {
    steps.push(
      await runCommand({
        name: "musical analysis fixtures",
        command: python.command,
        args: [...(python.prefixArgs ?? []), "-m", "pytest", "tests/test_musical_analysis.py", "-v"],
        cwd: backendRoot,
      }),
    );
  } else {
    steps.push(skippedStep("musical analysis fixtures", "Python was not found."));
  }
  steps.push(
    skippedStep(
      "pipeline benchmark",
      "Heavy Demucs benchmark is intentionally manual: run docker compose with worker, enqueue a 4-minute track, then record RAM/time in stages.md.",
    ),
  );
  steps.push({
    name: "model cache volume declared",
    status:
      composeText.includes("model_cache:") && composeText.includes("/home/appuser/.cache") ? "pass" : "fail",
    durationMs: 0,
    stdout: "docker-compose.yml should declare model_cache for worker /home/appuser/.cache",
    stderr: "",
  });
  return steps;
}

const modeHandlers = {
  unit: runUnit,
  smoke: runSmoke,
  load: runLoad,
  pipeline: runPipeline,
};

if (!modeHandlers[mode]) {
  console.error(`Unknown backend harness mode: ${mode}`);
  process.exit(2);
}

const steps = await modeHandlers[mode]();
const report = writeReport("backend", mode, steps);
exitFromReport(report);
