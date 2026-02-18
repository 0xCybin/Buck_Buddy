// src/components/settings/Credits.jsx
// Auto-scrolling credits panel with background music ("Still Alive").
// Triggers the "credits watched" achievement on first render.

import React, { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX } from "../../icons";
import { achievementTriggers } from "../../utils/achievementTriggers";

const Credits = () => {
  const [isMuted, setIsMuted] = useState(false);
  const [hasTriggeredAchievement, setHasTriggeredAchievement] = useState(false);

  // Persistent audio element -- survives re-renders
  const audioRef = useRef(
    new Audio(chrome.runtime.getURL("assets/sounds/Still_Alive.mp3"))
  );
  const backgroundImage = chrome.runtime.getURL("assets/buck/J_S.png");

  // Start music on mount, stop+reset on unmount.
  // Achievement fires once per component lifetime via the guard flag.
  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = 0.5;

    audio
      .play()
      .catch((error) => console.warn("Audio playback failed:", error));

    if (!hasTriggeredAchievement) {
      achievementTriggers.onCreditsWatched();
      setHasTriggeredAchievement(true);
    }

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [hasTriggeredAchievement]);

  const toggleMute = () => {
    audioRef.current.muted = !audioRef.current.muted;
    setIsMuted(!isMuted);
  };

  return (
    <div
      className="relative rounded-lg p-6 w-full h-96 overflow-hidden"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        border: '1px solid var(--border-primary)',
      }}
    >
      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Mute button */}
      <button
        onClick={toggleMute}
        className="absolute top-4 right-4 p-2 rounded-lg transition-colors z-10"
        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
      >
        {isMuted ? (
          <VolumeX className="w-4 h-4" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}
      </button>

      {/* Credits content */}
      <div className="relative h-full">
        <div className="credits-scroll absolute w-full">
          <div className="credits-content text-center space-y-16 py-8">
            <h2 className="text-3xl font-bold text-red-500">Buck Buddy</h2>

            <div className="space-y-8">
              <h3 className="text-2xl font-bold text-red-500">Art</h3>
              <div className="space-y-4">
                <p className="text-xl" style={{ color: 'var(--text-primary)' }}>
                  Art Direction & Doodles - Selena Evans
                </p>
                <p className="text-xl" style={{ color: 'var(--text-primary)' }}>
                  Lead Pixel Wrangler - Selena Evans
                </p>
                <p className="text-xl" style={{ color: 'var(--text-primary)' }}>
                  Chief Crayon Officer - Selena Evans
                </p>
                <p className="text-xl" style={{ color: 'var(--text-primary)' }}>
                  Master of RGB - Selena Evans
                </p>
                <p className="text-xl" style={{ color: 'var(--text-primary)' }}>
                  Professional Color Coordinator - Selena Evans
                </p>
              </div>
            </div>

            <div className="space-y-8">
              <h3 className="text-2xl font-bold text-red-500">Programming</h3>
              <div className="space-y-4">
                <p className="text-xl" style={{ color: 'var(--text-primary)' }}>
                  Senior Code Wizard - John Evans
                </p>
                <p className="text-xl" style={{ color: 'var(--text-primary)' }}>
                  Head Bug Creator & Solver - John Evans
                </p>
                <p className="text-xl" style={{ color: 'var(--text-primary)' }}>
                  Stack Overflow Search Expert - John Evans
                </p>
                <p className="text-xl" style={{ color: 'var(--text-primary)' }}>
                  Coffee-to-Code Converter - John Evans
                </p>
                <p className="text-xl" style={{ color: 'var(--text-primary)' }}>
                  Principal Keyboard Masher - John Evans
                </p>
              </div>
            </div>

            <div className="space-y-8">
              <h3 className="text-2xl font-bold text-red-500">
                Special Thanks
              </h3>
              <div className="space-y-4">
                <p className="text-xl" style={{ color: 'var(--text-primary)' }}>
                  Chief Rubber Duck Debugger - Eric Armstrong
                </p>
                <p className="text-xl" style={{ color: 'var(--text-primary)' }}>
                  Director of Semicolon Placement - Todd Jensen
                </p>
                <p className="text-xl" style={{ color: 'var(--text-primary)' }}>
                  VP of Ctrl+Z Operations - Graham Mitchell
                </p>
                <p className="text-xl" style={{ color: 'var(--text-primary)' }}>
                  Senior Snack Strategist - Lena Evans
                </p>
                <p className="text-xl" style={{ color: 'var(--text-primary)' }}>
                  Head of Meme Quality Assurance - Eric Armstrong
                </p>
                <p className="text-xl" style={{ color: 'var(--text-primary)' }}>
                  Director of Stack Overflow Copypasta - Brent Coleman
                </p>
                <p className="text-xl" style={{ color: 'var(--text-primary)' }}>
                  Professional Caffeine Engineer - Tavon Colbert
                </p>
              </div>
            </div>

            <div className="mt-16">
              <p style={{ color: 'var(--text-secondary)' }}>© 2025 Buck Buddy</p>
              <p style={{ color: 'var(--text-secondary)' }}>All Rights Reserved</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Credits;
