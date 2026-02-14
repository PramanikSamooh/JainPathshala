/**
 * Migrate existing users to the multi-institution membership model.
 *
 * For every user document that already has an `institutionId`, this script
 * creates a membership subcollection document at
 *   users/{uid}/memberships/{institutionId}
 * and sets `activeInstitutionId` on the user doc if it is not already set.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-multi-institution.ts            # live run
 *   npx tsx scripts/migrate-to-multi-institution.ts --dry-run   # preview only
 *
 * Authentication: Set the GOOGLE_APPLICATION_CREDENTIALS env var to point at
 * a service-account key file, or run from an environment where Application
 * Default Credentials are available.
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Firebase init
// ---------------------------------------------------------------------------
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const BATCH_LIMIT = 500; // Firestore batched-write limit

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------
async function migrate(): Promise<void> {
  if (DRY_RUN) {
    console.log("=== DRY-RUN MODE — no writes will be performed ===\n");
  }

  console.log("Fetching all user documents...");
  const usersSnap = await db.collection("users").get();
  console.log(`Found ${usersSnap.size} user document(s).\n`);

  let processedCount = 0;
  let skippedNoInstitution = 0;
  let skippedAlreadyExists = 0;
  let createdCount = 0;
  let activeIdSetCount = 0;

  // Accumulate write operations and flush in batches of BATCH_LIMIT.
  // Each membership creation can use up to 2 operations (membership doc +
  // user doc update), so we track the operation count carefully.
  let batch = db.batch();
  let opsInBatch = 0;

  async function flushBatch(): Promise<void> {
    if (opsInBatch === 0) return;
    if (!DRY_RUN) {
      await batch.commit();
    }
    batch = db.batch();
    opsInBatch = 0;
  }

  for (const userDoc of usersSnap.docs) {
    processedCount++;
    const data = userDoc.data();
    const uid = userDoc.id;
    const institutionId: string | undefined = data.institutionId;

    if (!institutionId) {
      skippedNoInstitution++;
      continue;
    }

    // Check if membership already exists
    const membershipRef = db
      .collection("users")
      .doc(uid)
      .collection("memberships")
      .doc(institutionId);

    const membershipSnap = await membershipRef.get();
    if (membershipSnap.exists) {
      skippedAlreadyExists++;
      console.log(
        `  [SKIP] ${uid} — membership for ${institutionId} already exists`
      );
      continue;
    }

    // Determine joinMethod based on isExternal flag
    const isExternal: boolean = data.isExternal === true;
    const joinMethod = isExternal ? "admin_added" : "email_domain";

    // Build membership document
    const membershipData = {
      id: institutionId,
      userId: uid,
      institutionId,
      role: data.role ?? "student",
      status: "approved",
      isExternal,
      joinMethod,
      requestedAt: FieldValue.serverTimestamp(),
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: null,
      reviewNote: null,
      transferredTo: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Ensure we do not exceed the batch limit before adding operations
    // We may need 1 or 2 ops for this user (membership + optional user update)
    const needsActiveId = !data.activeInstitutionId;
    const opsNeeded = needsActiveId ? 2 : 1;

    if (opsInBatch + opsNeeded > BATCH_LIMIT) {
      await flushBatch();
    }

    batch.set(membershipRef, membershipData);
    opsInBatch++;
    createdCount++;

    // Set activeInstitutionId on the user doc if not already present
    if (needsActiveId) {
      const userRef = db.collection("users").doc(uid);
      batch.update(userRef, {
        activeInstitutionId: institutionId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      opsInBatch++;
      activeIdSetCount++;
    }

    console.log(
      `  [CREATE] ${uid} — membership for ${institutionId} (role: ${data.role}, joinMethod: ${joinMethod}${needsActiveId ? ", +activeInstitutionId" : ""})`
    );
  }

  // Flush any remaining operations
  await flushBatch();

  // Summary
  console.log("\n========================================");
  console.log("Migration complete" + (DRY_RUN ? " (DRY RUN)" : ""));
  console.log("========================================");
  console.log(`  Total users processed:         ${processedCount}`);
  console.log(`  Skipped (no institutionId):     ${skippedNoInstitution}`);
  console.log(`  Skipped (membership exists):    ${skippedAlreadyExists}`);
  console.log(`  Memberships created:            ${createdCount}`);
  console.log(`  activeInstitutionId set:        ${activeIdSetCount}`);
  console.log("========================================\n");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
migrate()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
