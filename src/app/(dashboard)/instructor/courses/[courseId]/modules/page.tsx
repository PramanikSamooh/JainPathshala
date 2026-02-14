"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";
import { stripHtml } from "@/components/SafeHtml";

// ─── Types ──────────────────────────────────────────────

interface LessonSummary {
  id: string;
  title: string;
  type: string;
  order: number;
  isPublished: boolean;
  estimatedMinutes: number;
}

interface ModuleData {
  id: string;
  title: string;
  description: string;
  order: number;
  isPublished: boolean;
  lessonCount: number;
  lessons: LessonSummary[];
}

interface LessonFormData {
  title: string;
  type: string;
  order: number;
  isPublished: boolean;
  estimatedMinutes: number;
  videoConfig: {
    videoUrl: string;
    videoDurationSeconds: number;
    videoSource: string;
    youtubeVideoId: string | null;
    driveFileId: string | null;
    gcsPath: string | null;
    checkpoints: [];
    requireFullWatch: boolean;
  } | null;
  textContent: string | null;
  resources: { title: string; url: string; type: string; driveFileId: string | null }[];
  assignmentConfig: {
    classroomAssignmentId: string | null;
    instructions: string;
    maxPoints: number;
  } | null;
}

const LESSON_TYPES = [
  { value: "video", label: "Video" },
  { value: "text", label: "Text" },
  { value: "resource", label: "Resource" },
  { value: "assignment", label: "Assignment" },
];

const VIDEO_SOURCES = [
  { value: "youtube", label: "YouTube" },
  { value: "drive", label: "Google Drive" },
  { value: "gcs", label: "Cloud Storage" },
];

// ─── Helpers ──────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match?.[1] || null;
}

function extractDriveFileId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return idMatch?.[1] || null;
}

function emptyLessonForm(order: number): LessonFormData {
  return {
    title: "",
    type: "video",
    order,
    isPublished: false,
    estimatedMinutes: 10,
    videoConfig: {
      videoUrl: "",
      videoDurationSeconds: 0,
      videoSource: "youtube",
      youtubeVideoId: null,
      driveFileId: null,
      gcsPath: null,
      checkpoints: [],
      requireFullWatch: false,
    },
    textContent: null,
    resources: [],
    assignmentConfig: null,
  };
}

// ─── Component ──────────────────────────────────────────────

