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
const TEST_PASSWORD = "Stage8Test123!";

async function runSmoke() {
  const npm = commandName("npm");
  const steps = [
    await runCommand({ name: "frontend lint", command: npm, args: ["run", "lint"], cwd: frontendRoot }),
    await runCommand({ name: "frontend typecheck", command: npm, args: ["run", "typecheck"], cwd: frontendRoot }),
    await runCommand({ name: "frontend unit tests", command: npm, args: ["run", "test:unit"], cwd: frontendRoot }),
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

async function registerTestUser(apiBase, email, displayName) {
  const response = await fetch(new URL("/api/v1/auth/register", apiBase), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: TEST_PASSWORD, display_name: displayName }),
  });
  if (response.status === 409) return;
  if (!response.ok) {
    throw new Error(`register ${email} failed: ${response.status} ${await response.text()}`);
  }
}

async function runCollaboration() {
  const frontendUrl = process.env.FRONTEND_URL;
  const apiBase = process.env.BACKEND_URL ?? process.env.API_URL;
  if (!frontendUrl || !apiBase) {
    return [
      skippedStep(
        "playlist collaboration live flow",
        "Set FRONTEND_URL and BACKEND_URL or API_URL to run create -> invite -> edit -> revoke.",
      ),
    ];
  }

  const startedAt = Date.now();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const ownerEmail = `stage8-owner-${stamp}@example.test`;
  const collaboratorEmail = `stage8-collab-${stamp}@example.test`;
  const title = `Stage 8 collaboration ${stamp}`;
  let browser;

  try {
    await registerTestUser(apiBase, ownerEmail, "Stage 8 Owner");
    await registerTestUser(apiBase, collaboratorEmail, "Stage 8 Editor");

    const { chromium } = frontendRequire("playwright");
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto(new URL("/login", frontendUrl).toString(), { waitUntil: "networkidle" });
    await page.getByLabel(/^Email$/i).fill(ownerEmail);
    await page.getByLabel(/^Contraseña$/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /^Entrar$/i }).click();
    await page.waitForURL(/\/studio\/library/, { timeout: 15000 });

    await page.goto(new URL("/studio/playlists", frontendUrl).toString(), { waitUntil: "networkidle" });
    await page.getByLabel(/^Título$/i).fill(title);
    await page.getByLabel(/^Descripción$/i).fill("Harness collaboration smoke");
    await page.getByRole("button", { name: /^Crear playlist$/i }).click();
    await page.getByRole("link", { name: new RegExp(title) }).click();

    await page.getByLabel(/^Email$/i).fill(collaboratorEmail);
    await page.locator("select").last().selectOption("EDITOR");
    await page.getByRole("button", { name: /^Invitar$/i }).click();
    await page.getByText(collaboratorEmail).waitFor({ timeout: 15000 });

    await page.getByRole("button", { name: /^Hacer viewer$/i }).click();
    await page.getByText(/^VIEWER$/).waitFor({ timeout: 15000 });

    await page.getByRole("button", { name: /^Revocar$/i }).click();
    await page.getByText(collaboratorEmail).waitFor({ state: "detached", timeout: 15000 });

    await browser.close();
    browser = null;
    const failures = consoleErrors.filter(Boolean);
    return [
      {
        name: "playlist collaboration live flow",
        status: failures.length === 0 ? "pass" : "fail",
        durationMs: Date.now() - startedAt,
        stdout: failures.length === 0 ? "Created playlist, invited collaborator, changed role and revoked access." : "",
        stderr: failures.join("\n"),
      },
    ];
  } catch (error) {
    return [
      {
        name: "playlist collaboration live flow",
        status: "fail",
        durationMs: Date.now() - startedAt,
        stdout: "",
        stderr:
          error instanceof Error
            ? `${error.message}\nRequires a live dev stack and Playwright Chromium.`
            : String(error),
      },
    ];
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

function wavBuffer({ frequency = 440, seconds = 0.75, sampleRate = 44100 } = {}) {
  const samples = Math.floor(seconds * sampleRate);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);

  for (let index = 0; index < samples; index += 1) {
    const sample = Math.sin((index / sampleRate) * frequency * Math.PI * 2) * 0.18;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }
  return buffer;
}

