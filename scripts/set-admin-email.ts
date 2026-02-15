/**
 * One-time script: Set googleWorkspace.adminEmail on an institution doc.
 *
 * Usage:
 *   npx tsx scripts/set-admin-email.ts <institutionId> <adminEmail> <serviceAccountEmail>
 *
 * Example:
 *   npx tsx scripts/set-admin-email.ts demo admin@example.com sa@project.iam.gserviceaccount.com
 */
import * as admin from "firebase-admin";
import { readFileSync } from "fs";
import { resolve } from "path";

// Parse .env.local manually (avoids dotenv dependency)
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
  // Strip surrounding quotes
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  envVars[key] = val;
}

const projectId = envVars.FIREBASE_PROJECT_ID;
const clientEmail = envVars.FIREBASE_CLIENT_EMAIL;
const privateKey = envVars.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});

const db = admin.firestore();

async function main() {
  const institutionId = process.argv[2];
  const adminEmailArg = process.argv[3];
  const serviceAccountEmailArg = process.argv[4];

  if (!institutionId || !adminEmailArg) {
    console.error("Usage: npx tsx scripts/set-admin-email.ts <institutionId> <adminEmail> [serviceAccountEmail]");
    console.error("Example: npx tsx scripts/set-admin-email.ts demo admin@example.com");
    process.exit(1);
  }

  const ref = db.collection("institutions").doc(institutionId);
  const updateData: Record<string, unknown> = {
    "googleWorkspace.adminEmail": adminEmailArg,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (serviceAccountEmailArg) {
    updateData["googleWorkspace.serviceAccountEmail"] = serviceAccountEmailArg;
  }

  await ref.update(updateData);

  console.log(`Updated institution "${institutionId}" with googleWorkspace.adminEmail = ${adminEmailArg}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
