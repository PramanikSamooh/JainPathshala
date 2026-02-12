"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ---------- Firestore timestamp shape when serialized to JSON ---------- */
interface FsTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

/* ---------- Raw API shapes (only fields we need) ---------- */
interface RawEnrollment {
  id: string;
  courseId: string;
  status: string;
  enrolledAt: FsTimestamp;
  completedAt?: FsTimestamp | null;
  courseTitle?: string;
  progress?: { percentComplete: number; completedLessons: number; totalLessons: number };
}

interface RawPayment {
  id: string;
  amount: number;
  status: string;
  paidAt?: FsTimestamp | null;
  createdAt: FsTimestamp;
  paymentMethod?: string | null;
}

interface RawUser {
  id: string;
  role: string;
  isExternal?: boolean;
  createdAt?: FsTimestamp;
}

interface RawCourse {
  id: string;
  title: string;
  status: string;
}

/* ---------- Helpers ---------- */
function tsToDate(ts?: FsTimestamp | null): Date | null {
  if (!ts || !ts._seconds) return null;
  return new Date(ts._seconds * 1000);
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function groupByMonth<T>(items: T[], getDate: (item: T) => Date | null): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const d = getDate(item);
    if (!d) continue;
    const key = monthLabel(d);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

// Generate ordered months between start and end
function monthRange(start: Date, end: Date): string[] {
  const months: string[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d <= end) {
    months.push(monthLabel(d));
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  completed: "#3b82f6",
  expired: "#f97316",
  cancelled: "#ef4444",
  refunded: "#a855f7",
  pending_payment: "#eab308",
};

const PIE_COLORS = ["#3b82f6", "#22c55e", "#f97316", "#ef4444", "#a855f7", "#eab308", "#06b6d4"];

export default function AdminAnalyticsPage() {
  const [enrollments, setEnrollments] = useState<RawEnrollment[]>([]);
  const [payments, setPayments] = useState<RawPayment[]>([]);
  const [users, setUsers] = useState<RawUser[]>([]);
  const [courses, setCourses] = useState<RawCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [eRes, pRes, uRes, cRes] = await Promise.all([
          fetch("/api/enrollments?include=course"),
          fetch("/api/payments"),
          fetch("/api/users"),
          fetch("/api/courses"),
        ]);

        if (eRes.ok) setEnrollments((await eRes.json()).enrollments || []);
        if (pRes.ok) setPayments((await pRes.json()).payments || []);
        if (uRes.ok) setUsers((await uRes.json()).users || []);
        if (cRes.ok) setCourses((await cRes.json()).courses || []);
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[var(--muted-foreground)]">Loading analytics...</div>
      </div>
    );
  }

  /* ---------- Compute metrics ---------- */
  const activeEnrollments = enrollments.filter((e) => e.status === "active");
  const completedEnrollments = enrollments.filter((e) => e.status === "completed");
  const capturedPayments = payments.filter((p) => p.status === "captured");
  const totalRevenue = capturedPayments.reduce((s, p) => s + p.amount, 0) / 100;
  const refundedPayments = payments.filter((p) => p.status === "refunded" || p.status === "partially_refunded");
  const totalRefunds = refundedPayments.reduce((s, p) => s + p.amount, 0) / 100;
  const externalUsers = users.filter((u) => u.isExternal);
  const avgCompletion = enrollments.length > 0
    ? Math.round(enrollments.reduce((s, e) => s + (e.progress?.percentComplete || 0), 0) / enrollments.length)
    : 0;

  /* ---------- Enrollment trend (by month) ---------- */
  const enrollmentDates = enrollments
    .map((e) => tsToDate(e.enrolledAt))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const months = enrollmentDates.length > 0
    ? monthRange(enrollmentDates[0], new Date())
    : [];

  const enrollmentByMonth = groupByMonth(enrollments, (e) => tsToDate(e.enrolledAt));
  const enrollmentTrend = months.map((m) => ({
    month: m,
    enrollments: (enrollmentByMonth[m] || []).length,
  }));

  /* ---------- Revenue trend (by month) ---------- */
  const revenueByMonth = groupByMonth(capturedPayments, (p) => tsToDate(p.paidAt) || tsToDate(p.createdAt));
  const revenueTrend = months.map((m) => ({
    month: m,
    revenue: Math.round((revenueByMonth[m] || []).reduce((s, p) => s + p.amount, 0) / 100),
  }));

  /* ---------- Enrollment status distribution ---------- */
  const statusCounts: Record<string, number> = {};
  for (const e of enrollments) {
    statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
  }
  const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
    name: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    value: count,
    fill: STATUS_COLORS[status] || "#94a3b8",
  }));

  /* ---------- Course popularity (top 8) ---------- */
  const enrollmentsByCourse: Record<string, { title: string; count: number }> = {};
  for (const e of enrollments) {
    if (!enrollmentsByCourse[e.courseId]) {
      enrollmentsByCourse[e.courseId] = {
        title: e.courseTitle || courses.find((c) => c.id === e.courseId)?.title || "Unknown",
        count: 0,
      };
    }
    enrollmentsByCourse[e.courseId].count++;
  }
  const coursePopularity = Object.values(enrollmentsByCourse)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((c) => ({ name: c.title.length > 20 ? c.title.slice(0, 20) + "..." : c.title, students: c.count }));

  /* ---------- Completion rates per course ---------- */
  const completionByCourse: Record<string, { title: string; total: number; completed: number }> = {};
  for (const e of enrollments) {
    if (!completionByCourse[e.courseId]) {
      completionByCourse[e.courseId] = {
        title: e.courseTitle || courses.find((c) => c.id === e.courseId)?.title || "Unknown",
        total: 0,
        completed: 0,
      };
    }
    completionByCourse[e.courseId].total++;
    if (e.status === "completed") completionByCourse[e.courseId].completed++;
  }
  const completionRates = Object.values(completionByCourse)
    .filter((c) => c.total >= 1)
    .sort((a, b) => (b.completed / b.total) - (a.completed / a.total))
    .slice(0, 8)
    .map((c) => ({
      name: c.title.length > 20 ? c.title.slice(0, 20) + "..." : c.title,
      rate: Math.round((c.completed / c.total) * 100),
    }));

  /* ---------- User role distribution ---------- */
  const roleCounts: Record<string, number> = {};
  for (const u of users) {
    const role = (u.role || "student").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  }
  const roleDistribution = Object.entries(roleCounts).map(([name, value]) => ({ name, value }));

  /* ---------- KPI Cards ---------- */
  const kpiCards = [
    { label: "Total Users", value: users.length, sub: `${externalUsers.length} external`, color: "bg-blue-50 text-blue-700" },
    { label: "Active Courses", value: courses.filter((c) => c.status === "published").length, sub: `${courses.length} total`, color: "bg-purple-50 text-purple-700" },
    { label: "Active Enrollments", value: activeEnrollments.length, sub: `${completedEnrollments.length} completed`, color: "bg-green-50 text-green-700" },
    { label: "Revenue", value: `\u20B9${totalRevenue.toLocaleString("en-IN")}`, sub: `\u20B9${totalRefunds.toLocaleString("en-IN")} refunded`, color: "bg-emerald-50 text-emerald-700" },
    { label: "Avg Completion", value: `${avgCompletion}%`, sub: `${enrollments.length} enrollments`, color: "bg-orange-50 text-orange-700" },
    { label: "Payments", value: capturedPayments.length, sub: `${payments.filter((p) => p.status === "failed").length} failed`, color: "bg-gray-50 text-gray-700" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">Analytics</h1>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Overview of your institution&apos;s performance
      </p>

      {/* KPI Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpiCards.map((card) => (
          <div key={card.label} className={`rounded-xl p-5 ${card.color}`}>
            <div className="text-sm font-medium opacity-80">{card.label}</div>
            <div className="mt-1 text-2xl font-bold">{card.value}</div>
            <div className="mt-0.5 text-xs opacity-60">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Enrollment Trend */}
        <ChartCard title="Enrollment Trend" subtitle="New enrollments per month">
          {enrollmentTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={enrollmentTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }}
                />
                <Line type="monotone" dataKey="enrollments" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* Revenue Trend */}
        <ChartCard title="Revenue Trend" subtitle="Monthly revenue (INR)">
          {revenueTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `\u20B9${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }}
                  formatter={(value: number | undefined) => [`\u20B9${(value ?? 0).toLocaleString("en-IN")}`, "Revenue"]}
                />
                <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* Enrollment Status */}
        <ChartCard title="Enrollment Status" subtitle="Current distribution">
          {statusDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name} (${value})`}
                >
                  {statusDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* Course Popularity */}
        <ChartCard title="Course Popularity" subtitle="Enrollments per course (top 8)">
          {coursePopularity.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={coursePopularity} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }}
                />
                <Bar dataKey="students" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* Completion Rates */}
        <ChartCard title="Completion Rates" subtitle="% of enrolled students who completed">
          {completionRates.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={completionRates} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }}
                  formatter={(value: number | undefined) => [`${value ?? 0}%`, "Completion Rate"]}
                />
                <Bar dataKey="rate" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* User Roles */}
        <ChartCard title="User Roles" subtitle="Distribution by role">
          {roleDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={roleDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name} (${value})`}
                >
                  {roleDistribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs text-[var(--muted-foreground)] mb-4">{subtitle}</p>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-[var(--muted-foreground)]">
      No data available yet
    </div>
  );
}