async function runStage9() {
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    return [
      skippedStep(
        "Stage 9 interactive player",
        "Set FRONTEND_URL to verify mocked stems, WebAudio, nonblank Three.js canvas and 375px layout.",
      ),
    ];
  }

  const startedAt = Date.now();
  let browser;
  let page;
  const requestFailures = [];
  try {
    const { chromium } = frontendRequire("playwright");
    browser = await chromium.launch();
    const appUrl = new URL(frontendUrl);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([
      {
        name: "ai_session",
        value: "1",
        domain: appUrl.hostname,
        path: "/",
        sameSite: "Lax",
      },
    ]);
    await context.addInitScript(() => {
      localStorage.setItem("ai_refresh_token", "stage9-refresh");
    });

    page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`.trim());
    });

    const corsHeaders = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    };
    const stemDataUrl = (frequency) => `data:audio/wav;base64,${wavBuffer({ frequency }).toString("base64")}`;
    const stems = {
      vocals: stemDataUrl(440),
      drums: stemDataUrl(220),
      bass: stemDataUrl(110),
      other: stemDataUrl(330),
    };

    await context.route("**/api/v1/**", async (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      const url = new URL(request.url());
      const path = url.pathname;
      const jsonHeaders = { ...corsHeaders, "content-type": "application/json" };

      if (path.endsWith("/auth/refresh")) {
        await route.fulfill({
          status: 200,
          headers: jsonHeaders,
          body: JSON.stringify({
            access_token: "stage9-access",
            refresh_token: "stage9-refresh-next",
            token_type: "bearer",
          }),
        });
        return;
      }

      if (path.endsWith("/auth/me")) {
        await route.fulfill({
          status: 200,
          headers: jsonHeaders,
          body: JSON.stringify({
            id: "stage9-user",
            email: "stage9@example.test",
            display_name: "Stage 9",
            role: "USER",
            is_active: true,
            created_at: "2026-07-09T00:00:00Z",
          }),
        });
        return;
      }

      if (path.endsWith("/audios/stage9-audio/stems")) {
        await route.fulfill({
          status: 200,
          headers: jsonHeaders,
          body: JSON.stringify({ stems, expires_in_seconds: 3600 }),
        });
        return;
      }

      if (path.endsWith("/audios/stage9-audio")) {
        await route.fulfill({
          status: 200,
          headers: jsonHeaders,
          body: JSON.stringify({
            id: "stage9-audio",
            title: "Stage 9 mock audio",
            owner_id: "stage9-user",
            source_type: "UPLOAD",
            status: "COMPLETED",
            visibility: "PRIVATE",
            is_approved: false,
            duration_seconds: 1,
            format: "wav",
            error_message: null,
            has_stems: true,
            has_ambisonics: true,
            created_at: "2026-07-09T00:00:00Z",
          }),
        });
        return;
      }

      await route.fulfill({ status: 404, headers: jsonHeaders, body: JSON.stringify({ detail: "mock not found" }) });
    });

    await context.route("**/*.wav", async (route) => {
      const url = new URL(route.request().url());
      const frequency = url.pathname.includes("bass")
        ? 110
        : url.pathname.includes("drums")
          ? 220
          : url.pathname.includes("other")
            ? 330
            : 440;
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, "content-type": "audio/wav" },
        body: wavBuffer({ frequency }),
      });
    });

    await page.goto(new URL("/studio/audio/stage9-audio", frontendUrl).toString(), { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /cargar stems 3d/i }).click();
    await page.locator('[data-stage9-player][data-stage9-ready="true"]').waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: /^Reproducir$/i }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /^Pausar$/i }).click();

    const canvasOk = await page.locator("[data-stage9-canvas] canvas").evaluate((canvas) => {
      try {
        return (canvas instanceof HTMLCanvasElement && canvas.toDataURL("image/png").length > 2000);
      } catch {
        return false;
      }
    });
    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(250);
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    const mobileCanvasFits = await page.locator("[data-stage9-canvas]").evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width <= window.innerWidth && rect.height >= 240;
    });

    await browser.close();
    browser = null;

    const failures = [
      ...consoleErrors,
      ...requestFailures,
      canvasOk ? "" : "Three.js canvas was blank or unreadable.",
      desktopOverflow ? "Horizontal overflow on desktop Stage 9 page." : "",
      mobileOverflow ? "Horizontal overflow at 375px Stage 9 page." : "",
      mobileCanvasFits ? "" : "Stage 9 canvas does not fit the 375px viewport.",
    ].filter(Boolean);

    return [
      {
        name: "Stage 9 interactive player",
        status: failures.length === 0 ? "pass" : "fail",
        durationMs: Date.now() - startedAt,
        stdout: failures.length === 0 ? "Mocked stems decoded, WebAudio played, canvas rendered and mobile layout fit." : "",
        stderr: failures.join("\n"),
      },
    ];
  } catch (error) {
    const diagnostics = [];
    if (page) {
      try {
        const alerts = await page.locator('[role="alert"]').allTextContents();
        if (alerts.length > 0) diagnostics.push(`Alerts: ${alerts.join(" | ")}`);
      } catch {}
      try {
        const ready = await page.locator("[data-stage9-player]").getAttribute("data-stage9-ready");
        diagnostics.push(`data-stage9-ready=${ready ?? "missing"}`);
      } catch {}
      try {
        diagnostics.push(`URL: ${page.url()}`);
      } catch {}
    }
    if (requestFailures.length > 0) diagnostics.push(`Request failures: ${requestFailures.join(" | ")}`);
    return [
      {
        name: "Stage 9 interactive player",
        status: "fail",
        durationMs: Date.now() - startedAt,
        stdout: "",
        stderr:
          error instanceof Error
            ? `${error.message}${diagnostics.length ? `\n${diagnostics.join("\n")}` : ""}\nRequires FRONTEND_URL and Playwright Chromium.`
            : String(error),
      },
    ];
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

const modeHandlers = {
  smoke: runSmoke,
  perf: runPerf,
  collaboration: runCollaboration,
  stage9: runStage9,
};

if (!modeHandlers[mode]) {
  console.error(`Unknown frontend harness mode: ${mode}`);
  process.exit(2);
}

const steps = await modeHandlers[mode]();
const report = writeReport("frontend", mode, steps);
exitFromReport(report);
