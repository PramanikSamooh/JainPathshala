/**
 * Test script: Verify Google Workspace service account + domain-wide delegation.
 * Run with: npx tsx scripts/test-google-auth.ts
 */
import { google } from "googleapis";
import { readFileSync } from "fs";
import { resolve } from "path";

// Parse .env.local
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.substring(0, eqIdx);
  let val = trimmed.substring(eqIdx + 1);
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  envVars[key] = val;
}

const email = envVars.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = envVars.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!email || !privateKey) {
  console.error("GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY required in .env.local");
  process.exit(1);
}

const credentials = { client_email: email, private_key: privateKey };
const adminEmail = envVars.GOOGLE_WORKSPACE_ADMIN_EMAIL || process.argv[2];
if (!adminEmail) {
  console.error("Set GOOGLE_WORKSPACE_ADMIN_EMAIL in .env.local or pass as argument");
  process.exit(1);
}

async function testCalendar() {
  console.log(`--- Testing Calendar API (impersonating ${adminEmail}) ---`);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
    clientOptions: { subject: adminEmail },
  });
  const calendar = google.calendar({ version: "v3", auth });
  // Use events.list (matches our delegated scope) instead of calendarList.list
  const now = new Date().toISOString();
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: now,
    maxResults: 3,
    singleEvents: true,
    orderBy: "startTime",
  });
  console.log(`  Upcoming events: ${res.data.items?.length || 0}`);
  res.data.items?.forEach((ev) => console.log(`    - ${ev.summary} (${ev.start?.dateTime || ev.start?.date})`));
  console.log("  Calendar API: OK\n");
}

async function testDrive() {
  console.log(`--- Testing Drive API (impersonating ${adminEmail}) ---`);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
    clientOptions: { subject: adminEmail },
  });
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.about.get({ fields: "user" });
  console.log(`  Authenticated as: ${res.data.user?.displayName} (${res.data.user?.emailAddress})`);
  console.log("  Drive API: OK\n");
}

async function testAdminSDK() {
  console.log(`--- Testing Admin SDK (impersonating ${adminEmail}) ---`);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/admin.directory.user.readonly"],
    clientOptions: { subject: adminEmail },
  });
  const admin = google.admin({ version: "directory_v1", auth });
  const domain = adminEmail.split("@")[1];
  const res = await admin.users.list({ domain, maxResults: 3 });
  console.log(`  Users found: ${res.data.users?.length || 0}`);
  res.data.users?.forEach((u) => console.log(`    - ${u.name?.fullName} (${u.primaryEmail})`));
  console.log("  Admin SDK: OK\n");
}

async function main() {
  console.log(`\nService Account: ${credentials.client_email}`);
  console.log(`Impersonating: ${adminEmail}\n`);

  let passed = 0;
  let failed = 0;

  for (const [name, fn] of [["Calendar", testCalendar], ["Drive", testDrive], ["Admin SDK", testAdminSDK]] as const) {
    try {
      await (fn as () => Promise<void>)();
      passed++;
    } catch (err: any) {
      failed++;
      console.error(`  ${name} API: FAILED`);
      console.error(`  Error: ${err.message || err}`);
      if (err.response?.data?.error) {
        console.error(`  Details: ${JSON.stringify(err.response.data.error)}`);
      }
      console.log();
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
