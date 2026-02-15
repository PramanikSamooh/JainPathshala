/**
 * Playwright Global Setup
 *
 * 1. Clears Firebase Auth & Firestore emulators
 * 2. Creates 4 test users with custom claims (role, institutionId)
 * 3. Seeds Firestore with test data (institution, courses, modules, lessons, enrollments)
 * 4. Obtains session cookies for each user via the real /api/auth/session endpoint
 * 5. Saves storageState files for each role to tests/.auth/
 */

import { FullConfig } from "@playwright/test";
import path from "path";
import fs from "fs";
import { TEST_USERS, EMULATOR, INSTITUTION, COURSES, MODULES, LESSONS } from "./fixtures/test-data";

const AUTH_DIR = path.join(__dirname, ".auth");
const BASE_URL = "http://localhost:3000";

// Firebase Auth Emulator REST endpoints
const AUTH_EMULATOR = `http://${EMULATOR.authHost}`;
const FIRESTORE_EMULATOR = `http://${EMULATOR.firestoreHost}`;

interface EmulatorSignUpResponse {
  localId: string;
  idToken: string;
  refreshToken: string;
  email: string;
}

async function clearEmulators() {
  // Clear Auth Emulator
  await fetch(
    `${AUTH_EMULATOR}/emulator/v1/projects/${EMULATOR.projectId}/accounts`,
    { method: "DELETE" }
  );

  // Clear Firestore Emulator
  await fetch(
    `${FIRESTORE_EMULATOR}/emulator/v1/projects/${EMULATOR.projectId}/databases/(default)/documents`,
    { method: "DELETE" }
  );

  console.log("[setup] Emulators cleared");
}

async function createEmulatorUser(
  email: string,
  password: string,
  displayName: string
): Promise<EmulatorSignUpResponse> {
  const res = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        displayName,
        returnSecureToken: true,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create user ${email}: ${res.status} ${text}`);
  }

  return res.json();
}

async function setCustomClaims(
  uid: string,
  claims: Record<string, string>
) {
  // Use the Auth Emulator's admin endpoint to set custom claims
  // This mirrors what firebase-admin's auth.setCustomUserClaims() does
  const res = await fetch(
    `${AUTH_EMULATOR}/emulator/v1/projects/${EMULATOR.projectId}/accounts/${uid}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customAttributes: JSON.stringify(claims),
      }),
    }
  );

  if (!res.ok) {
    // Fallback: try using the identitytoolkit endpoint with localId
    const res2 = await fetch(
      `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:update`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer owner",
        },
        body: JSON.stringify({
          localId: uid,
          customAttributes: JSON.stringify(claims),
        }),
      }
    );

    if (!res2.ok) {
      const text = await res2.text();
      throw new Error(`Failed to set claims for ${uid}: ${res2.status} ${text}`);
    }
  }
}

async function refreshIdToken(refreshToken: string): Promise<string> {
  // After setting custom claims, we need a fresh ID token that includes them
  const res = await fetch(
    `${AUTH_EMULATOR}/securetoken.googleapis.com/v1/token?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to refresh token: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.id_token;
}

async function getSessionCookie(idToken: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    redirect: "manual",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create session: ${res.status} ${text}`);
  }

  // Extract the __session cookie from Set-Cookie header
  const setCookieHeader = res.headers.get("set-cookie") || "";
  const sessionMatch = setCookieHeader.match(/__session=([^;]+)/);
  if (!sessionMatch) {
    throw new Error(
      `No __session cookie in response. Set-Cookie: ${setCookieHeader}`
    );
  }

  return sessionMatch[1];
}

