// src/components/notifications/AchievementToast.jsx
// Xbox-style achievement unlock toast notification.
// Slides up from the bottom, plays a sound, then auto-dismisses after 5s.
// Shows title, description, gamerscore, and a progress bar.
//
// ACCESSIBILITY: Not announced to screen readers. Should use
// role="alert" or aria-live="assertive" on the container.

import React, { useState, useEffect } from "react";
import { Trophy } from "lucide-react";
import { useTheme } from "../../components/theme/ThemeProvider";
import { useSoundEffect } from "../../utils/soundUtils";

const AchievementToast = ({ achievement }) => {
  const [show, setShow] = useState(false);
  const { theme } = useTheme();
  const { playAchievement } = useSoundEffect();

  // Show toast, play achievement sound, auto-hide after 5s
  useEffect(() => {
    setShow(true);
    playAchievement();
    const timer = setTimeout(() => setShow(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 w-[380px] transition-all duration-500 z-[9999] ${
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[500px]"
      }`}
    >
      <div
        className={`relative p-3 rounded-2xl shadow-xl border-2 flex items-center gap-3 achievement-pulse backdrop-blur-sm`}
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.9)), url('/src/assets/buck/Buck_Ani.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderColor: theme.achievementBorder,
          boxShadow: `0 0 15px ${theme.achievementBorder}`,
        }}
      >
        <div
          className="absolute inset-0 rounded-2xl achievement-glow opacity-50"
          style={{
            background: `linear-gradient(to right, ${theme.achievementGradientStart}, ${theme.achievementGradientEnd})`,
            filter: `blur(10px)`,
          }}
        />

        <div
          className="w-14 h-14 rounded-lg flex items-center justify-center relative achievement-icon-container border-2"
          style={{
            backgroundColor: theme.achievementIconBackground,
            borderColor: theme.achievementBorder,
          }}
        >
          <Trophy
            className="w-8 h-8 achievement-icon transform transition-transform duration-300 hover:scale-110"
            style={{ color: theme.achievementIcon }}
          />
        </div>

        <div className="flex-1 relative">
          <h3 className="text-lg font-bold mb-1" style={{ color: "#ffffff" }}>
            ACHIEVEMENT UNLOCKED
          </h3>
          <div className="flex items-baseline justify-between">
            <span
              className="font-medium text-base"
              style={{ color: "#FFD700" }}
            >
              {achievement.title}
            </span>
            <span className="font-mono text-lg">
              <span style={{ color: "#FFD700" }}>{achievement.gamerscore}</span>
              <span style={{ color: "#FFD700" }}>G</span>
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "#ffffff" }}>
            {achievement.description}
          </p>
          <div className="w-full h-1 mt-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full achievement-progress"
              style={{
                backgroundColor: theme.achievementProgress,
                width: `${(achievement.progress || 0) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AchievementToast;
