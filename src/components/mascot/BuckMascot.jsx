// src/components/mascot/BuckMascot.jsx
// Buck mascot sprite renderer with eye-tracking.
// Renders a circular avatar that follows the cursor with animated eyes.
// During break time, swaps to a sleepy sprite with eyes hidden.
//
// BUG: Both eyes render Buck_L_Eye.png — the right eye (line 176)
// should use Buck_R_Eye.png instead.

import React, { useState, useEffect, useRef } from "react";
import { breakManager } from "../../utils/breakManager";

// Maps size prop names to pixel values for the container
const SIZE_MAP = {
  sm: 48,
  md: 64,
  lg: 80,
  header: 72,
};

const BuckMascot = ({ size = "md" }) => {
  const [eyeRotation, setEyeRotation] = useState({ x: 0, y: 0 }); // eye offset in px
  const [isBreakTime, setIsBreakTime] = useState(false);
  const containerRef = useRef(null);

  const pixels = SIZE_MAP[size] || SIZE_MAP.md;

  // Track cursor position and translate into clamped eye offsets using atan2
  useEffect(() => {
    if (isBreakTime) return;

    const handleMouseMove = (e) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;

      // Use atan2 for natural-feeling directional tracking, clamped tightly
      const angle = Math.atan2(deltaY, deltaX);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const maxEye = 6;
      const scale = Math.min(distance / 80, 1);

      setEyeRotation({
        x: Math.cos(angle) * maxEye * scale,
        y: Math.sin(angle) * maxEye * scale,
      });
    };

    // When cursor leaves the popup, extrapolate direction to the edge
    const handleMouseLeave = (e) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;

      const angle = Math.atan2(deltaY, deltaX);
      const maxEye = 6;

      setEyeRotation({
        x: Math.cos(angle) * maxEye,
        y: Math.sin(angle) * maxEye,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.documentElement.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isBreakTime]);

  // Sync break state from storage, messages, and a 60s polling fallback
  useEffect(() => {
    let breakCheckInterval;

    const checkBreakState = async () => {
      const currentBreak = await breakManager.getCurrentBreak();
      setIsBreakTime(!!currentBreak);
    };

    checkBreakState();

    const handleBreakMessages = (message) => {
      switch (message.type) {
        case "BREAK_TIME_START":
          setIsBreakTime(true);
          break;
        case "BREAK_ENDED":
          setIsBreakTime(false);
          break;
      }
    };

    const handleStorageChange = (changes) => {
      if (changes.currentBreak) {
        setIsBreakTime(!!changes.currentBreak.newValue);
      }
    };

    chrome.runtime.onMessage.addListener(handleBreakMessages);
    chrome.storage.onChanged.addListener(handleStorageChange);
    breakCheckInterval = setInterval(checkBreakState, 60000);

    return () => {
      clearInterval(breakCheckInterval);
      chrome.runtime.onMessage.removeListener(handleBreakMessages);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: `${pixels}px`,
        height: `${pixels}px`,
        minWidth: `${pixels}px`,
        minHeight: `${pixels}px`,
        position: "relative",
        flexShrink: 0,
        borderRadius: "50%",
        overflow: "hidden",
      }}
    >
      {/* Inner zoom wrapper -- scales 1.85x and shifts down to crop whitespace from source art */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: "scale(1.85) translateY(6%)",
          transformOrigin: "center center",
        }}
      >
        {/* Main Buck Image */}
        <img
          key={isBreakTime ? "sleepy" : "normal"}
          src={
            isBreakTime
              ? chrome.runtime.getURL("assets/buck/Sleepy_Buck_Artwork.png")
              : chrome.runtime.getURL("assets/buck/Buck.png")
          }
          alt="Buck"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          className={isBreakTime ? "sleepy-buck" : ""}
        />

        {/* Eyes */}
        {!isBreakTime && (
          <div style={{ position: "absolute", inset: 0 }}>
            {/* Left Eye */}
            <img
              src={chrome.runtime.getURL("assets/buck/Buck_L_Eye.png")}
              alt=""
              style={{
                position: "absolute",
                width: "200%",
                height: "200%",
                left: "0%",
                top: "-46%",
                transform: `translate(${eyeRotation.x * 0.12}px, ${eyeRotation.y * 0.08}px)`,
              }}
            />
            {/* Right Eye */}
            <img
              src={chrome.runtime.getURL("assets/buck/Buck_R_Eye.png")}
              alt=""
              style={{
                position: "absolute",
                width: "200%",
                height: "200%",
                left: "17%",
                top: "-46%",
                transform: `translate(${eyeRotation.x * 0.12}px, ${eyeRotation.y * 0.08}px)`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default BuckMascot;