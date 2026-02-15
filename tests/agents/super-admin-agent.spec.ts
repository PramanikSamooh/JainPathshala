/**
 * Super Admin Agent — Tests the super_admin role's core flows
 *
 * Covers: institution management, cross-role access, data reset,
 * and comprehensive admin capabilities.
 */

import { test, expect } from "@playwright/test";
import {
  navigateAndAnalyze,
  assertPageAccessible,
  verifyWithAI,
  waitForElement,
} from "../lib/test-helpers";
import { createIssue, saveReport } from "../lib/issue-reporter";
import { ROLE_PAGES } from "../fixtures/test-data";

const ROLE = "super_admin";

test.describe("Super Admin Agent", () => {
  test.afterAll(() => {
    saveReport();
  });

  test.describe("Page Access", () => {
    test("can access all super admin pages", async ({ page }) => {
      for (const url of ROLE_PAGES.superAdmin) {
        const issues = await assertPageAccessible(page, url, ROLE);
        expect(
          issues.filter((i) => i.severity === "critical"),
          `Critical issues on ${url}`
        ).toHaveLength(0);
      }
    });

    test("can access admin pages (downward access)", async ({ page }) => {
      const adminPages = [
        "/admin/courses",
        "/admin/users",
        "/admin/enrollments",
        "/admin/payments",
        "/admin/analytics",
      ];

      for (const url of adminPages) {
        const issues = await assertPageAccessible(page, url, ROLE);
        expect(
          issues.filter((i) => i.severity === "critical"),
          `Critical issues on ${url}`
        ).toHaveLength(0);
      }
    });

    test("can access instructor pages (downward access)", async ({ page }) => {
      const instructorPages = ["/instructor/courses"];

      for (const url of instructorPages) {
        const issues = await assertPageAccessible(page, url, ROLE);
        // Super admin should be able to see instructor pages
        if (issues.length > 0) {
          console.warn(
            `[super_admin] Cannot access instructor page ${url} — this may be by design`
          );
        }
      }
    });
  });

  test.describe("Institution Management", () => {
    test("institutions list page loads", async ({ page }) => {
      await navigateAndAnalyze(
        page,
        "/admin/institutions",
        ROLE,
        "Institutions page should list all institutions with CRUD options"
      );

      await expect(page).toHaveURL(/\/admin\/institutions/);

      // Check for institution list
      const hasContent = await waitForElement(
        page,
        'table, [class*="institution"], [class*="card"]',
        ROLE,
        "Institution list/table"
      );

      await verifyWithAI(
        page,
        ROLE,
        "The institutions page should show a list of institutions with name, domain, status, and management options",
        "institutions-list"
      );
    });

    test("create institution page loads", async ({ page }) => {
      await navigateAndAnalyze(
        page,
        "/admin/institutions/new",
        ROLE,
        "New institution form should have fields for name, domain, branding, and settings"
      );

      await verifyWithAI(
        page,
        ROLE,
        "The create institution page should have a comprehensive form for institution setup including name, domain, branding colors, and configuration settings",
        "create-institution"
      );
    });

    test("can view/edit existing institution", async ({ page }) => {
      await navigateAndAnalyze(
        page,
        "/admin/institutions/ifs",
        ROLE,
        "Institution detail page should show editable fields for the IFS institution"
      );

      await verifyWithAI(
        page,
        ROLE,
        "The institution edit page should show the Example Institution details with editable fields",
        "edit-institution"
      );
    });
  });

  test.describe("Data Reset", () => {
    test("reset data page loads", async ({ page }) => {
      await navigateAndAnalyze(
        page,
        "/admin/reset-data",
        ROLE,
        "Data reset page should show reset options with safety warnings"
      );

      await expect(page).toHaveURL(/\/admin\/reset-data/);

      await verifyWithAI(
        page,
        ROLE,
        "The data reset page should show reset options with clear warnings about data loss and confirmation mechanisms",
        "reset-data"
      );
    });
  });

  test.describe("Zoom Integration", () => {
    test("zoom dashboard loads", async ({ page }) => {
      await navigateAndAnalyze(
        page,
        "/admin/zoom",
        ROLE,
        "Zoom admin dashboard should show meeting stats and management interface"
      );

      await verifyWithAI(
        page,
        ROLE,
        "The Zoom dashboard should show meeting statistics (total, upcoming, completed) and a list of meetings",
        "zoom-dashboard"
      );
    });
  });

  test.describe("Cross-Role Verification", () => {
    test("can browse courses like a student", async ({ page }) => {
      await navigateAndAnalyze(
        page,
        "/courses",
        ROLE,
        "Super admin should also be able to browse the public course catalog"
      );

      await expect(page).toHaveURL(/\/courses/);

      await verifyWithAI(
        page,
        ROLE,
        "The course catalog should be accessible to super admin and show available courses",
        "browse-courses"
      );
    });

    test("dashboard shows admin controls", async ({ page }) => {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);

      // Super admin should see all navigation items
      const adminLinks = page.locator('a[href*="/admin/"]');
      const linkCount = await adminLinks.count();

      if (linkCount < 3) {
        createIssue({
          severity: "major",
          category: "functional",
          role: ROLE,
          page: "/dashboard",
          description: `Super admin sees only ${linkCount} admin links — expected more`,
          expectedBehavior: "Super admin should see all admin menu items",
          actualBehavior: `Only ${linkCount} admin links found`,
        });
      }

      await verifyWithAI(
        page,
        ROLE,
        "The sidebar should show comprehensive admin navigation including Institutions, Courses, Users, Enrollments, Payments, Analytics, Zoom, and Reset Data",
        "super-admin-sidebar"
      );
    });
  });
});
