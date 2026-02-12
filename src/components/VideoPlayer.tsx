"use client";

import { useCallback, useEffect, useRef } from "react";
import YouTube, { YouTubeEvent, YouTubePlayer } from "react-youtube";

interface VideoCheckpoint {
  id: string;
  timestampSeconds: number;
  question: {
    type: string;
    questionText: string;
    options: { id: string; text: string }[];
    correctOptionId: string | null;
    correctAnswer: string | null;
    explanation: string;
  };
  isRequired: boolean;
}

interface VideoConfig {
  videoUrl: string;
  videoDurationSeconds: number;
  videoSource: string;
  youtubeVideoId: string | null;
  driveFileId: string | null;
  gcsPath: string | null;
  checkpoints: VideoCheckpoint[];
  requireFullWatch: boolean;
}

interface CheckpointResponse {
  selectedOptionId: string | null;
  textAnswer: string | null;
  isCorrect: boolean;
}

interface VideoPlayerProps {
  videoConfig: VideoConfig;
  initialPositionSeconds?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlay?: (time: number) => void;
  onPause?: (time: number) => void;
  onCheckpointReached?: (checkpoint: VideoCheckpoint) => void;
  onVideoComplete?: () => void;
  checkpointResponses?: Record<string, CheckpointResponse>;
}

export default function VideoPlayer({
  videoConfig,
  initialPositionSeconds = 0,
  onTimeUpdate,
  onPlay,
  onPause,
  onCheckpointReached,
  onVideoComplete,
  checkpointResponses = {},
}: VideoPlayerProps) {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTimeRef = useRef(0);
  const completedRef = useRef(false);
  const seekedRef = useRef(false);

  const clearInterval_ = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start polling current time when playing
  const startTimeTracking = useCallback(() => {
    clearInterval_();
    intervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      try {
        const currentTime = player.getCurrentTime();
        const duration = player.getDuration() || videoConfig.videoDurationSeconds;

        if (onTimeUpdate) {
          onTimeUpdate(currentTime, duration);
        }

        // Check checkpoints
        if (onCheckpointReached && videoConfig.checkpoints.length > 0) {
          for (const cp of videoConfig.checkpoints) {
            const alreadyAnswered = checkpointResponses[cp.id];
            const justPassed = currentTime >= cp.timestampSeconds && prevTimeRef.current < cp.timestampSeconds;
            if (!alreadyAnswered && justPassed) {
              player.pauseVideo();
              onCheckpointReached(cp);
              break;
            }
          }
        }

        // Check completion (90% watched)
        if (!completedRef.current && duration > 0 && currentTime >= duration * 0.9) {
          completedRef.current = true;
          if (onVideoComplete) onVideoComplete();
        }

        prevTimeRef.current = currentTime;
      } catch {
        // Player may not be ready
      }
    }, 1000);
  }, [clearInterval_, onTimeUpdate, onCheckpointReached, onVideoComplete, videoConfig, checkpointResponses]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearInterval_();
  }, [clearInterval_]);

  function handleReady(event: YouTubeEvent) {
    playerRef.current = event.target;
    // Seek to resume position
    if (initialPositionSeconds > 0 && !seekedRef.current) {
      seekedRef.current = true;
      event.target.seekTo(initialPositionSeconds, true);
    }
  }

  function handleStateChange(event: YouTubeEvent) {
    const state = event.data;
    const player = event.target;

    // YouTube states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
    if (state === 1) {
      // Playing
      const time = player.getCurrentTime();
      prevTimeRef.current = time;
      if (onPlay) onPlay(time);
      startTimeTracking();
    } else if (state === 2) {
      // Paused
      clearInterval_();
      const time = player.getCurrentTime();
      if (onPause) onPause(time);
    } else if (state === 0) {
      // Ended
      clearInterval_();
      if (!completedRef.current) {
        completedRef.current = true;
        if (onVideoComplete) onVideoComplete();
      }
    } else if (state === 3) {
      // Buffering (usually after seek)
      clearInterval_();
    }
  }

  // Resume video externally (after checkpoint dismiss)
  // Exposed via ref pattern - parent calls player.playVideo() through the checkpoint dismiss flow
  // For now, the parent just sets activeCheckpoint to null, and the player continues since YouTube auto-buffers

  // YouTube player
  if (videoConfig.videoSource === "youtube" && videoConfig.youtubeVideoId) {
    return (
      <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
        <YouTube
          videoId={videoConfig.youtubeVideoId}
          opts={{
            width: "100%",
            height: "100%",
            playerVars: {
              rel: 0,
              modestbranding: 1,
              enablejsapi: 1,
              origin: typeof window !== "undefined" ? window.location.origin : undefined,
            },
          }}
          onReady={handleReady}
          onStateChange={handleStateChange}
          className="absolute inset-0"
          iframeClassName="w-full h-full rounded-t-xl"
        />
      </div>
    );
  }

  // Drive video — embedded preview player
  if (videoConfig.videoSource === "drive" && videoConfig.driveFileId) {
    return (
      <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
        <iframe
          src={`https://drive.google.com/file/d/${videoConfig.driveFileId}/preview`}
          className="absolute inset-0 w-full h-full rounded-t-xl"
          allow="autoplay; encrypted-media"
          allowFullScreen
          sandbox="allow-same-origin allow-scripts allow-popups"
        />
      </div>
    );
  }

  // GCS or unknown — show link
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center" style={{ aspectRatio: "16/9" }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--muted-foreground)] mb-3">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
      <p className="text-[var(--muted-foreground)] mb-3">
        Video playback for this source is coming soon
      </p>
      {videoConfig.videoUrl && (
        <a
          href={videoConfig.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--brand-primary)] hover:underline"
        >
          Open video in new tab
        </a>
      )}
    </div>
  );
}

// Export a helper to resume playback (called after checkpoint dismiss)
export function resumePlayer(playerRef: React.RefObject<YouTubePlayer | null>) {
  if (playerRef.current) {
    playerRef.current.playVideo();
  }
}