function saveStorageState(
  role: string,
  sessionCookie: string,
  institutionId: string
) {
  const storageState = {
    cookies: [
      {
        name: "__session",
        value: sessionCookie,
        domain: "localhost",
        path: "/",
        expires: Math.floor(Date.now() / 1000) + 432000,
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
      },
      {
        name: "__institution",
        value: institutionId,
        domain: "localhost",
        path: "/",
        expires: Math.floor(Date.now() / 1000) + 86400,
        httpOnly: false,
        secure: false,
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };

  const filePath = path.join(AUTH_DIR, `${role}.json`);
  fs.writeFileSync(filePath, JSON.stringify(storageState, null, 2));
  console.log(`[setup] Saved auth state: ${filePath}`);
}

async function seedFirestoreDocument(
  collection: string,
  docId: string,
  data: Record<string, unknown>
) {
  // Convert data to Firestore REST format
  const fields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === "string") {
      fields[key] = { stringValue: value };
    } else if (typeof value === "number") {
      fields[key] = Number.isInteger(value)
        ? { integerValue: String(value) }
        : { doubleValue: value };
    } else if (typeof value === "boolean") {
      fields[key] = { booleanValue: value };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map((v) =>
            typeof v === "string"
              ? { stringValue: v }
              : typeof v === "number"
              ? { integerValue: String(v) }
              : { stringValue: String(v) }
          ),
        },
      };
    } else if (typeof value === "object") {
      // Nested object — convert recursively
      const nestedFields: Record<string, unknown> = {};
      for (const [nk, nv] of Object.entries(value as Record<string, unknown>)) {
        if (nv === null || nv === undefined) {
          nestedFields[nk] = { nullValue: null };
        } else if (typeof nv === "string") {
          nestedFields[nk] = { stringValue: nv };
        } else if (typeof nv === "number") {
          nestedFields[nk] = Number.isInteger(nv)
            ? { integerValue: String(nv) }
            : { doubleValue: nv };
        } else if (typeof nv === "boolean") {
          nestedFields[nk] = { booleanValue: nv };
        } else {
          nestedFields[nk] = { stringValue: JSON.stringify(nv) };
        }
      }
      fields[key] = { mapValue: { fields: nestedFields } };
    }
  }

  const url = `${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR.projectId}/databases/(default)/documents/${collection}/${docId}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer owner",
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to seed ${collection}/${docId}: ${res.status} ${text}`);
  }
}

async function seedSubDocument(
  parentPath: string,
  subcollection: string,
  docId: string,
  data: Record<string, unknown>
) {
  const fields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === "string") {
      fields[key] = { stringValue: value };
    } else if (typeof value === "number") {
      fields[key] = Number.isInteger(value)
        ? { integerValue: String(value) }
        : { doubleValue: value };
    } else if (typeof value === "boolean") {
      fields[key] = { booleanValue: value };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map((v) =>
            typeof v === "string"
              ? { stringValue: v }
              : typeof v === "number"
              ? { integerValue: String(v) }
              : { stringValue: String(v) }
          ),
        },
      };
    } else if (typeof value === "object") {
      const nestedFields: Record<string, unknown> = {};
      for (const [nk, nv] of Object.entries(value as Record<string, unknown>)) {
        if (nv === null || nv === undefined) {
          nestedFields[nk] = { nullValue: null };
        } else if (typeof nv === "string") {
          nestedFields[nk] = { stringValue: nv };
        } else if (typeof nv === "number") {
          nestedFields[nk] = Number.isInteger(nv)
            ? { integerValue: String(nv) }
            : { doubleValue: nv };
        } else if (typeof nv === "boolean") {
          nestedFields[nk] = { booleanValue: nv };
        } else {
          nestedFields[nk] = { stringValue: JSON.stringify(nv) };
        }
      }
      fields[key] = { mapValue: { fields: nestedFields } };
    }
  }

  const url = `${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR.projectId}/databases/(default)/documents/${parentPath}/${subcollection}/${docId}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer owner",
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to seed ${parentPath}/${subcollection}/${docId}: ${res.status} ${text}`);
  }
}

