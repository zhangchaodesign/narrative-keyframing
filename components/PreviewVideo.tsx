"use client";

import { useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

export function PreviewVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);

    if (!nextMuted && video.paused) {
      void video.play().catch(() => undefined);
    }
  };

  return (
    <div className="video-placeholder">
      <video
        ref={videoRef}
        className="homepage-video"
        src="/NarrativeKeyframing30s.mp4"
        autoPlay
        muted={isMuted}
        loop
        playsInline
        preload="metadata"
        aria-label="Thirty-second preview of Narrative Keyframing"
      />
      <div className="video-paper-grain" aria-hidden="true" />
      <span className="video-kicker">30-second preview</span>
      <button
        type="button"
        className="video-sound-toggle"
        onClick={toggleSound}
        aria-label={isMuted ? "Turn preview sound on" : "Mute preview"}
        aria-pressed={!isMuted}
      >
        {isMuted ? (
          <Volume2 size={15} aria-hidden="true" />
        ) : (
          <VolumeX size={15} aria-hidden="true" />
        )}
        {isMuted ? "Sound off" : "Sound on"}
      </button>
      <div className="video-title">
        <small>Narrative Keyframing · UIST 2026</small>
      </div>
    </div>
  );
}
