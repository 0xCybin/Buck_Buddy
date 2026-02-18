// src/components/common/SoundButton.jsx
// Drop-in <button> replacement that plays a sound effect on click.
// Supports three sound modes via props:
//   - isPageTransition + pageName: plays tab-switch sound
//   - isOffPage: plays the "off page" navigation sound
//   - default: plays a generic button click sound
// Passes all remaining props through to the underlying <button>.

import React from "react";
import { useSoundEffect } from "../../utils/soundUtils";

const SoundButton = ({
  onClick,
  children,
  className = "",
  style,
  disabled = false,
  isPageTransition = false,
  pageName = null,
  isOffPage = false,
  title,
  ...rest
}) => {
  const sounds = useSoundEffect();

  // Play the appropriate sound, then delegate to the caller's onClick
  const handleClick = (e) => {
    if (!disabled) {
      if (isPageTransition) {
        sounds.playPageTransition(pageName);
      } else if (isOffPage) {
        sounds.playPageTransition("offPage");
      } else {
        sounds.playButton();
      }

      // Call the original onClick handler
      onClick?.(e);
    }
  };

  const baseStyles =
    "transition-colors focus-ring-brand";
  const disabledStyles = disabled ? "opacity-50 cursor-not-allowed" : "";

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`${baseStyles} ${disabledStyles} ${className}`}
      style={style}
      title={title}
      {...rest}
    >
      {children}
    </button>
  );
};

export default SoundButton;