async function seedTestData(users: Record<string, { uid: string }>) {
  console.log("[setup] Seeding Firestore...");

  // 1. Institution
  await seedFirestoreDocument("institutions", INSTITUTION.id, {
    id: INSTITUTION.id,
    name: INSTITUTION.name,
    slug: "demo",
    domains: ["localhost"],
    primaryDomain: "localhost",
    allowedEmailDomains: ["example.com", "test.example.com"],
    isActive: true,
  });
  console.log("[setup]   Institution seeded");

  // 2. User documents (matching Auth Emulator users)
  for (const [roleKey, userData] of Object.entries(TEST_USERS)) {
    const uid = users[roleKey]?.uid || userData.uid;
    await seedFirestoreDocument("users", uid, {
      uid,
      email: userData.email,
      displayName: userData.displayName,
      role: userData.role,
      institutionId: INSTITUTION.id,
      type: "domain",
      photoURL: "",
      isProfileComplete: true,
      isActive: true,
    });
  }
  console.log("[setup]   User documents seeded");

  // 3. Free course
  await seedFirestoreDocument("courses", COURSES.free.id, {
    id: COURSES.free.id,
    institutionId: INSTITUTION.id,
    title: COURSES.free.title,
    slug: COURSES.free.slug,
    description: "A comprehensive introduction to financial markets.",
    shortDescription: "Learn the fundamentals of financial markets",
    thumbnailUrl: "",
    type: COURSES.free.type,
    skillLevel: "beginner",
    language: "en",
    status: "published",
    isVisible: true,
    enrollmentCount: 1,
    createdBy: "seed-script",
    moduleOrder: [MODULES.module1.id],
  });

  // 4. Paid course
  await seedFirestoreDocument("courses", COURSES.paid.id, {
    id: COURSES.paid.id,
    institutionId: INSTITUTION.id,
    title: COURSES.paid.title,
    slug: COURSES.paid.slug,
    description: "Master advanced trading techniques.",
    shortDescription: "Advanced trading techniques for serious investors",
    thumbnailUrl: "",
    type: COURSES.paid.type,
    skillLevel: "advanced",
    language: "en",
    status: "published",
    isVisible: true,
    enrollmentCount: 0,
    createdBy: "seed-script",
    moduleOrder: [],
  });
  console.log("[setup]   Courses seeded");

  // 5. Module (subcollection of free course)
  await seedSubDocument(
    `courses/${COURSES.free.id}`,
    "modules",
    MODULES.module1.id,
    {
      id: MODULES.module1.id,
      courseId: COURSES.free.id,
      title: MODULES.module1.title,
      description: "An overview of different types of financial markets",
      order: 0,
      lessonOrder: [LESSONS.lesson1.id, LESSONS.lesson2.id],
      isPublished: true,
    }
  );
  console.log("[setup]   Module seeded");

  // 6. Lessons (subcollection of module)
  await seedSubDocument(
    `courses/${COURSES.free.id}/modules/${MODULES.module1.id}`,
    "lessons",
    LESSONS.lesson1.id,
    {
      id: LESSONS.lesson1.id,
      type: "text",
      title: LESSONS.lesson1.title,
      order: 0,
      textContent: "Financial markets are platforms where buyers and sellers trade.",
      isPublished: true,
      estimatedMinutes: 15,
    }
  );

  await seedSubDocument(
    `courses/${COURSES.free.id}/modules/${MODULES.module1.id}`,
    "lessons",
    LESSONS.lesson2.id,
    {
      id: LESSONS.lesson2.id,
      type: "text",
      title: LESSONS.lesson2.title,
      order: 1,
      textContent: "Stock markets enable companies to raise capital by issuing shares.",
      isPublished: true,
      estimatedMinutes: 20,
    }
  );
  console.log("[setup]   Lessons seeded");

  // 7. Enrollment for student in free course
  const studentUid = users.student?.uid || TEST_USERS.student.uid;
  await seedFirestoreDocument("enrollments", `enroll-${studentUid}-${COURSES.free.id}`, {
    id: `enroll-${studentUid}-${COURSES.free.id}`,
    userId: studentUid,
    userEmail: TEST_USERS.student.email,
    courseId: COURSES.free.id,
    courseTitle: COURSES.free.title,
    institutionId: INSTITUTION.id,
    status: "active",
    progress: 0,
    completedLessons: [],
  });
  console.log("[setup]   Enrollment seeded");

  console.log("[setup] Firestore seeding complete");
}

export default async function globalSetup(_config: FullConfig) {
  console.log("\n[setup] Starting global test setup...\n");

  // Ensure auth directory exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  // 1. Clear emulators
  await clearEmulators();

  // 2. Create users and get auth tokens
  const userResults: Record<string, { uid: string; refreshToken: string }> = {};

  for (const [roleKey, userData] of Object.entries(TEST_USERS)) {
    console.log(`[setup] Creating user: ${userData.email} (${userData.role})`);

    const signUpResult = await createEmulatorUser(
      userData.email,
      userData.password,
      userData.displayName
    );

    // Set custom claims
    await setCustomClaims(signUpResult.localId, {
      role: userData.role,
      institutionId: INSTITUTION.id,
    });

    userResults[roleKey] = {
      uid: signUpResult.localId,
      refreshToken: signUpResult.refreshToken,
    };

    console.log(`[setup]   Created: uid=${signUpResult.localId}`);
  }

  // 3. Seed Firestore data
  await seedTestData(userResults);

  // 4. Get session cookies and save storageState for each role
  for (const [roleKey, userData] of Object.entries(TEST_USERS)) {
    const { refreshToken } = userResults[roleKey];

    // Refresh token to get fresh ID token with custom claims
    const freshIdToken = await refreshIdToken(refreshToken);

    // Exchange for session cookie
    const sessionCookie = await getSessionCookie(freshIdToken);

    // Map roleKey to storageState filename
    const fileNameMap: Record<string, string> = {
      student: "student",
      instructor: "instructor",
      admin: "admin",
      superAdmin: "super-admin",
    };

    saveStorageState(fileNameMap[roleKey], sessionCookie, INSTITUTION.id);
    console.log(`[setup] Auth ready for ${userData.role}`);
  }

  console.log("\n[setup] Global setup complete!\n");
}