export default function ModulesPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Module form state
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [moduleForm, setModuleForm] = useState({ title: "", description: "" });
  const [savingModule, setSavingModule] = useState(false);

  // Lesson form state
  const [showLessonFormFor, setShowLessonFormFor] = useState<string | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState<LessonFormData>(emptyLessonForm(0));
  const [savingLesson, setSavingLesson] = useState(false);

  // Expanded modules
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const fetchModules = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/modules`);
      if (res.ok) {
        const data = await res.json();
        setModules(data.modules || []);
      }
    } catch (err) {
      console.error("Failed to fetch modules:", err);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) fetchModules();
  }, [courseId, fetchModules]);

  function showMsg(text: string, type: "success" | "error") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function toggleExpanded(moduleId: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }

  // ─── Module CRUD ──────────────────────────────────────────

  async function handleCreateModule(e: React.FormEvent) {
    e.preventDefault();
    setSavingModule(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: moduleForm.title,
          description: moduleForm.description,
          order: modules.length,
          isPublished: false,
          unlockAfterModuleId: null,
        }),
      });
      if (res.ok) {
        showMsg("Module created", "success");
        setShowModuleForm(false);
        setModuleForm({ title: "", description: "" });
        await fetchModules();
      } else {
        const data = await res.json();
        showMsg(data.error || "Failed to create module", "error");
      }
    } catch {
      showMsg("Failed to create module", "error");
    } finally {
      setSavingModule(false);
    }
  }

  async function handleUpdateModule(e: React.FormEvent) {
    e.preventDefault();
    if (!editingModuleId) return;
    setSavingModule(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/modules/${editingModuleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: moduleForm.title,
          description: moduleForm.description,
        }),
      });
      if (res.ok) {
        showMsg("Module updated", "success");
        setEditingModuleId(null);
        setShowModuleForm(false);
        setModuleForm({ title: "", description: "" });
        await fetchModules();
      } else {
        const data = await res.json();
        showMsg(data.error || "Failed to update module", "error");
      }
    } catch {
      showMsg("Failed to update module", "error");
    } finally {
      setSavingModule(false);
    }
  }

  async function handleDeleteModule(moduleId: string, title: string) {
    if (!confirm(`Delete module "${title}" and all its lessons? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/courses/${courseId}/modules/${moduleId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showMsg("Module deleted", "success");
        await fetchModules();
      } else {
        const data = await res.json();
        showMsg(data.error || "Failed to delete module", "error");
      }
    } catch {
      showMsg("Failed to delete module", "error");
    }
  }

  async function handleToggleModulePublish(moduleId: string, current: boolean) {
    try {
      const res = await fetch(`/api/courses/${courseId}/modules/${moduleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !current }),
      });
      if (res.ok) {
        showMsg(current ? "Module unpublished" : "Module published", "success");
        await fetchModules();
      }
    } catch {
      showMsg("Failed to toggle publish", "error");
    }
  }

  async function handleMoveModule(index: number, direction: "up" | "down") {
    const newModules = [...modules];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newModules.length) return;
    [newModules[index], newModules[swapIdx]] = [newModules[swapIdx], newModules[index]];

    try {
      const res = await fetch(`/api/courses/${courseId}/modules/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: newModules.map((m) => m.id) }),
      });
      if (res.ok) {
        setModules(newModules);
      }
    } catch {
      showMsg("Failed to reorder", "error");
    }
  }

  // ─── Lesson CRUD ──────────────────────────────────────────

  function startEditModule(mod: ModuleData) {
    setModuleForm({ title: mod.title, description: mod.description });
    setEditingModuleId(mod.id);
    setShowModuleForm(true);
  }

  function openLessonForm(moduleId: string, lesson?: LessonSummary) {
    setShowLessonFormFor(moduleId);
    if (lesson) {
      setEditingLessonId(lesson.id);
      // Fetch full lesson data
      fetchLessonDetail(moduleId, lesson.id);
    } else {
      setEditingLessonId(null);
      const mod = modules.find((m) => m.id === moduleId);
      setLessonForm(emptyLessonForm(mod?.lessons.length || 0));
    }
  }

  async function fetchLessonDetail(moduleId: string, lessonId: string) {
    try {
      const res = await fetch(`/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`);
      if (res.ok) {
        const data = await res.json();
        const l = data.lesson;
        setLessonForm({
          title: l.title,
          type: l.type,
          order: l.order,
          isPublished: l.isPublished,
          estimatedMinutes: l.estimatedMinutes,
          videoConfig: l.videoConfig || null,
          textContent: l.textContent || null,
          resources: l.resources || [],
          assignmentConfig: l.assignmentConfig || null,
        });
      }
    } catch (err) {
      console.error("Failed to fetch lesson:", err);
    }
  }

  function updateVideoUrl(url: string) {
    const videoConfig = lessonForm.videoConfig || {
      videoUrl: "",
      videoDurationSeconds: 0,
      videoSource: "youtube" as string,
      youtubeVideoId: null,
      driveFileId: null,
      gcsPath: null,
      checkpoints: [] as [],
      requireFullWatch: false,
    };

    const updates: Partial<typeof videoConfig> = { videoUrl: url };

    if (videoConfig.videoSource === "youtube") {
      updates.youtubeVideoId = extractYouTubeId(url);
    } else if (videoConfig.videoSource === "drive") {
      updates.driveFileId = extractDriveFileId(url);
    }

    setLessonForm({
      ...lessonForm,
      videoConfig: { ...videoConfig, ...updates },
    });
  }

  async function handleSaveLesson(e: React.FormEvent, moduleId: string) {
    e.preventDefault();
    setSavingLesson(true);

    // Build payload based on lesson type
    const payload: Record<string, unknown> = {
      title: lessonForm.title,
      type: lessonForm.type,
      order: lessonForm.order,
      isPublished: lessonForm.isPublished,
      estimatedMinutes: lessonForm.estimatedMinutes,
      textContent: lessonForm.type === "text" ? lessonForm.textContent : null,
      resources: lessonForm.type === "resource" ? lessonForm.resources : [],
      videoConfig: lessonForm.type === "video" ? lessonForm.videoConfig : null,
      assignmentConfig: lessonForm.type === "assignment" ? lessonForm.assignmentConfig : null,
    };

    try {
      const url = editingLessonId
        ? `/api/courses/${courseId}/modules/${moduleId}/lessons/${editingLessonId}`
        : `/api/courses/${courseId}/modules/${moduleId}/lessons`;

      const res = await fetch(url, {
        method: editingLessonId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showMsg(editingLessonId ? "Lesson updated" : "Lesson created", "success");
        setShowLessonFormFor(null);
        setEditingLessonId(null);
        await fetchModules();
      } else {
        const data = await res.json();
        showMsg(data.error || "Failed to save lesson", "error");
      }
    } catch {
      showMsg("Failed to save lesson", "error");
    } finally {
      setSavingLesson(false);
    }
  }

  async function handleDeleteLesson(moduleId: string, lessonId: string, title: string) {
    if (!confirm(`Delete lesson "${title}"?`)) return;
    try {
      const res = await fetch(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        showMsg("Lesson deleted", "success");
        await fetchModules();
      } else {
        const data = await res.json();
        showMsg(data.error || "Failed to delete lesson", "error");
      }
    } catch {
      showMsg("Failed to delete lesson", "error");
    }
  }

  async function handleToggleLessonPublish(moduleId: string, lessonId: string, current: boolean) {
    try {
      const res = await fetch(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublished: !current }),
        }
      );
      if (res.ok) {
        showMsg(current ? "Lesson unpublished" : "Lesson published", "success");
        await fetchModules();
      }
    } catch {
      showMsg("Failed to toggle publish", "error");
    }
  }

  async function handleMoveLesson(moduleId: string, lessons: LessonSummary[], index: number, direction: "up" | "down") {
    const newLessons = [...lessons];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newLessons.length) return;
    [newLessons[index], newLessons[swapIdx]] = [newLessons[swapIdx], newLessons[index]];

    try {
      const res = await fetch(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds: newLessons.map((l) => l.id) }),
        }
      );
      if (res.ok) {
        await fetchModules();
      }
    } catch {
      showMsg("Failed to reorder", "error");
    }
  }

  // ─── Render ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[var(--muted-foreground)]">Loading content...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Course Content</h1>
        <button
          onClick={() => {
            if (showModuleForm) {
              setShowModuleForm(false);
              setEditingModuleId(null);
              setModuleForm({ title: "", description: "" });
            } else {
              setShowModuleForm(true);
            }
          }}
          className="rounded-lg px-4 py-2 text-sm text-white"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          {showModuleForm ? "Cancel" : "+ New Module"}
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-lg p-3 text-sm ${
            message.type === "error"
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-600"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Module create/edit form */}
      {showModuleForm && (
        <form
          onSubmit={editingModuleId ? handleUpdateModule : handleCreateModule}
          className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4"
        >
          <h3 className="font-semibold text-sm">
            {editingModuleId ? "Edit Module" : "New Module"}
          </h3>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Title
            </label>
            <input
              type="text"
              required
              value={moduleForm.title}
              onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
              placeholder="Module title"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Description
            </label>
            <RichTextEditor
              value={moduleForm.description}
              onChange={(html) => setModuleForm({ ...moduleForm, description: html })}
              placeholder="Module description (optional)"
              minHeight="60px"
            />
          </div>
          <button
            type="submit"
            disabled={savingModule}
            className="rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {savingModule
              ? editingModuleId ? "Updating..." : "Creating..."
              : editingModuleId ? "Update Module" : "Create Module"}
          </button>
        </form>
      )}

      {/* Modules list */}
      {modules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-[var(--muted-foreground)]">
            No modules yet. Click &quot;+ New Module&quot; to add course content.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map((mod, modIdx) => (
            <div
              key={mod.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden"
            >
              {/* Module header */}
              <div className="p-4 flex items-center justify-between">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => toggleExpanded(mod.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {expandedModules.has(mod.id) ? "▼" : "▶"}
                    </span>
                    <h3 className="font-semibold text-sm">{mod.title}</h3>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        mod.isPublished
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {mod.isPublished ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)] ml-5">
                    {mod.lessonCount} lesson{mod.lessonCount !== 1 ? "s" : ""}
                    {mod.description && ` · ${stripHtml(mod.description)}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMoveModule(modIdx, "up")}
                    disabled={modIdx === 0}
                    className="rounded p-1 text-xs hover:bg-[var(--muted)] disabled:opacity-30"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveModule(modIdx, "down")}
                    disabled={modIdx === modules.length - 1}
                    className="rounded p-1 text-xs hover:bg-[var(--muted)] disabled:opacity-30"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleToggleModulePublish(mod.id, mod.isPublished)}
                    className="rounded-lg border border-[var(--border)] px-2 py-1 text-[10px] hover:bg-[var(--muted)]"
                  >
                    {mod.isPublished ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    onClick={() => startEditModule(mod)}
                    className="rounded-lg border border-[var(--border)] px-2 py-1 text-[10px] hover:bg-[var(--muted)]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteModule(mod.id, mod.title)}
                    className="rounded-lg border border-red-300 px-2 py-1 text-[10px] text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Expanded: lessons */}
              {expandedModules.has(mod.id) && (
                <div className="border-t border-[var(--border)] bg-[var(--background)] p-4">
                  {/* Lesson form */}
                  {showLessonFormFor === mod.id && (
                    <form
                      onSubmit={(e) => handleSaveLesson(e, mod.id)}
                      className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-3"
                    >
                      <h4 className="font-semibold text-xs">
                        {editingLessonId ? "Edit Lesson" : "New Lesson"}
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                            Title
                          </label>
                          <input
                            type="text"
                            required
                            value={lessonForm.title}
                            onChange={(e) =>
                              setLessonForm({ ...lessonForm, title: e.target.value })
                            }
                            placeholder="Lesson title"
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                            Type
                          </label>
                          <select
                            value={lessonForm.type}
                            onChange={(e) => {
                              const type = e.target.value;
                              setLessonForm({
                                ...lessonForm,
                                type,
                                videoConfig:
                                  type === "video"
                                    ? lessonForm.videoConfig || {
                                        videoUrl: "",
                                        videoDurationSeconds: 0,
                                        videoSource: "youtube",
                                        youtubeVideoId: null,
                                        driveFileId: null,
                                        gcsPath: null,
                                        checkpoints: [],
                                        requireFullWatch: false,
                                      }
                                    : null,
                                textContent: type === "text" ? lessonForm.textContent || "" : null,
                                assignmentConfig:
                                  type === "assignment"
                                    ? lessonForm.assignmentConfig || {
                                        classroomAssignmentId: null,
                                        instructions: "",
                                        maxPoints: 100,
                                      }
                                    : null,
                              });
                            }}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                          >
                            {LESSON_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                            Estimated Minutes
                          </label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={lessonForm.estimatedMinutes}
                            onChange={(e) =>
                              setLessonForm({
                                ...lessonForm,
                                estimatedMinutes: parseInt(e.target.value) || 1,
                              })
                            }
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                          />
                        </div>
                      </div>

                      {/* Video config */}
                      {lessonForm.type === "video" && lessonForm.videoConfig && (
                        <div className="space-y-3 border-t border-[var(--border)] pt-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                                Video Source
                              </label>
                              <select
                                value={lessonForm.videoConfig.videoSource}
                                onChange={(e) =>
                                  setLessonForm({
                                    ...lessonForm,
                                    videoConfig: {
                                      ...lessonForm.videoConfig!,
                                      videoSource: e.target.value,
                                      youtubeVideoId: null,
                                      driveFileId: null,
                                      gcsPath: null,
                                    },
                                  })
                                }
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                              >
                                {VIDEO_SOURCES.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                                Duration (seconds)
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={lessonForm.videoConfig.videoDurationSeconds}
                                onChange={(e) =>
                                  setLessonForm({
                                    ...lessonForm,
                                    videoConfig: {
                                      ...lessonForm.videoConfig!,
                                      videoDurationSeconds: parseInt(e.target.value) || 0,
                                    },
                                  })
                                }
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                                Video URL
                              </label>
                              <input
                                type="text"
                                required
                                value={lessonForm.videoConfig.videoUrl}
                                onChange={(e) => updateVideoUrl(e.target.value)}
                                placeholder={
                                  lessonForm.videoConfig.videoSource === "youtube"
                                    ? "https://youtube.com/watch?v=..."
                                    : lessonForm.videoConfig.videoSource === "drive"
                                      ? "https://drive.google.com/file/d/..."
                                      : "gs://bucket/path/video.mp4"
                                }
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                              />
                              {lessonForm.videoConfig.youtubeVideoId && (
                                <p className="mt-1 text-xs text-green-600">
                                  YouTube ID: {lessonForm.videoConfig.youtubeVideoId}
                                </p>
                              )}
                              {lessonForm.videoConfig.driveFileId && (
                                <p className="mt-1 text-xs text-green-600">
                                  Drive File ID: {lessonForm.videoConfig.driveFileId}
                                </p>
                              )}
                            </div>
                          </div>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={lessonForm.videoConfig.requireFullWatch}
                              onChange={(e) =>
                                setLessonForm({
                                  ...lessonForm,
                                  videoConfig: {
                                    ...lessonForm.videoConfig!,
                                    requireFullWatch: e.target.checked,
                                  },
                                })
                              }
                              className="h-3.5 w-3.5"
                            />
                            <span className="text-xs">Require full watch for completion</span>
                          </label>
                        </div>
                      )}

                      {/* Text content */}
                      {lessonForm.type === "text" && (
                        <div className="border-t border-[var(--border)] pt-3">
                          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                            Content
                          </label>
                          <RichTextEditor
                            value={lessonForm.textContent || ""}
                            onChange={(html) =>
                              setLessonForm({ ...lessonForm, textContent: html })
                            }
                            placeholder="Lesson text content..."
                            minHeight="150px"
                          />
                        </div>
                      )}

                      {/* Resource links */}
                      {lessonForm.type === "resource" && (
                        <div className="border-t border-[var(--border)] pt-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-[var(--muted-foreground)]">
                              Resources
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setLessonForm({
                                  ...lessonForm,
                                  resources: [
                                    ...lessonForm.resources,
                                    { title: "", url: "", type: "link", driveFileId: null },
                                  ],
                                })
                              }
                              className="text-xs text-blue-600 hover:underline"
                            >
                              + Add Resource
                            </button>
                          </div>
                          {lessonForm.resources.map((res, idx) => (
                            <div key={idx} className="grid gap-2 sm:grid-cols-3 items-end">
                              <input
                                type="text"
                                required
                                value={res.title}
                                onChange={(e) => {
                                  const r = [...lessonForm.resources];
                                  r[idx] = { ...r[idx], title: e.target.value };
                                  setLessonForm({ ...lessonForm, resources: r });
                                }}
                                placeholder="Title"
                                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                              />
                              <input
                                type="text"
                                required
                                value={res.url}
                                onChange={(e) => {
                                  const r = [...lessonForm.resources];
                                  const driveId = extractDriveFileId(e.target.value);
                                  r[idx] = {
                                    ...r[idx],
                                    url: e.target.value,
                                    driveFileId: driveId,
                                    type: driveId ? "drive_file" : r[idx].type,
                                  };
                                  setLessonForm({ ...lessonForm, resources: r });
                                }}
                                placeholder="URL"
                                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                              />
                              <div className="flex gap-2">
                                <select
                                  value={res.type}
                                  onChange={(e) => {
                                    const r = [...lessonForm.resources];
                                    r[idx] = { ...r[idx], type: e.target.value };
                                    setLessonForm({ ...lessonForm, resources: r });
                                  }}
                                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                                >
                                  <option value="link">Link</option>
                                  <option value="pdf">PDF</option>
                                  <option value="doc">Doc</option>
                                  <option value="drive_file">Drive</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const r = lessonForm.resources.filter((_, i) => i !== idx);
                                    setLessonForm({ ...lessonForm, resources: r });
                                  }}
                                  className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Assignment config */}
                      {lessonForm.type === "assignment" && lessonForm.assignmentConfig && (
                        <div className="border-t border-[var(--border)] pt-3 space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                              Instructions
                            </label>
                            <RichTextEditor
                              value={lessonForm.assignmentConfig.instructions}
                              onChange={(html) =>
                                setLessonForm({
                                  ...lessonForm,
                                  assignmentConfig: {
                                    ...lessonForm.assignmentConfig!,
                                    instructions: html,
                                  },
                                })
                              }
                              placeholder="Assignment instructions..."
                              minHeight="80px"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                              Max Points
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={lessonForm.assignmentConfig.maxPoints}
                              onChange={(e) =>
                                setLessonForm({
                                  ...lessonForm,
                                  assignmentConfig: {
                                    ...lessonForm.assignmentConfig!,
                                    maxPoints: parseInt(e.target.value) || 0,
                                  },
                                })
                              }
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={lessonForm.isPublished}
                            onChange={(e) =>
                              setLessonForm({ ...lessonForm, isPublished: e.target.checked })
                            }
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-xs">Published</span>
                        </label>
                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={() => {
                            setShowLessonFormFor(null);
                            setEditingLessonId(null);
                          }}
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingLesson}
                          className="rounded-lg px-3 py-1.5 text-xs text-white disabled:opacity-50"
                          style={{ backgroundColor: "var(--brand-primary)" }}
                        >
                          {savingLesson
                            ? "Saving..."
                            : editingLessonId ? "Update Lesson" : "Create Lesson"}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Lessons list */}
                  {mod.lessons.length === 0 && showLessonFormFor !== mod.id ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      No lessons yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {mod.lessons.map((lesson, lesIdx) => (
                        <div
                          key={lesson.id}
                          className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-medium">
                              {lesson.type}
                            </span>
                            <span className="text-sm">{lesson.title}</span>
                            <span className="text-[10px] text-[var(--muted-foreground)]">
                              {lesson.estimatedMinutes}m
                            </span>
                            <span
                              className={`text-[10px] ${
                                lesson.isPublished ? "text-green-600" : "text-yellow-600"
                              }`}
                            >
                              {lesson.isPublished ? "Published" : "Draft"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleMoveLesson(mod.id, mod.lessons, lesIdx, "up")}
                              disabled={lesIdx === 0}
                              className="rounded p-1 text-xs hover:bg-[var(--muted)] disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => handleMoveLesson(mod.id, mod.lessons, lesIdx, "down")}
                              disabled={lesIdx === mod.lessons.length - 1}
                              className="rounded p-1 text-xs hover:bg-[var(--muted)] disabled:opacity-30"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => handleToggleLessonPublish(mod.id, lesson.id, lesson.isPublished)}
                              className="rounded-lg border border-[var(--border)] px-2 py-0.5 text-[10px] hover:bg-[var(--muted)]"
                            >
                              {lesson.isPublished ? "Unpublish" : "Publish"}
                            </button>
                            <button
                              onClick={() => openLessonForm(mod.id, lesson)}
                              className="rounded-lg border border-[var(--border)] px-2 py-0.5 text-[10px] hover:bg-[var(--muted)]"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteLesson(mod.id, lesson.id, lesson.title)}
                              className="rounded-lg border border-red-300 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {showLessonFormFor !== mod.id && (
                    <button
                      onClick={() => openLessonForm(mod.id)}
                      className="mt-3 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)] w-full text-center"
                    >
                      + Add Lesson
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
