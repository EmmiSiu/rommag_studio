import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const reportDir = resolve(repoRoot, "testing", "reports");

export function commandName(base) {
  return process.platform === "win32" ? `${base}.cmd` : base;
}

export function runCommand({ name, command, args = [], cwd = repoRoot, env = {} }) {
  const startedAt = Date.now();
  return new Promise((resolveStep) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd,
        env: { ...process.env, ...env },
        shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(command),
        windowsHide: true,
      });
    } catch (error) {
      resolveStep({
        name,
        status: "fail",
        durationMs: Date.now() - startedAt,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolveStep({
        name,
        status: "fail",
        durationMs: Date.now() - startedAt,
        stdout,
        stderr: `${stderr}${error.message}`,
      });
    });
    child.on("close", (code) => {
      resolveStep({
        name,
        status: code === 0 ? "pass" : "fail",
        durationMs: Date.now() - startedAt,
        exitCode: code,
        stdout,
        stderr,
      });
    });
  });
}

export async function findCommand(candidates) {
  for (const candidate of candidates) {
    const result = await runCommand({
      name: `detect ${candidate.command}`,
      command: candidate.command,
      args: candidate.args ?? ["--version"],
    });
    if (result.status === "pass") return candidate;
  }
  return null;
}

export async function fetchJsonHealth(url) {
  const startedAt = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const text = await response.text();
    return {
      name: `GET ${url}`,
      status: response.ok ? "pass" : "fail",
      durationMs: Date.now() - startedAt,
      httpStatus: response.status,
      stdout: text.slice(0, 1000),
      stderr: "",
    };
  } catch (error) {
    return {
      name: `GET ${url}`,
      status: "fail",
      durationMs: Date.now() - startedAt,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
}

export function skippedStep(name, reason) {
  return { name, status: "skip", durationMs: 0, stdout: reason, stderr: "" };
}

export function writeReport(kind, mode, steps) {
  mkdirSync(reportDir, { recursive: true });
  const report = {
    kind,
    mode,
    generatedAt: new Date().toISOString(),
    status: steps.some((step) => step.status === "fail") ? "fail" : "pass",
    steps,
  };
  const baseName = `${kind}-${mode}`;
  writeFileSync(resolve(reportDir, `${baseName}.json`), JSON.stringify(report, null, 2));
  writeFileSync(resolve(reportDir, `${baseName}.md`), toMarkdown(report));
  return report;
}

function toMarkdown(report) {
  const lines = [
    `# ${report.kind} harness: ${report.mode}`,
    "",
    `- Generated: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    "",
    "| Step | Status | Duration |",
    "|---|---:|---:|",
  ];
  for (const step of report.steps) {
    lines.push(`| ${step.name} | ${step.status} | ${step.durationMs} ms |`);
  }
  return `${lines.join("\n")}\n`;
}

export function exitFromReport(report) {
  if (report.status === "fail") process.exitCode = 1;
}
