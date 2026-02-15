/**
 * Orchestrator Agent
 *
 * Master script that:
 * 1. Checks if Firebase emulators are running
 * 2. Checks if Next.js dev server is running
 * 3. Runs all 4 role-specific Playwright test projects in parallel
 * 4. Collects AI-detected issues from all agents
 * 5. Generates a unified report
 * 6. Exits with code 1 if critical issues found
 *
 * Usage: npx tsx tests/agents/orchestrator.ts
 */

import { execSync, spawn } from "child_process";
import path from "path";
import fs from "fs";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(__dirname, "..", "reports");
const ISSUES_FILE = path.join(REPORTS_DIR, "ai-issues.json");

interface Issue {
  id: string;
  severity: string;
  category: string;
  role: string;
  page: string;
  description: string;
}

async function checkEmulators(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:9099/");
    return res.ok || res.status === 200;
  } catch {
    return false;
  }
}

async function checkDevServer(): Promise<boolean> {
  try {
    const res = await fetch("http://localhost:3000/", { redirect: "manual" });
    return res.status < 500;
  } catch {
    return false;
  }
}

function printBanner() {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          AI-POWERED MULTI-ROLE TESTING AGENTS           ║");
  console.log("║                  Education Platform                      ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");
}

function printRoleStatus(role: string, status: "running" | "done" | "failed") {
  const icons = { running: "⏳", done: "✅", failed: "❌" };
  const labels = { running: "Running", done: "Passed", failed: "Failed" };
  console.log(`  ${icons[status]} ${role.padEnd(20)} ${labels[status]}`);
}

async function runTests(): Promise<{ exitCode: number }> {
  return new Promise((resolve) => {
    const configPath = path.join(__dirname, "..", "playwright.config.ts");

    const proc = spawn(
      "npx",
      ["playwright", "test", "--config", configPath],
      {
        cwd: PROJECT_ROOT,
        stdio: "inherit",
        shell: true,
        env: {
          ...process.env,
          // Ensure emulator env vars are set
          FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
          FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
        },
      }
    );

    proc.on("close", (code) => {
      resolve({ exitCode: code || 0 });
    });

    proc.on("error", (err) => {
      console.error("[orchestrator] Failed to start Playwright:", err);
      resolve({ exitCode: 1 });
    });
  });
}

function generateSummary() {
  if (!fs.existsSync(ISSUES_FILE)) {
    console.log("\n[orchestrator] No AI issues file found (AI may be disabled)");
    return { critical: 0, major: 0, minor: 0, suggestion: 0, total: 0 };
  }

  const issues: Issue[] = JSON.parse(fs.readFileSync(ISSUES_FILE, "utf-8"));

  const summary = {
    critical: issues.filter((i) => i.severity === "critical").length,
    major: issues.filter((i) => i.severity === "major").length,
    minor: issues.filter((i) => i.severity === "minor").length,
    suggestion: issues.filter((i) => i.severity === "suggestion").length,
    total: issues.length,
  };

  // Group by role
  const byRole: Record<string, Issue[]> = {};
  for (const issue of issues) {
    if (!byRole[issue.role]) byRole[issue.role] = [];
    byRole[issue.role].push(issue);
  }

  console.log("\n" + "═".repeat(60));
  console.log("  UNIFIED AI TESTING REPORT");
  console.log("═".repeat(60));
  console.log(`  Total issues: ${summary.total}`);
  console.log(`    🔴 Critical: ${summary.critical}`);
  console.log(`    🟠 Major:    ${summary.major}`);
  console.log(`    🟡 Minor:    ${summary.minor}`);
  console.log(`    🔵 Suggest:  ${summary.suggestion}`);
  console.log("─".repeat(60));

  for (const [role, roleIssues] of Object.entries(byRole)) {
    console.log(`\n  [${role}] — ${roleIssues.length} issues`);
    for (const issue of roleIssues) {
      const icon =
        issue.severity === "critical"
          ? "🔴"
          : issue.severity === "major"
          ? "🟠"
          : issue.severity === "minor"
          ? "🟡"
          : "🔵";
      console.log(`    ${icon} ${issue.page} — ${issue.description}`);
    }
  }

  console.log("\n" + "═".repeat(60));

  // Generate markdown summary
  const markdownPath = path.join(REPORTS_DIR, "summary.md");
  const md = [
    "# AI Testing Agent Report",
    "",
    `**Date**: ${new Date().toISOString()}`,
    `**Total Issues**: ${summary.total}`,
    "",
    "| Severity | Count |",
    "|----------|-------|",
    `| Critical | ${summary.critical} |`,
    `| Major | ${summary.major} |`,
    `| Minor | ${summary.minor} |`,
    `| Suggestion | ${summary.suggestion} |`,
    "",
    "## Issues by Role",
    "",
  ];

  for (const [role, roleIssues] of Object.entries(byRole)) {
    md.push(`### ${role}`);
    md.push("");
    for (const issue of roleIssues) {
      md.push(`- **[${issue.severity.toUpperCase()}]** \`${issue.page}\` — ${issue.description}`);
    }
    md.push("");
  }

  fs.writeFileSync(markdownPath, md.join("\n"));
  console.log(`  Markdown report: ${markdownPath}`);
  console.log(`  JSON report:     ${ISSUES_FILE}`);
  console.log(`  HTML report:     npx playwright show-report tests/reports`);
  console.log("");

  return summary;
}

async function main() {
  printBanner();

  // Check prerequisites
  console.log("[orchestrator] Checking prerequisites...\n");

  const emulatorsRunning = await checkEmulators();
  if (!emulatorsRunning) {
    console.error("❌ Firebase Emulators are not running!");
    console.error("   Start them with: npx firebase emulators:start");
    console.error("");
    process.exit(1);
  }
  console.log("  ✅ Firebase Emulators running");

  const devServerRunning = await checkDevServer();
  if (!devServerRunning) {
    console.error("❌ Next.js dev server is not running!");
    console.error("   Start it with: npm run dev");
    console.error("   (with emulator env vars set)");
    console.error("");
    process.exit(1);
  }
  console.log("  ✅ Next.js dev server running");

  const aiEnabled = !!process.env.ANTHROPIC_API_KEY;
  console.log(
    aiEnabled
      ? "  ✅ AI analysis enabled (ANTHROPIC_API_KEY set)"
      : "  ⚠️  AI analysis disabled (no ANTHROPIC_API_KEY)"
  );

  console.log("\n[orchestrator] Launching role agents...\n");

  // Run all test projects
  const roles = ["student", "instructor", "admin", "super-admin"];
  for (const role of roles) {
    printRoleStatus(role, "running");
  }

  const { exitCode } = await runTests();

  console.log("\n[orchestrator] Test execution complete.\n");

  // Generate unified report
  const summary = generateSummary();

  // Exit with appropriate code
  if (summary.critical > 0) {
    console.log("💀 CRITICAL ISSUES FOUND — exit code 1\n");
    process.exit(1);
  } else if (exitCode !== 0) {
    console.log("⚠️  Tests had failures — exit code 1\n");
    process.exit(1);
  } else {
    console.log("✅ All tests passed!\n");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("[orchestrator] Fatal error:", err);
  process.exit(1);
});
