"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Course {
  id: string;
  title: string;
  type: string;
  status: string;
  enrollmentCount: number;
  thumbnailUrl: string;
}

export default function InstructorCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const res = await fetch("/api/courses");
        if (res.ok) {
          const data = await res.json();
          setCourses(data.courses || []);
        }
      } catch (err) {
        console.error("Failed to fetch courses:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourses();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[var(--muted-foreground)]">Loading courses...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">My Courses</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        Select a course to manage content, sessions, attendance, and certificates.
      </p>

      {courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-[var(--muted-foreground)]">No courses assigned to you.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <div
              key={course.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden"
            >
              {/* Thumbnail */}
              <div
                className="h-24 flex items-center justify-center"
                style={{
                  background: course.thumbnailUrl
                    ? `url(${course.thumbnailUrl}) center/cover`
                    : `linear-gradient(135deg, var(--brand-primary), #6366f1)`,
                }}
              >
                {!course.thumbnailUrl && (
                  <span className="text-3xl font-bold text-white/80">
                    {course.title.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="p-4">
                <h3
                  className="font-semibold text-sm cursor-pointer hover:text-[var(--brand-primary)]"
                  onClick={() => router.push(`/instructor/courses/${course.id}/modules`)}
                >
                  {course.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[var(--muted-foreground)] capitalize">
                    {course.type?.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    &middot; {course.enrollmentCount || 0} students
                  </span>
                </div>

                {/* Icon action row */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => router.push(`/instructor/courses/${course.id}/modules`)}
                    title="Edit Content"
                    className="rounded-lg border border-[var(--border)] p-2 hover:bg-[var(--muted)]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => router.push(`/instructor/courses/${course.id}/sessions`)}
                    title="Sessions"
                    className="rounded-lg border border-[var(--border)] p-2 hover:bg-[var(--muted)]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                      <line x1="16" x2="16" y1="2" y2="6" />
                      <line x1="8" x2="8" y1="2" y2="6" />
                      <line x1="3" x2="21" y1="10" y2="10" />
                    </svg>
                  </button>
                  <button
                    onClick={() => router.push(`/instructor/courses/${course.id}/attendance`)}
                    title="Attendance"
                    className="rounded-lg border border-[var(--border)] p-2 hover:bg-[var(--muted)]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
                      <path d="m9 14 2 2 4-4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => router.push(`/instructor/courses/${course.id}/certificates`)}
                    title="Certificates"
                    className="rounded-lg border border-[var(--border)] p-2 hover:bg-[var(--muted)]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="6" />
                      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
