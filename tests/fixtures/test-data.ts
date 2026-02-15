/**
 * Test data constants shared across all agent specs.
 * These match the data seeded in global-setup.ts.
 */

export const INSTITUTION = {
  id: "demo",
  name: "Example Institution",
  domain: "localhost",
} as const;

export const TEST_USERS = {
  student: {
    email: "student@test.example.com",
    password: "TestPass123!",
    displayName: "Test Student",
    role: "student" as const,
    uid: "test-student-uid",
  },
  instructor: {
    email: "instructor@test.example.com",
    password: "TestPass123!",
    displayName: "Test Instructor",
    role: "instructor" as const,
    uid: "test-instructor-uid",
  },
  admin: {
    email: "admin@test.example.com",
    password: "TestPass123!",
    displayName: "Test Admin",
    role: "institution_admin" as const,
    uid: "test-admin-uid",
  },
  superAdmin: {
    email: "superadmin@test.example.com",
    password: "TestPass123!",
    displayName: "Test Super Admin",
    role: "super_admin" as const,
    uid: "test-superadmin-uid",
  },
} as const;

export const COURSES = {
  free: {
    id: "getting-started",
    title: "Getting Started",
    slug: "getting-started",
    type: "self_paced",
  },
  paid: {
    id: "sample-paid-course",
    title: "Sample Paid Course",
    slug: "sample-paid-course",
    type: "self_paced",
    priceINR: 999,
  },
} as const;

export const MODULES = {
  module1: {
    id: "module-1",
    title: "Module 1: Introduction",
    courseId: COURSES.free.id,
  },
} as const;

export const LESSONS = {
  lesson1: {
    id: "lesson-1",
    title: "Welcome to the Platform",
    type: "text",
    moduleId: MODULES.module1.id,
    courseId: COURSES.free.id,
  },
  lesson2: {
    id: "lesson-2",
    title: "Managing Your Courses",
    type: "text",
    moduleId: MODULES.module1.id,
    courseId: COURSES.free.id,
  },
} as const;

/** Emulator connection config */
export const EMULATOR = {
  authHost: "127.0.0.1:9099",
  firestoreHost: "127.0.0.1:8080",
  projectId: "demo-project",
} as const;

/** Pages that each role should be able to access */
export const ROLE_PAGES = {
  student: ["/dashboard", "/courses", "/certificates", "/profile/edit"],
  instructor: [
    "/dashboard",
    "/courses",
    "/instructor/courses",
  ],
  admin: [
    "/dashboard",
    "/admin/courses",
    "/admin/users",
    "/admin/enrollments",
    "/admin/payments",
    "/admin/analytics",
  ],
  superAdmin: [
    "/dashboard",
    "/admin/courses",
    "/admin/users",
    "/admin/institutions",
    "/admin/reset-data",
  ],
} as const;

/** Pages that specific roles should NOT have access to */
export const FORBIDDEN_PAGES = {
  student: ["/admin/courses", "/admin/users", "/admin/institutions", "/instructor/courses"],
  instructor: ["/admin/users", "/admin/institutions", "/admin/payments"],
  admin: ["/admin/institutions"],
} as const;
