// src/components/overlay/BreakOverlay.jsx
// Full-screen overlay shown when a scheduled break begins.
// Displays a sleepy Buck graphic and a dismiss button.
// Listens for BREAK_TIME_START / BREAK_ENDED messages and storage changes
// to stay in sync with the background service worker's break state.
// Dismissal is persisted to storage so reopening the popup won't re-show it.

import React, { useState, useEffect } from "react";
import { breakManager } from "../../utils/breakManager";
import SoundButton from "../common/SoundButton";
import { useSoundEffect } from "../../utils/soundUtils";
import { achievementTriggers } from "../../utils/achievementTriggers";

const BreakOverlay = ({ type, onClose }) => {
  const [breakState, setBreakState] = useState(null);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const sounds = useSoundEffect();

  // Initialize break state and subscribe to runtime messages + storage changes
  useEffect(() => {
    const initializeState = async () => {
      const [currentBreak, dismissedState] = await Promise.all([
        breakManager.getCurrentBreak(),
        chrome.storage.local.get("overlayDismissed"),
      ]);

      if (currentBreak) {
        setBreakState(currentBreak);
        setOverlayDismissed(dismissedState.overlayDismissed || false);

        // Play sound only if overlay hasn't been dismissed
        if (!dismissedState.overlayDismissed) {
          sounds.playPageTransition("break");
        }
      }
    };

    initializeState();

    // Listen for break events
    const handleBreakMessages = async (message) => {
      switch (message.type) {
        case "BREAK_TIME_START":
          setBreakState(message.breakState);
          setOverlayDismissed(false);
          sounds.playPageTransition("break");

          if (message.breakState.type === "lunch") {
            await achievementTriggers.onLunchBreak();
          }
          break;
        case "BREAK_ENDED":
          setBreakState(null);
          setOverlayDismissed(false);
          onClose?.();
          break;
      }
    };

    // Listen for storage changes
    const handleStorageChange = (changes) => {
      if (changes.currentBreak) {
        const newBreak = changes.currentBreak.newValue;
        if (!newBreak) {
          setBreakState(null);
          setOverlayDismissed(false);
          onClose?.();
        } else {
          setBreakState(newBreak);
        }
      }
      if (changes.overlayDismissed) {
        setOverlayDismissed(changes.overlayDismissed.newValue || false);
      }
    };

    chrome.runtime.onMessage.addListener(handleBreakMessages);
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.runtime.onMessage.removeListener(handleBreakMessages);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [onClose, sounds]);

  // Nothing to show if no active break or already dismissed
  if (!breakState || overlayDismissed) return null;

  // Persist dismissal so reopening popup does not re-trigger the overlay
  const handleClose = async () => {
    await chrome.storage.local.set({ overlayDismissed: true });
    setOverlayDismissed(true);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 animate-fade-in">
      <div
        className="text-center relative p-8 rounded-lg"
        style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
      >
        <div className="relative w-40 h-40 mx-auto mb-8">
          <img
            src="/assets/buck/Sleepy_Buck_Artwork.png"
            alt="Sleepy Buck"
            className="w-full h-full object-contain animate-sleepy-buck"
          />
        </div>

        <h2 className="text-3xl font-bold mb-8" style={{ color: '#fff' }}>
          Time for {breakState.type === "lunch" ? "Lunch" : "a Break"}!
        </h2>

        <SoundButton
          onClick={handleClose}
          className="px-6 py-3 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--brand-primary)', color: '#fff' }}
        >
          Got it!
        </SoundButton>
      </div>
    </div>
  );
};

export default BreakOverlay;
