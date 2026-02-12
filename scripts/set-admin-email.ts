/**
 * One-time script: Set googleWorkspace.adminEmail on the "ifs" institution doc.
 * Run with: npx tsx scripts/set-admin-email.ts
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
  const institutionId = "ifs";
  const ref = db.collection("institutions").doc(institutionId);

  await ref.update({
    "googleWorkspace.adminEmail": "admin@ifsjaipur.com",
    "googleWorkspace.serviceAccountEmail": "gyansetu-5ac34@appspot.gserviceaccount.com",
    "googleWorkspace.clientId": "111579210018399755832",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Updated institution "${institutionId}" with googleWorkspace.adminEmail = admin@ifsjaipur.com`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
