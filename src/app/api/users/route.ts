import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

const VALID_ROLES = ["super_admin", "institution_admin", "instructor", "student"];

/**
 * GET /api/users
 * List users in the institution.
 * Query params:
 *   ?role=instructor          — single role filter
 *   ?roles=super_admin,instructor — comma-separated multi-role filter
 *   ?institutionId=xxx        — super_admin only
 *
 * Permissions:
 *   - super_admin / institution_admin: full access
 *   - instructor: can only query ?role=instructor (to see other instructors)
 */
export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, false);
    const { searchParams } = request.nextUrl;
    const roleParam = searchParams.get("role");
    const rolesParam = searchParams.get("roles");

    // Instructors can only fetch the instructor list
    if (decoded.role === "instructor") {
      if (roleParam !== "instructor") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!["super_admin", "institution_admin"].includes(decoded.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    let institutionId =
      decoded.role === "super_admin"
        ? searchParams.get("institutionId") || decoded.institutionId
        : decoded.institutionId;

    if (!institutionId) {
      const userDoc = await db.collection("users").doc(decoded.uid).get();
      if (userDoc.exists) institutionId = userDoc.data()?.institutionId;
    }
    if (!institutionId) {
      institutionId = process.env.NEXT_PUBLIC_DEFAULT_INSTITUTION_ID || "ifs";
    }

    let query: FirebaseFirestore.Query = db
      .collection("users")
      .where("institutionId", "==", institutionId);

    // Apply role filters
    if (rolesParam) {
      const rolesList = rolesParam.split(",").filter((r) => VALID_ROLES.includes(r));
      if (rolesList.length > 0) {
        query = query.where("role", "in", rolesList);
      }
    } else if (roleParam && VALID_ROLES.includes(roleParam)) {
      query = query.where("role", "==", roleParam);
    }

    const snap = await query.limit(200).get();

    const users = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ users });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
