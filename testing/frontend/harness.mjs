import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import {
  commandName,
  exitFromReport,
  repoRoot,
  runCommand,
  skippedStep,
  writeReport,
} from "../lib/harness-utils.mjs";

const mode = process.argv[2] ?? "smoke";
const frontendRoot = resolve(repoRoot, "frontend");
const frontendRequire = createRequire(resolve(frontendRoot, "package.json"));

async function runSmoke() {
  const npm = commandName("npm");
  const steps = [
    await runCommand({ name: "frontend lint", command: npm, args: ["run", "lint"], cwd: frontendRoot }),
    await runCommand({ name: "frontend typecheck", command: npm, args: ["run", "typecheck"], cwd: frontendRoot }),
  ];
  if (process.env.FRONTEND_URL) {
    steps.push(await runBrowserSmoke(process.env.FRONTEND_URL));
  } else {
    steps.push(skippedStep("browser smoke", "Set FRONTEND_URL to verify console, images, navigation and 375px viewport."));
  }
  steps.push(await runCommand({ name: "frontend production build", command: npm, args: ["run", "build"], cwd: frontendRoot }));
  return steps;
}

async function runBrowserSmoke(frontendUrl) {
  const startedAt = Date.now();
  try {
    const { chromium } = frontendRequire("playwright");
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.goto(frontendUrl, { waitUntil: "networkidle" });
    const imageFailures = await page.evaluate(() =>
      Array.from(document.images)
        .filter((image) => image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.src),
    );
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    await page.getByRole("link", { name: /crear cuenta/i }).first().isVisible();
    await page.getByRole("link", { name: /biblioteca/i }).first().isVisible();
    await browser.close();
    const failures = [...consoleErrors, ...imageFailures, hasOverflow ? "Horizontal overflow at 375px" : ""].filter(Boolean);
    return {
      name: "browser smoke at 375px",
      status: failures.length === 0 ? "pass" : "fail",
      durationMs: Date.now() - startedAt,
      stdout: failures.length === 0 ? "No console errors, broken images or mobile overflow detected." : "",
      stderr: failures.join("\n"),
    };
  } catch (error) {
    return {
      name: "browser smoke at 375px",
      status: "fail",
      durationMs: Date.now() - startedAt,
      stdout: "",
      stderr:
        error instanceof Error
          ? `${error.message}\nInstall browsers with: npx playwright install chromium`
          : String(error),
    };
  }
}

async function runPerf() {
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    return [skippedStep("Lighthouse performance", "Set FRONTEND_URL to run Lighthouse thresholds.")];
  }
  const npx = commandName("npx");
  const outputPath = resolve(repoRoot, "testing", "reports", "lighthouse-frontend.json");
  const lighthouse = await runCommand({
    name: "Lighthouse PWA/performance",
    command: npx,
    args: [
      "lighthouse",
      frontendUrl,
      "--quiet",
      "--output=json",
      `--output-path=${outputPath}`,
      "--chrome-flags=--headless=new --no-sandbox",
    ],
    cwd: frontendRoot,
  });
  if (lighthouse.status !== "pass") return [lighthouse];
  try {
    const report = JSON.parse(readFileSync(outputPath, "utf8"));
    const thresholds = {
      performance: 0.8,
      accessibility: 0.9,
      "best-practices": 0.9,
      pwa: 0.9,
    };
    const failures = Object.entries(thresholds)
      .filter(([category]) => report.categories?.[category])
      .filter(([category, threshold]) => report.categories[category].score < threshold)
      .map(([category, threshold]) => {
        const score = Math.round(report.categories[category].score * 100);
        return `${category} ${score} < ${Math.round(threshold * 100)}`;
      });
    return [
      lighthouse,
      {
        name: "Lighthouse thresholds",
        status: failures.length === 0 ? "pass" : "fail",
        durationMs: 0,
        stdout: failures.length === 0 ? "Performance >= 80, accessibility/best-practices/PWA >= 90." : "",
        stderr: failures.join("\n"),
      },
    ];
  } catch (error) {
    return [
      lighthouse,
      {
        name: "Lighthouse thresholds",
        status: "fail",
        durationMs: 0,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
      },
    ];
  }
}

const modeHandlers = {
  smoke: runSmoke,
  perf: runPerf,
};

if (!modeHandlers[mode]) {
  console.error(`Unknown frontend harness mode: ${mode}`);
  process.exit(2);
}

const steps = await modeHandlers[mode]();
const report = writeReport("frontend", mode, steps);
exitFromReport(report);
