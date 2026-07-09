import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { exitFromReport, repoRoot, writeReport } from "../lib/harness-utils.mjs";

function pass(name, stdout = "") {
  return { name, status: "pass", durationMs: 0, stdout, stderr: "" };
}

function fail(name, stderr) {
  return { name, status: "fail", durationMs: 0, stdout: "", stderr };
}

function checkFile(path, name = path) {
  return existsSync(resolve(repoRoot, path)) ? pass(`${name} exists`) : fail(`${name} exists`, `${path} not found`);
}

function text(path) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

const compose = text("docker-compose.yml");
const main = text("backend/app/main.py");
const ci = text(".github/workflows/ci.yml");
const envExample = text("infra/easypanel/env.production.example");
const productionDocs = text("docs/production-readiness.md");
const easypanelRunbook = text("infra/easypanel/README.md");

const docsDisabledOutsideDevelopment =
  /docs_url\s*=\s*["']\/docs["']\s*if\s*settings\.APP_ENV\s*==\s*["']development["']\s*else\s*None/.test(main);

const steps = [
  checkFile("infra/easypanel/README.md", "Easypanel runbook"),
  checkFile("infra/easypanel/env.production.example", "production env template"),
  checkFile("infra/ops/backup-postgres.sh", "PostgreSQL backup script"),
  checkFile("infra/ops/restore-postgres.sh", "PostgreSQL restore script"),
  checkFile("infra/ops/backup-minio.sh", "MinIO backup script"),
  checkFile("infra/ops/restore-minio.sh", "MinIO restore script"),
  compose.includes("model_cache:") && compose.includes("/home/appuser/.cache")
    ? pass("Demucs model cache volume declared")
    : fail("Demucs model cache volume declared", "worker must persist /home/appuser/.cache"),
  !/postgres:[\s\S]*?ports:/m.test(compose.split("redis:")[0])
    ? pass("PostgreSQL has no public ports in compose")
    : fail("PostgreSQL has no public ports in compose", "Remove postgres ports before production"),
  !/redis:[\s\S]*?ports:/m.test(compose.split("minio:")[0])
    ? pass("Redis has no public ports in compose")
    : fail("Redis has no public ports in compose", "Remove redis ports before production"),
  docsDisabledOutsideDevelopment
    ? pass("OpenAPI docs disabled outside development")
    : fail("OpenAPI docs disabled outside development", "APP_ENV=production must disable /docs"),
  envExample.includes("APP_ENV=production") && envExample.includes("MINIO_USE_SSL=true")
    ? pass("production env template uses production mode and TLS media URLs")
    : fail("production env template uses production mode and TLS media URLs", "Review infra/easypanel/env.production.example"),
  ci.includes("pull_request:") && ci.includes("pytest tests -v") && ci.includes("npm run build")
    ? pass("CI covers PR backend/frontend checks")
    : fail("CI covers PR backend/frontend checks", "CI must run on PR with backend tests and frontend build"),
  productionDocs.includes("Restore Drill") && easypanelRunbook.includes("Restore Drill")
    ? pass("restore/deploy checklist documented")
    : fail("restore/deploy checklist documented", "Document restore drills in production readiness docs and Easypanel runbook"),
];

const report = writeReport("production", "readiness", steps);
exitFromReport(report);
