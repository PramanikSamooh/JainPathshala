"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface WatchedSegment {
  start: number;
  end: number;
}

interface VideoProgressState {
  currentPositionSeconds: number;
  totalDurationSeconds: number;
  watchedSeconds: number;
  watchedPercentage: number;
  isCompleted: boolean;
  checkpointResponses: Record<string, { selectedOptionId: string | null; textAnswer: string | null; isCorrect: boolean }>;
  watchedSegments: WatchedSegment[];
}

function mergeSegments(segments: WatchedSegment[]): WatchedSegment[] {
  if (segments.length <= 1) return segments;
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: WatchedSegment[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end + 1) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push(sorted[i]);
    }
  }
  return merged;
}

function computeWatchedSeconds(segments: WatchedSegment[]): number {
  return segments.reduce((sum, s) => sum + (s.end - s.start), 0);
}

interface UseVideoProgressParams {
  lessonId: string | null;
  moduleId: string | null;
  courseId: string;
}

export function useVideoProgress({ lessonId, moduleId, courseId }: UseVideoProgressParams) {
  const [videoProgress, setVideoProgress] = useState<VideoProgressState | null>(null);
  const [loading, setLoading] = useState(false);
  const progressRef = useRef<VideoProgressState | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSegmentStartRef = useRef<number | null>(null);
  const prevLessonIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    progressRef.current = videoProgress;
  }, [videoProgress]);

  // Flush pending save
  const flushSave = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const progress = progressRef.current;
    const lid = prevLessonIdRef.current;
    if (!progress || !lid || !moduleId) return;

    try {
      await fetch(`/api/video-progress/${lid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          courseId,
          currentPositionSeconds: progress.currentPositionSeconds,
          totalDurationSeconds: progress.totalDurationSeconds,
          watchedSeconds: progress.watchedSeconds,
          watchedPercentage: progress.watchedPercentage,
          isCompleted: progress.isCompleted,
          watchedSegments: progress.watchedSegments,
        }),
      });
    } catch (err) {
      console.error("Failed to save video progress:", err);
    }
  }, [moduleId, courseId]);

  // Fetch progress on lesson change
  useEffect(() => {
    if (!lessonId) {
      setVideoProgress(null);
      return;
    }

    // Flush previous lesson's progress
    if (prevLessonIdRef.current && prevLessonIdRef.current !== lessonId) {
      flushSave();
    }
    prevLessonIdRef.current = lessonId;
    currentSegmentStartRef.current = null;

    let cancelled = false;
    setLoading(true);

    async function fetchProgress() {
      try {
        const res = await fetch(`/api/video-progress/${lessonId}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.progress) {
            setVideoProgress({
              currentPositionSeconds: data.progress.currentPositionSeconds || 0,
              totalDurationSeconds: data.progress.totalDurationSeconds || 0,
              watchedSeconds: data.progress.watchedSeconds || 0,
              watchedPercentage: data.progress.watchedPercentage || 0,
              isCompleted: data.progress.isCompleted || false,
              checkpointResponses: data.progress.checkpointResponses || {},
              watchedSegments: data.progress.watchedSegments || [],
            });
          } else if (!cancelled) {
            setVideoProgress(null);
          }
        }
      } catch {
        // Ignore — start fresh
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProgress();
    return () => { cancelled = true; };
  }, [lessonId, flushSave]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      flushSave();
    };
  }, [flushSave]);

  // Called on play to start tracking a segment
  const startSegment = useCallback((time: number) => {
    currentSegmentStartRef.current = Math.floor(time);
  }, []);

  // Called on pause/seek to finalize current segment
  const endSegment = useCallback((time: number) => {
    const start = currentSegmentStartRef.current;
    if (start === null || start >= Math.floor(time)) {
      currentSegmentStartRef.current = null;
      return;
    }

    setVideoProgress((prev) => {
      if (!prev) return prev;
      const newSegment = { start, end: Math.floor(time) };
      const merged = mergeSegments([...prev.watchedSegments, newSegment]);
      const watchedSeconds = computeWatchedSeconds(merged);
      const watchedPercentage = prev.totalDurationSeconds > 0
        ? Math.min(100, Math.round((watchedSeconds / prev.totalDurationSeconds) * 100))
        : 0;
      return { ...prev, watchedSegments: merged, watchedSeconds, watchedPercentage };
    });
    currentSegmentStartRef.current = null;
  }, []);

  // Debounced progress update (called from VideoPlayer time updates)
  const updateProgress = useCallback(
    (currentTime: number, duration: number) => {
      setVideoProgress((prev) => {
        const base = prev || {
          currentPositionSeconds: 0,
          totalDurationSeconds: duration,
          watchedSeconds: 0,
          watchedPercentage: 0,
          isCompleted: false,
          checkpointResponses: {},
          watchedSegments: [],
        };

        // Update current segment inline
        const start = currentSegmentStartRef.current;
        let segments = base.watchedSegments;
        if (start !== null && Math.floor(currentTime) > start) {
          segments = mergeSegments([...segments, { start, end: Math.floor(currentTime) }]);
        }
        const watchedSeconds = computeWatchedSeconds(segments);
        const watchedPercentage = duration > 0
          ? Math.min(100, Math.round((watchedSeconds / duration) * 100))
          : 0;

        return {
          ...base,
          currentPositionSeconds: currentTime,
          totalDurationSeconds: duration,
          watchedSegments: segments,
          watchedSeconds,
          watchedPercentage,
        };
      });

      // Debounced save
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const progress = progressRef.current;
        if (!progress || !lessonId || !moduleId) return;
        fetch(`/api/video-progress/${lessonId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moduleId,
            courseId,
            currentPositionSeconds: progress.currentPositionSeconds,
            totalDurationSeconds: progress.totalDurationSeconds,
            watchedSeconds: progress.watchedSeconds,
            watchedPercentage: progress.watchedPercentage,
            isCompleted: progress.isCompleted,
            watchedSegments: progress.watchedSegments,
          }),
        }).catch((err) => console.error("Failed to save video progress:", err));
      }, 10000);
    },
    [lessonId, moduleId, courseId]
  );

  // Mark video as completed
  const markVideoCompleted = useCallback(() => {
    setVideoProgress((prev) => prev ? { ...prev, isCompleted: true } : prev);
    // Immediate save
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    const progress = progressRef.current;
    if (!progress || !lessonId || !moduleId) return;
    fetch(`/api/video-progress/${lessonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moduleId,
        courseId,
        currentPositionSeconds: progress.currentPositionSeconds,
        totalDurationSeconds: progress.totalDurationSeconds,
        watchedSeconds: progress.watchedSeconds,
        watchedPercentage: progress.watchedPercentage,
        isCompleted: true,
        watchedSegments: progress.watchedSegments,
      }),
    }).catch((err) => console.error("Failed to save video completion:", err));
  }, [lessonId, moduleId, courseId]);

  // Record a checkpoint response
  const recordCheckpoint = useCallback(
    async (checkpointId: string, response: { selectedOptionId: string | null; textAnswer: string | null; isCorrect: boolean }) => {
      if (!lessonId) return;
      try {
        await fetch(`/api/video-progress/${lessonId}/checkpoint`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checkpointId,
            selectedOptionId: response.selectedOptionId,
            textAnswer: response.textAnswer,
          }),
        });
        setVideoProgress((prev) => prev ? {
          ...prev,
          checkpointResponses: {
            ...prev.checkpointResponses,
            [checkpointId]: response,
          },
        } : prev);
      } catch (err) {
        console.error("Failed to record checkpoint:", err);
      }
    },
    [lessonId]
  );

  return {
    videoProgress,
    loading,
    updateProgress,
    startSegment,
    endSegment,
    markVideoCompleted,
    recordCheckpoint,
  };
}
