"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Lesson {
  id: string;
  title: string;
  type: string;
  textContent?: string;
  estimatedMinutes: number;
  order: number;
}

interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: Lesson[];
}

interface CourseContent {
  id: string;
  title: string;
  modules: Module[];
}

interface Enrollment {
  id: string;
  status: string;
  progress: {
    completedLessons: number;
    totalLessons: number;
    percentComplete: number;
    lastLessonId: string | null;
  };
}

export default function LearnPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<CourseContent | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch course content
        const courseRes = await fetch(`/api/courses/${courseId}`);
        if (!courseRes.ok) {
          setError("Course not found");
          setLoading(false);
          return;
        }
        const courseData = await courseRes.json();
        setCourse(courseData);

        // Fetch enrollment
        const enrollRes = await fetch(`/api/enrollments?courseId=${courseId}`);
        if (enrollRes.ok) {
          const enrollData = await enrollRes.json();
          const enrollments = enrollData.enrollments || enrollData;
          const myEnrollment = (Array.isArray(enrollments) ? enrollments : []).find(
            (e: Enrollment) => e.status === "active"
          );
          if (myEnrollment) {
            setEnrollment(myEnrollment);

            // Set active lesson: last accessed or first lesson
            if (myEnrollment.progress?.lastLessonId && courseData.modules) {
              for (const mod of courseData.modules) {
                const found = mod.lessons.find(
                  (l: Lesson) => l.id === myEnrollment.progress.lastLessonId
                );
                if (found) {
                  setActiveLesson(found);
                  break;
                }
              }
            }
          } else {
            // Not enrolled — redirect to course detail
            router.push(`/courses/${courseId}`);
            return;
          }
        } else {
          router.push(`/courses/${courseId}`);
          return;
        }

        // Default to first lesson if none selected
        if (!activeLesson && courseData.modules?.[0]?.lessons?.[0]) {
          setActiveLesson(courseData.modules[0].lessons[0]);
        }
      } catch (err) {
        console.error("Failed to load course:", err);
        setError("Failed to load course content");
      } finally {
        setLoading(false);
      }
    }

    if (courseId) fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, router]);

  // Set default lesson after course loads
  useEffect(() => {
    if (!activeLesson && course?.modules?.[0]?.lessons?.[0]) {
      setActiveLesson(course.modules[0].lessons[0]);
    }
  }, [course, activeLesson]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-[var(--muted-foreground)]">Loading course...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-[var(--muted-foreground)]">{error || "Course not found"}</p>
          <button
            onClick={() => router.push("/courses")}
            className="mt-4 text-sm text-[var(--brand-primary)] hover:underline"
          >
            Back to courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 max-w-6xl">
      {/* Sidebar — Module & Lesson navigation */}
      <div className="w-72 shrink-0">
        <button
          onClick={() => router.push(`/courses/${courseId}`)}
          className="mb-4 text-sm text-[var(--muted-foreground)] hover:underline"
        >
          &larr; Back to course
        </button>

        <h2 className="text-lg font-bold mb-1">{course.title}</h2>

        {enrollment && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] mb-1">
              <span>Progress</span>
              <span>{enrollment.progress.percentComplete}%</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--brand-primary)] transition-all"
                style={{ width: `${enrollment.progress.percentComplete}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-3">
          {course.modules.map((module, mi) => (
            <div key={module.id}>
              <h3 className="text-xs font-semibold uppercase text-[var(--muted-foreground)] mb-1">
                Module {mi + 1}: {module.title}
              </h3>
              <ul className="space-y-0.5">
                {module.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <button
                      onClick={() => setActiveLesson(lesson)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeLesson?.id === lesson.id
                          ? "bg-[var(--brand-primary)] text-white"
                          : "hover:bg-[var(--muted)]"
                      }`}
                    >
                      <span className="mr-2 text-xs opacity-60">
                        {lesson.type === "video" ? "▶" : "📄"}
                      </span>
                      {lesson.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 min-w-0">
        {activeLesson ? (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-xl font-bold">{activeLesson.title}</h1>
              <span className="text-xs text-[var(--muted-foreground)]">
                {activeLesson.estimatedMinutes} min
              </span>
            </div>

            {activeLesson.type === "text" && activeLesson.textContent && (
              <div className="prose prose-sm max-w-none rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
                {activeLesson.textContent.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) {
                    return (
                      <h2 key={i} className="text-lg font-bold mt-4 mb-2">
                        {line.replace("## ", "")}
                      </h2>
                    );
                  }
                  if (line.startsWith("- **")) {
                    const match = line.match(/- \*\*(.+?)\*\*\s*[-–—]\s*(.+)/);
                    if (match) {
                      return (
                        <p key={i} className="ml-4 mb-1">
                          <strong>{match[1]}</strong> — {match[2]}
                        </p>
                      );
                    }
                  }
                  if (line.match(/^\d+\.\s\*\*/)) {
                    const match = line.match(/^\d+\.\s\*\*(.+?)\*\*\s*[-–—]\s*(.+)/);
                    if (match) {
                      return (
                        <p key={i} className="ml-4 mb-1">
                          <strong>{match[1]}</strong> — {match[2]}
                        </p>
                      );
                    }
                  }
                  if (line.trim() === "") return <br key={i} />;
                  return <p key={i} className="mb-2">{line}</p>;
                })}
              </div>
            )}

            {activeLesson.type === "video" && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
                <p className="text-[var(--muted-foreground)]">
                  Video player will be available soon.
                </p>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="mt-6 flex justify-between">
              {getPrevLesson() && (
                <button
                  onClick={() => setActiveLesson(getPrevLesson()!)}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--muted)]"
                >
                  &larr; Previous
                </button>
              )}
              <div />
              {getNextLesson() && (
                <button
                  onClick={() => setActiveLesson(getNextLesson()!)}
                  className="rounded-lg px-4 py-2 text-sm text-white"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  Next &rarr;
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center text-[var(--muted-foreground)]">
            <p>Select a lesson from the sidebar to get started.</p>
          </div>
        )}
      </div>
    </div>
  );

  function getAllLessons(): Lesson[] {
    if (!course) return [];
    return course.modules.flatMap((m) => m.lessons);
  }

  function getPrevLesson(): Lesson | null {
    const all = getAllLessons();
    const idx = all.findIndex((l) => l.id === activeLesson?.id);
    return idx > 0 ? all[idx - 1] : null;
  }

  function getNextLesson(): Lesson | null {
    const all = getAllLessons();
    const idx = all.findIndex((l) => l.id === activeLesson?.id);
    return idx < all.length - 1 ? all[idx + 1] : null;
  }
}
