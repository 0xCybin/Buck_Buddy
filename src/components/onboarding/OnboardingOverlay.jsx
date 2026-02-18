// src/components/onboarding/OnboardingOverlay.jsx
// Interactive onboarding tutorial overlay.
// Buck (as an animated sprite) walks to UI targets, points at them,
// and explains features via a typewriter speech bubble. Supports:
//   - Name input (welcome step)
//   - Break time configuration
//   - Skip flow with surprised animation
//   - Step-by-step walk/point/talk phases with sprite sheet animation
//
// PERF: Sprite preload at lines 602-606 runs on every mount.
// Should be moved to module scope or behind a flag to avoid
// redundant Image() allocations on re-render.

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { achievementTriggers } from "../../utils/achievementTriggers";

// Step definitions: each step targets UI elements, positions Buck, and provides dialog text.
// Steps with inputType show interactive forms; skipPoint steps skip the pointing animation.
const ONBOARDING_STEPS = [
  {
    id: "welcome",
    tab: "data",
    targets: [],
    position: "center",
    buckSays: "Hey! I'm Buck! What should I call you?",
    description: "",
    title: "",
    inputType: "text",
    inputPlaceholder: "Enter your name",
    typeWhileWaving: true,
  },
  {
    id: "greet",
    tab: "data",
    targets: [],
    position: "center",
    buckSays: "", // Dynamic: resolved at runtime
    description: "",
    title: "",
  },
  {
    id: "data",
    tab: "data",
    targets: ['[data-onboarding="tab-data"]'],
    position: "below",
    buckSays: "I do the boring stuff so you don't have to!",
    description:
      "When you're on a Freshdesk ticket or Outlook email, I automatically pull out customer info, order numbers, tracking numbers, and more. No more copy-pasting!",
    title: "Your Data, Auto-Grabbed",
  },
  {
    id: "templates",
    tab: "templates",
    targets: ['[data-onboarding="tab-templates"]'],
    position: "below",
    buckSays: "Work smarter, not harder!",
    description:
      "Save your go-to replies as templates and paste them in one click. Create custom templates for common scenarios and speed through your queue!",
    title: "Quick Templates",
  },
  {
    id: "template-variables",
    tab: "templates",
    targets: ['[data-onboarding="tab-templates"]'],
    position: "below",
    skipPoint: true,
    buckSays: "Templates just got way smarter!",
    description:
      'Type {Order Number}, {Customer Name}, or any variable into a template and I\'ll auto-fill it with the real ticket data when you copy. No more switching tabs to grab info!',
    title: "Auto-Fill Variables",
  },
  {
    id: "tracking",
    tab: "templates",
    targets: ['[data-onboarding="btn-track"]'],
    position: "above",
    buckSays: "Where's that package? I'll find out!",
    description:
      "Hit the Track button, enter a FedEx or USPS tracking number, and get the latest status instantly. No need to open another tab!",
    title: "Track Any Package",
  },
  {
    id: "sku",
    tab: "templates",
    targets: ['[data-onboarding="btn-sku"]'],
    position: "above",
    buckSays: "Product info at your fingertips!",
    description:
      "Search GameStop products by SKU number. Get product details, pricing, and availability right inside the extension.",
    title: "Look Up Any SKU",
  },
  {
    id: "notes",
    tab: "templates",
    targets: ['[data-onboarding="btn-notes"]', '[data-onboarding="btn-remind"]'],
    position: "above",
    buckSays: "I'll remember so you don't have to!",
    description:
      "Keep quick notes for your shift and set timed reminders so you never forget a follow-up. Everything saves automatically! Don't need 'em? You can turn these off in Settings.",
    title: "Notes & Reminders",
  },
  {
    id: "stats",
    tab: "stats",
    targets: ['[data-onboarding="tab-stats"]'],
    position: "below",
    buckSays: "Gotta catch 'em all! ...wait, wrong franchise.",
    description:
      "Track your ticket count, unlock achievements, and earn Gamerscore as you work. Check the Stats tab to see your progress!",
    title: "Stats & Achievements",
  },
  {
    id: "lock",
    tab: "stats",
    targets: ['[data-onboarding="btn-lock"]'],
    position: "below",
    buckSays: "See that little lock icon up there?",
    description:
      "Unlock it and you can drag tabs and data groups around to arrange everything just the way you like. Lock it back when you're done!",
    title: "Rearrange Your Layout",
  },
  {
    id: "settings",
    tab: "stats",
    targets: ['[data-onboarding="btn-settings"]'],
    position: "below",
    buckSays: "There's a bunch of settings to explore!",
    description:
      "Customize themes, sounds, notifications, and more. You can also set break reminders here to help you stay on schedule. Want me to help you set up your breaks now?",
    title: "Settings & Customization",
  },
  {
    id: "ask-breaks",
    tab: "stats",
    targets: ['[data-onboarding="btn-settings"]'],
    position: "below",
    skipPoint: true,
    buckSays: "Just set your times and I'll give you a heads up when it's time for a break!",
    description: "",
    title: "Break Reminders",
    inputType: "breaks",
  },
  {
    id: "complete",
    tab: "stats",
    targets: [],
    position: "center",
    buckSays: "", // Dynamic: resolved at runtime
    description: "",
    title: "",
    typeWhileWaving: true,
  },
];

const SKIP_QUIP = "Skipping my tutorial?! You're either a time traveler or some kind of prodigy... My therapist warned me this would happen. Fine, at least tell me your name!";

// Animation timing and layout constants
const CURRENT_ONBOARDING_VERSION = 3;  // Bump to re-trigger onboarding for existing users
const SPRITE_FRAME_MS = 120;           // Delay between sprite sheet frames
const TYPE_SPEED_MS = 35;              // Delay between typed characters
const WAVE_PAUSE_FRAME = 2;            // Frame to hold on when wave finishes
const TALK_STOP_FRAME = 3;             // Frame to hold on when talking stops
const BUCK_SIZE = 80;                  // Sprite size in px
const WALK_PX_PER_SEC = 80;            // Walk animation speed
const WALK_MIN_MS = 600;
const WALK_MAX_MS = 2500;
const POPUP_WIDTH = 400;               // Assumed popup width for positioning
const ARRIVE_PAUSE_MS = 200;           // Pause after walk before talking
const POINT_ANIM_MS = 480;             // Duration of point-at-target animation
const POINT_HOLD_MS = 400;             // How long to hold the point before reversing
const EXHAUST_DURATION_MS = 1800;      // Exhausted animation before final wave

// Cardinal directions for walk sprite selection
const DIR_S = "south", DIR_E = "east", DIR_N = "north", DIR_W = "west";

// Sprite sheet configs: path relative to extension root, frame count per sheet
const WALK_SPRITES = {
  [DIR_E]: { path: "assets/buck/Buck_Walking_Right.png", frames: 4 },
  [DIR_W]: { path: "assets/buck/Buck_Walking_Left.png", frames: 5 },
  [DIR_N]: { path: "assets/buck/Buck_Walking_North.png", frames: 6 },
  [DIR_S]: { path: "assets/buck/Buck_Walking_South.png", frames: 6 },
};
const TALK_SPRITE      = { path: "assets/buck/Buck_Talking.png", frames: 4 };
const WAVE_SPRITE      = { path: "assets/buck/Buck_Waving.png", frames: 4 };
const POINT_SPRITE     = { path: "assets/buck/Buck_Pointing.png", frames: 4 };
const EXHAUST_SPRITE   = { path: "assets/buck/Buck_Exahusted.png", frames: 5 };
const SURPRISED_SPRITE = { path: "assets/buck/Buck_Surpised.png", frames: 4 };
const SURPRISED_SOUND  = "assets/sounds/Buck_Surprised_Sound.mp3";
const SURPRISED_DURATION_MS = 1500;

// Aggregated list for preloading on mount
const ALL_SPRITES = [
  ...Object.values(WALK_SPRITES),
  TALK_SPRITE, WAVE_SPRITE, POINT_SPRITE, EXHAUST_SPRITE, SURPRISED_SPRITE,
];

// Pick the dominant axis to determine which walk sprite to use
function getWalkDirection(from, to) {
  const dx = to.left - from.left;
  const dy = to.top - from.top;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? DIR_E : DIR_W;
  return dy > 0 ? DIR_S : DIR_N;
}

// Measure the bounding box of a step's target elements (union of all target rects)
function measureTargetRect(step) {
  const { targets } = step;
  if (!targets || targets.length === 0) return null;
  const rects = targets
    .map((sel) => document.querySelector(sel))
    .filter(Boolean)
    .map((el) => el.getBoundingClientRect());
  if (rects.length === 0) return null;
  return {
    top: Math.min(...rects.map((r) => r.top)),
    left: Math.min(...rects.map((r) => r.left)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
    width: Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left)),
    height: Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top)),
  };
}

// Center Buck horizontally and vertically in the popup (for intro/outro steps)
function getCenterPos() {
  const popupH = window.innerHeight;
  return {
    left: (POPUP_WIDTH - BUCK_SIZE) / 2,
    top: Math.max(20, (popupH - BUCK_SIZE) / 2 - 30),
  };
}

// Compute where Buck should stand relative to the step's target element
function computeTargetPosition(step) {
  if (step.position === "center") {
    return getCenterPos();
  }

  const popupH = window.innerHeight;
  const centerFallback = getCenterPos();
  const rect = measureTargetRect(step);
  if (!rect) return centerFallback;

  let left = rect.left + rect.width / 2 - BUCK_SIZE / 2;
  left = Math.max(8, Math.min(left, POPUP_WIDTH - BUCK_SIZE - 8));

  if (step.position === "above") {
    let top = rect.top - BUCK_SIZE - 8;
    if (top < 8) top = rect.bottom + 8;
    return { left, top };
  }

  // "below"
  let top = rect.bottom + 8;
  if (top + BUCK_SIZE > popupH - 10) top = rect.top - BUCK_SIZE - 8;
  return { left, top };
}

// Calculate walk animation duration based on pixel distance, clamped to min/max
function getWalkDuration(from, to) {
  const dx = to.left - from.left;
  const dy = to.top - from.top;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const ms = (dist / WALK_PX_PER_SEC) * 1000;
  return Math.max(WALK_MIN_MS, Math.min(ms, WALK_MAX_MS));
}

const OnboardingOverlay = ({ onComplete, setActiveTab }) => {
  // --- State ---
  const [currentStep, setCurrentStep] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  // Phase state machine: walking -> arrived -> [exhausted|pointing] -> [waving|talking] -> waitingForNext
  const [phase, setPhase] = useState("arrived");

  // Buck position (CSS-transitioned)
  const [buckPos, setBuckPos] = useState(() => getCenterPos());
  const [walkDuration, setWalkDuration] = useState(0);
  const [walkDirection, setWalkDirection] = useState(DIR_S);
  const [targetRect, setTargetRect] = useState(null);

  // Typewriter
  const [typingPhase, setTypingPhase] = useState("idle");
  const [displayedChars, setDisplayedChars] = useState(0);
  const [spriteFrame, setSpriteFrame] = useState(0);

  // Skip onboarding state
  const [skippedOnboarding, setSkippedOnboarding] = useState(false);

  // Input values for interactive steps
  const [inputValues, setInputValues] = useState({
    name: "",
    break1: "",
    break2: "",
    lunchStart: "",
    lunchEnd: "",
  });

  const typingInterval = useRef(null);
  const spriteInterval = useRef(null);
  const waveTimeout = useRef(null);
  const walkTimeout = useRef(null);
  const talkSound = useRef(null);
  const isTalking = useRef(false);
  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;
  const inputValuesRef = useRef(inputValues);
  inputValuesRef.current = inputValues;
  const buckPosRef = useRef(buckPos);
  buckPosRef.current = buckPos;

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const isTypingDone = typingPhase === "done";
  const isWalking = phase === "walking";

  // Intro phase: solid backdrop behind Buck during welcome (and skip flow) only
  const isIntroPhase = step.id === "welcome" || skippedOnboarding;

  // Resolve dynamic buckSays text
  const resolveBuckText = useCallback((s) => {
    const name = inputValuesRef.current.name.trim();
    if (s.id === "greet") return `Nice to meet you, ${name || "there"}! Welcome to Buck Buddy, your secret weapon for crushing tickets. I'll grab data, track packages, and keep you organized so you can focus on being awesome. Let me show you how it all works!`;
    if (s.id === "complete") return `See you around, ${name || "friend"}! I gotta get back to work.`;
    return s.buckSays;
  }, []);

  // Compute actual text for current step (render-side)
  const actualBuckSays = (() => {
    if (skippedOnboarding && step.id === "welcome") return SKIP_QUIP;
    const name = inputValues.name.trim();
    if (step.id === "greet") return `Nice to meet you, ${name || "there"}! Welcome to Buck Buddy, your secret weapon for crushing tickets. I'll grab data, track packages, and keep you organized so you can focus on being awesome. Let me show you how it all works!`;
    if (step.id === "complete") return `See you around, ${name || "friend"}! I gotta get back to work.`;
    return step.buckSays;
  })();

  // Displayed text slices
  const buckSaysText =
    typingPhase === "idle"
      ? ""
      : typingPhase === "buckSays"
        ? actualBuckSays.slice(0, displayedChars)
        : actualBuckSays;
  const descriptionText =
    typingPhase === "description"
      ? step.description.slice(0, displayedChars)
      : typingPhase === "done"
        ? step.description
        : "";

  const updateInput = (key, value) => {
    setInputValues((prev) => ({ ...prev, [key]: value }));
  };

  // --- Sound: looping talk audio that plays during typewriter ---
  const startTalkSound = useCallback(() => {
    if (isTalking.current) return;
    isTalking.current = true;
    try {
      if (!talkSound.current) {
        talkSound.current = new Audio(
          chrome.runtime.getURL("assets/buck/not_Animal_Crossing_sounds.mp3")
        );
        talkSound.current.loop = true;
        talkSound.current.volume = 0.3;
      }
      talkSound.current.currentTime = 0;
      talkSound.current.play().catch(() => {});
    } catch (e) {
      console.warn("Could not play talk sound:", e);
    }
  }, []);

  const stopTalkSound = useCallback(() => {
    isTalking.current = false;
    if (talkSound.current) {
      talkSound.current.pause();
      talkSound.current.currentTime = 0;
    }
  }, []);

  // --- Sprite frame animation (cycles through sheet frames on an interval) ---
  const spriteFrameCount = useRef(4);

  const startSpriteAnimation = useCallback((frameCount) => {
    if (spriteInterval.current) {
      clearInterval(spriteInterval.current);
      spriteInterval.current = null;
    }
    if (frameCount !== undefined) spriteFrameCount.current = frameCount;
    const fc = spriteFrameCount.current;
    spriteInterval.current = setInterval(() => {
      setSpriteFrame((prev) => (prev + 1) % fc);
    }, SPRITE_FRAME_MS);
  }, []);

  const stopSpriteAnimation = useCallback((frame) => {
    if (spriteInterval.current) {
      clearInterval(spriteInterval.current);
      spriteInterval.current = null;
    }
    setSpriteFrame(frame !== undefined ? frame : TALK_STOP_FRAME);
  }, []);

  // --- Typewriter engine: types buckSays, then description, then marks done ---
  const stopTyping = useCallback(() => {
    if (typingInterval.current) {
      clearInterval(typingInterval.current);
      typingInterval.current = null;
    }
    if (waveTimeout.current) {
      clearTimeout(waveTimeout.current);
      waveTimeout.current = null;
    }
    stopTalkSound();
    stopSpriteAnimation();
  }, [stopTalkSound, stopSpriteAnimation]);

  const startTypingPhase = useCallback(
    (tPhase, text) => {
      stopTyping();
      setTypingPhase(tPhase);
      setDisplayedChars(0);
      if (tPhase === "done") return;

      // Skip empty text gracefully
      if (!text) {
        if (tPhase === "buckSays") {
          const s = ONBOARDING_STEPS[currentStepRef.current];
          if (s && s.description) {
            setTimeout(() => startTypingPhase("description", s.description), 300);
          } else {
            setTypingPhase("done");
          }
        } else {
          setTypingPhase("done");
        }
        return;
      }

      startTalkSound();
      startSpriteAnimation(TALK_SPRITE.frames);

      let charIndex = 0;
      typingInterval.current = setInterval(() => {
        charIndex++;
        setDisplayedChars(charIndex);
        if (charIndex >= text.length) {
          clearInterval(typingInterval.current);
          typingInterval.current = null;
          if (tPhase === "buckSays") {
            setTimeout(() => {
              const s = ONBOARDING_STEPS[currentStepRef.current];
              if (s) startTypingPhase("description", s.description);
            }, 300);
          } else {
            stopTalkSound();
            stopSpriteAnimation();
            setTypingPhase("done");
          }
        }
      }, TYPE_SPEED_MS);
    },
    [stopTyping, startTalkSound, stopTalkSound, startSpriteAnimation, stopSpriteAnimation]
  );

  // ── Clear walk timer ──────────────────────────────────────────────────────
  const clearWalkTimer = useCallback(() => {
    if (walkTimeout.current) {
      clearTimeout(walkTimeout.current);
      walkTimeout.current = null;
    }
  }, []);

  // After Buck arrives at a target, begin the talk sequence (optionally wave/point first)
  const beginTalking = useCallback(
    (stepIndex) => {
      const s = ONBOARDING_STEPS[stepIndex];
      const isCompleteStep = stepIndex === ONBOARDING_STEPS.length - 1;
      const shouldSkipPoint =
        s.position === "above" || s.skipPoint || !s.targets || s.targets.length === 0;
      const buckText = resolveBuckText(s);

      // Helper: wave animation + type simultaneously (for welcome & complete)
      const waveAndType = (text) => {
        setPhase("waving");
        setSpriteFrame(0);
        startSpriteAnimation(WAVE_SPRITE.frames);
        setTypingPhase("buckSays");
        setDisplayedChars(0);
        startTalkSound();

        let charIndex = 0;
        typingInterval.current = setInterval(() => {
          charIndex++;
          setDisplayedChars(charIndex);
          if (charIndex >= text.length) {
            clearInterval(typingInterval.current);
            typingInterval.current = null;
            stopTalkSound();
            stopSpriteAnimation(WAVE_PAUSE_FRAME);
            setTypingPhase("done");
          }
        }, TYPE_SPEED_MS);
      };

      if (s.typeWhileWaving) {
        stopTyping();
        if (isCompleteStep) {
          // Exhausted → wave + type
          setPhase("exhausted");
          setSpriteFrame(0);
          startSpriteAnimation(EXHAUST_SPRITE.frames);
          waveTimeout.current = setTimeout(() => {
            stopSpriteAnimation(0);
            waveAndType(buckText);
          }, EXHAUST_DURATION_MS);
        } else {
          // Welcome: wave + type immediately
          waveAndType(buckText);
        }
      } else if (shouldSkipPoint) {
        setPhase("talking");
        startTypingPhase("buckSays", buckText);
      } else {
        // Point → hold → reverse → talk
        setPhase("pointing");
        setSpriteFrame(0);
        startSpriteAnimation(POINT_SPRITE.frames);
        waveTimeout.current = setTimeout(() => {
          stopSpriteAnimation(POINT_SPRITE.frames - 1);
          waveTimeout.current = setTimeout(() => {
            let reverseFrame = POINT_SPRITE.frames - 1;
            spriteInterval.current = setInterval(() => {
              reverseFrame--;
              setSpriteFrame(reverseFrame);
              if (reverseFrame <= 0) {
                clearInterval(spriteInterval.current);
                spriteInterval.current = null;
                waveTimeout.current = null;
                setPhase("talking");
                startTypingPhase("buckSays", buckText);
              }
            }, SPRITE_FRAME_MS);
          }, POINT_HOLD_MS);
        }, POINT_ANIM_MS);
      }
    },
    [stopTyping, startSpriteAnimation, stopSpriteAnimation, startTypingPhase, startTalkSound, stopTalkSound, resolveBuckText]
  );

  // Switch to a new step: change tab, walk Buck to the target, then begin talking
  const navigateToStep = useCallback(
    (newIndex) => {
      stopTyping();
      clearWalkTimer();
      // Immediately hide bubble to prevent text flash
      setPhase("walking");
      setTypingPhase("idle");
      setDisplayedChars(0);

      const s = ONBOARDING_STEPS[newIndex];

      if (setActiveTab && s.tab) {
        setActiveTab(s.tab);
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const currentPos = buckPosRef.current;
          const targetPos = computeTargetPosition(s);
          const rect = measureTargetRect(s);
          setTargetRect(rect);

          const dx = targetPos.left - currentPos.left;
          const dy = targetPos.top - currentPos.top;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 15) {
            setBuckPos(targetPos);
            setWalkDuration(0);
            setPhase("arrived");
            beginTalking(newIndex);
          } else {
            const dir = getWalkDirection(currentPos, targetPos);
            setWalkDirection(dir);
            const walkSpriteConfig = WALK_SPRITES[dir];
            const duration = getWalkDuration(currentPos, targetPos);

            setWalkDuration(duration);
            setPhase("walking");
            setSpriteFrame(0);
            startSpriteAnimation(walkSpriteConfig.frames);

            requestAnimationFrame(() => {
              setBuckPos(targetPos);
              walkTimeout.current = setTimeout(() => {
                stopSpriteAnimation(0);
                setPhase("arrived");
                walkTimeout.current = setTimeout(() => {
                  beginTalking(newIndex);
                }, ARRIVE_PAUSE_MS);
              }, duration);
            });
          }
        });
      });
    },
    [stopTyping, clearWalkTimer, setActiveTab, startSpriteAnimation, stopSpriteAnimation, beginTalking]
  );

  // Mount: preload all sprite sheets and kick off the welcome step.
  // PERF: This preload runs every mount -- should be hoisted to module scope.
  useEffect(() => {
    ALL_SPRITES.forEach(({ path }) => {
      const img = new Image();
      img.src = chrome.runtime.getURL(path);
    });

    setBuckPos(getCenterPos());
    setWalkDuration(0);

    if (setActiveTab) setActiveTab("data");

    const t = setTimeout(() => {
      beginTalking(0);
    }, 300);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTyping();
      clearWalkTimer();
      if (talkSound.current) {
        talkSound.current.pause();
        talkSound.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Visibility ────────────────────────────────────────────────────────────
  const showBubble = phase === "talking" || phase === "waving" || phase === "waitingForNext";

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSkipText = (e) => {
    if (e) e.stopPropagation();
    if (!showBubble) return;
    stopTyping();
    setTypingPhase("done");
    setDisplayedChars(0);
    if (phase === "waving") {
      // Keep wave sprite on a nice held frame
      setSpriteFrame(WAVE_PAUSE_FRAME);
    } else {
      setPhase("waitingForNext");
    }
  };

  const handleNext = (e) => {
    if (e) e.stopPropagation();
    if (!isTypingDone) return;

    // Save name on welcome step
    if (step.id === "welcome" && inputValues.name.trim()) {
      chrome.storage.local.set({ userName: inputValues.name.trim() });
    }

    // If onboarding was skipped, finish after name entry
    if (skippedOnboarding && step.id === "welcome") {
      handleFinish(false);
      return;
    }

    // Save breaks on ask-breaks step
    if (step.id === "ask-breaks") {
      saveBreakTimes();
    }

    if (isLastStep) {
      handleFinish(true);
    } else {
      const next = currentStep + 1;
      setCurrentStep(next);
      navigateToStep(next);
    }
  };

  const handleSkipBreaks = (e) => {
    if (e) e.stopPropagation();
    if (!isTypingDone) return;
    // Advance without saving breaks
    const next = currentStep + 1;
    setCurrentStep(next);
    navigateToStep(next);
  };

  // Settings step: Yes → ask-breaks, No → complete
  const handleBreaksYes = (e) => {
    if (e) e.stopPropagation();
    const idx = ONBOARDING_STEPS.findIndex((s) => s.id === "ask-breaks");
    if (idx !== -1) {
      setCurrentStep(idx);
      navigateToStep(idx);
    }
  };

  const handleBreaksNo = (e) => {
    if (e) e.stopPropagation();
    const idx = ONBOARDING_STEPS.findIndex((s) => s.id === "complete");
    if (idx !== -1) {
      setCurrentStep(idx);
      navigateToStep(idx);
    }
  };

  const saveBreakTimes = () => {
    const bt = {};
    const bd = {};
    if (inputValues.break1) { bt.break1 = inputValues.break1; bd.break1 = 15; }
    if (inputValues.break2) { bt.break2 = inputValues.break2; bd.break2 = 15; }
    if (inputValues.lunchStart) {
      bt.lunch = inputValues.lunchStart;
      if (inputValues.lunchEnd) {
        const [sh, sm] = inputValues.lunchStart.split(":").map(Number);
        const [eh, em] = inputValues.lunchEnd.split(":").map(Number);
        const dur = eh * 60 + em - (sh * 60 + sm);
        bd.lunch = dur > 0 ? dur : 30;
      } else {
        bd.lunch = 30;
      }
    }
    if (Object.keys(bt).length > 0) {
      chrome.storage.local.set({ breakTimes: bt, breakDurations: bd });
    }
  };

  const handleDialogClick = () => {
    if (!showBubble || isTypingDone) return;
    handleSkipText();
  };

  const handleSkipOnboarding = (e) => {
    if (e) e.stopPropagation();
    const name = inputValues.name.trim();

    // Name already entered — skip immediately, no quip needed
    if (name) {
      chrome.storage.local.set({ userName: name });
      handleFinish(false);
      return;
    }

    // No name yet — play surprised animation, then show the quip + ask for name
    setSkippedOnboarding(true);

    // Navigate back to welcome step if we're past it
    if (currentStep !== 0) {
      setCurrentStep(0);
      if (setActiveTab) setActiveTab("data");
    }

    stopTyping();
    clearWalkTimer();

    // Center Buck and play surprised animation + sound
    setBuckPos(getCenterPos());
    setWalkDuration(0);
    setTargetRect(null);
    setPhase("surprised");
    setSpriteFrame(0);
    startSpriteAnimation(SURPRISED_SPRITE.frames);

    // Play surprised sound
    try {
      const surprisedAudio = new Audio(chrome.runtime.getURL(SURPRISED_SOUND));
      surprisedAudio.volume = 0.4;
      surprisedAudio.play().catch(() => {});
    } catch (e) {
      console.warn("Could not play surprised sound:", e);
    }

    // After surprised animation, transition to typing the quip
    waveTimeout.current = setTimeout(() => {
      stopSpriteAnimation(SURPRISED_SPRITE.frames - 1);
      setPhase("waving");
      setSpriteFrame(0);
      startSpriteAnimation(WAVE_SPRITE.frames);
      setTypingPhase("buckSays");
      setDisplayedChars(0);
      startTalkSound();

      let charIndex = 0;
      typingInterval.current = setInterval(() => {
        charIndex++;
        setDisplayedChars(charIndex);
        if (charIndex >= SKIP_QUIP.length) {
          clearInterval(typingInterval.current);
          typingInterval.current = null;
          stopTalkSound();
          stopSpriteAnimation(WAVE_PAUSE_FRAME);
          setTypingPhase("done");
        }
      }, TYPE_SPEED_MS);
    }, SURPRISED_DURATION_MS);
  };

  // Mark onboarding complete in storage and optionally trigger the achievement
  const handleFinish = async (completed) => {
    stopTyping();
    clearWalkTimer();
    setIsExiting(true);
    await chrome.storage.local.set({
      onboarding_completed: true,
      onboarding_version: CURRENT_ONBOARDING_VERSION,
    });
    if (completed) {
      try {
        await achievementTriggers.onOnboardingComplete();
      } catch (err) {
        console.error("Onboarding achievement error:", err);
      }
    }
    setTimeout(() => onComplete(), 300);
  };

  // Select the active sprite sheet based on current phase, clamp frame index
  let activeSpriteConfig;
  if (phase === "walking") {
    activeSpriteConfig = WALK_SPRITES[walkDirection];
  } else if (phase === "exhausted") {
    activeSpriteConfig = EXHAUST_SPRITE;
  } else if (phase === "surprised") {
    activeSpriteConfig = SURPRISED_SPRITE;
  } else if (phase === "pointing") {
    activeSpriteConfig = POINT_SPRITE;
  } else if (phase === "waving") {
    activeSpriteConfig = WAVE_SPRITE;
  } else {
    activeSpriteConfig = TALK_SPRITE;
  }
  const spriteSheet = chrome.runtime.getURL(activeSpriteConfig.path);
  const totalFrames = activeSpriteConfig.frames;
  const activeFrame = Math.min(spriteFrame, totalFrames - 1);
  const spritePos =
    totalFrames > 1
      ? `${(activeFrame / (totalFrames - 1)) * 100}% 0%`
      : "0% 0%";

  // Position the speech bubble below Buck if room, otherwise flip above
  const bubbleBelow = buckPos.top + BUCK_SIZE + 8;
  const bubbleAbove = buckPos.top - 8;
  const popupH = window.innerHeight;
  const flipBubbleAbove = bubbleBelow + 100 > popupH - 20;
  const bubbleTop = flipBubbleAbove ? undefined : bubbleBelow;
  const bubbleBottom = flipBubbleAbove ? popupH - bubbleAbove : undefined;

  let bubbleLeft = buckPos.left + BUCK_SIZE / 2 - 150;
  bubbleLeft = Math.max(8, Math.min(bubbleLeft, POPUP_WIDTH - 308));

  const arrowLeft = Math.max(20, Math.min(buckPos.left + BUCK_SIZE / 2 - bubbleLeft, 280));

  // ── Computed state ────────────────────────────────────────────────────────
  const hasTarget = !!targetRect;

  // Next button disabled state
  const nextDisabled = step.inputType === "text" && !inputValues.name.trim();

  // ── Input styles ──────────────────────────────────────────────────────────
  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border-primary)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
  };

  const timeInputStyle = {
    ...inputStyle,
    width: "100%",
    padding: "6px 8px",
    fontSize: "12px",
  };

  const labelStyle = {
    fontSize: "10px",
    fontWeight: 600,
    color: "var(--text-tertiary)",
    marginBottom: "2px",
    display: "block",
  };

  const secondaryBtnStyle = {
    padding: "5px 14px",
    borderRadius: "8px",
    border: "1px solid var(--border-primary)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-secondary)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease",
  };

  const primaryBtnStyle = {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "5px 14px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "var(--brand-primary)",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease",
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      onClick={handleDialogClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        pointerEvents: "none",
        opacity: isExiting ? 0 : 1,
        transition: "opacity 0.3s ease",
      }}
    >
      {/* ── Intro backdrop — solid background during welcome/greet, fades when tutorial starts ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "var(--bg-primary)",
          opacity: isIntroPhase ? 1 : 0,
          transition: "opacity 0.5s ease",
          pointerEvents: isIntroPhase ? "auto" : "none",
          zIndex: 61,
        }}
      />

      {/* ── Highlight ring around target element ── */}
      {hasTarget && !isWalking && (
        <div
          style={{
            position: "absolute",
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            borderRadius: "12px",
            border: "2.5px solid var(--brand-primary)",
            pointerEvents: "none",
            zIndex: 65,
            animation: "onboarding-pulse 2s ease-in-out infinite",
            transition: "top 0.35s ease, left 0.35s ease, width 0.35s ease, height 0.35s ease",
          }}
        />
      )}

      {/* ── Buck sprite ── */}
      <div
        style={{
          position: "absolute",
          left: buckPos.left,
          top: buckPos.top,
          width: BUCK_SIZE,
          height: BUCK_SIZE,
          backgroundImage: `url(${spriteSheet})`,
          backgroundSize: `${totalFrames * 100}% 100%`,
          backgroundPosition: spritePos,
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
          pointerEvents: "auto",
          cursor: "pointer",
          transition: `left ${walkDuration}ms ease-in-out, top ${walkDuration}ms ease-in-out, transform 0.15s ease`,
          transform:
            !isWalking &&
            (phase === "waving" || (!isTypingDone && phase === "talking"))
              ? "scale(1.05)"
              : "scale(1)",
          zIndex: 62,
        }}
      />

      {/* ── Speech bubble ── */}
      {showBubble && (
        <div
          style={{
            position: "absolute",
            left: bubbleLeft,
            ...(bubbleTop !== undefined ? { top: bubbleTop } : {}),
            ...(bubbleBottom !== undefined ? { bottom: bubbleBottom } : {}),
            width: 300,
            backgroundColor: "var(--card-bg)",
            border: "2px solid var(--brand-primary)",
            borderRadius: "16px",
            padding: "10px 14px",
            pointerEvents: "auto",
            cursor: !isTypingDone ? "pointer" : "default",
            zIndex: 63,
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            transition: "left 0.3s ease, top 0.3s ease, bottom 0.3s ease",
          }}
        >
          {/* Arrow pointing at Buck */}
          <div
            style={{
              position: "absolute",
              [flipBubbleAbove ? "bottom" : "top"]: "-9px",
              left: arrowLeft,
              transform: flipBubbleAbove ? "rotate(180deg)" : "none",
              width: 0,
              height: 0,
              borderLeft: "9px solid transparent",
              borderRight: "9px solid transparent",
              borderBottom: "9px solid var(--brand-primary)",
            }}
          />
          <div
            style={{
              position: "absolute",
              [flipBubbleAbove ? "bottom" : "top"]: "-6px",
              left: arrowLeft + 2,
              transform: flipBubbleAbove ? "rotate(180deg)" : "none",
              width: 0,
              height: 0,
              borderLeft: "7px solid transparent",
              borderRight: "7px solid transparent",
              borderBottom: "7px solid var(--card-bg)",
            }}
          />

          {/* Buck says line */}
          {buckSaysText !== "" && (
            <p
              style={{
                fontSize: step.typeWhileWaving ? "16px" : "13px",
                fontWeight: step.typeWhileWaving ? 700 : 600,
                color: "var(--text-primary)",
                margin: 0,
                lineHeight: 1.4,
                minHeight: "1.4em",
                textAlign: step.typeWhileWaving ? "center" : "left",
              }}
            >
              {buckSaysText}
              {typingPhase === "buckSays" && <BlinkCursor />}
            </p>
          )}

          {/* Title (shown when text starts appearing, for non-wave-typing steps) */}
          {step.title && !step.typeWhileWaving && (buckSaysText || descriptionText) && (
            <p
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: "6px 0 2px",
                lineHeight: 1.2,
              }}
            >
              {step.title}
            </p>
          )}

          {/* Description */}
          {(descriptionText || typingPhase === "description") && (
            <p
              style={{
                fontSize: "12px",
                lineHeight: 1.5,
                color: "var(--text-secondary)",
                margin: "4px 0 0",
                minHeight: "1.5em",
              }}
            >
              {descriptionText}
              {typingPhase === "description" && <BlinkCursor />}
            </p>
          )}

          {/* ── Name input ── */}
          {step.inputType === "text" && isTypingDone && (
            <div style={{ marginTop: "8px" }}>
              <input
                type="text"
                placeholder={step.inputPlaceholder}
                value={inputValues.name}
                onChange={(e) => updateInput("name", e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter" && inputValues.name.trim()) handleNext();
                }}
                autoFocus
                style={inputStyle}
              />
            </div>
          )}

          {/* ── Break times input ── */}
          {step.inputType === "breaks" && isTypingDone && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px",
                marginTop: "8px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <span style={labelStyle}>Break 1</span>
                <input
                  type="time"
                  value={inputValues.break1}
                  onChange={(e) => updateInput("break1", e.target.value)}
                  style={timeInputStyle}
                />
              </div>
              <div>
                <span style={labelStyle}>Break 2</span>
                <input
                  type="time"
                  value={inputValues.break2}
                  onChange={(e) => updateInput("break2", e.target.value)}
                  style={timeInputStyle}
                />
              </div>
              <div>
                <span style={labelStyle}>Lunch Start</span>
                <input
                  type="time"
                  value={inputValues.lunchStart}
                  onChange={(e) => updateInput("lunchStart", e.target.value)}
                  style={timeInputStyle}
                />
              </div>
              <div>
                <span style={labelStyle}>Lunch End</span>
                <input
                  type="time"
                  value={inputValues.lunchEnd}
                  onChange={(e) => updateInput("lunchEnd", e.target.value)}
                  style={timeInputStyle}
                />
              </div>
            </div>
          )}

          {/* ── Progress dots (hidden when skipped) ── */}
          {!skippedOnboarding && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "3px",
                margin: "10px 0 6px",
              }}
            >
              {ONBOARDING_STEPS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === currentStep ? "14px" : "5px",
                    height: "5px",
                    borderRadius: "2.5px",
                    backgroundColor:
                      i === currentStep
                        ? "var(--brand-primary)"
                        : i < currentStep
                          ? "var(--text-tertiary)"
                          : "var(--border-primary)",
                    transition: "all 0.25s ease",
                  }}
                />
              ))}
            </div>
          )}

          {/* ── Action buttons (only when typing is done) ── */}
          {isTypingDone && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                marginTop: skippedOnboarding ? "10px" : 0,
              }}
            >
              {/* Skip Tutorial — pinned to the left, available on all steps except the last */}
              {!isLastStep && !skippedOnboarding && (
                <button onClick={handleSkipOnboarding} style={{ ...secondaryBtnStyle, marginRight: "auto" }}>
                  Skip Tutorial
                </button>
              )}

              {step.id === "settings" ? (
                /* Settings step: Yes/No for break setup */
                <>
                  <button onClick={handleBreaksNo} style={secondaryBtnStyle}>
                    No thanks
                  </button>
                  <button onClick={handleBreaksYes} style={primaryBtnStyle}>
                    Set My Breaks
                  </button>
                </>
              ) : step.inputType === "breaks" ? (
                /* Breaks step: Not Now + Set Breaks */
                <>
                  <button onClick={handleSkipBreaks} style={secondaryBtnStyle}>
                    Not Now
                  </button>
                  <button onClick={handleNext} style={primaryBtnStyle}>
                    Set Breaks
                  </button>
                </>
              ) : (
                /* Normal: Next or Let's Go! */
                <button
                  onClick={handleNext}
                  disabled={nextDisabled}
                  style={{
                    ...primaryBtnStyle,
                    opacity: nextDisabled ? 0.5 : 1,
                    cursor: nextDisabled ? "default" : "pointer",
                  }}
                >
                  {isLastStep || skippedOnboarding ? "Let's Go!" : "Next"}
                  {!isLastStep && !skippedOnboarding && <ChevronRight style={{ width: "14px", height: "14px" }} />}
                </button>
              )}
            </div>
          )}

          {/* Tap hint during typing */}
          {!isTypingDone && typingPhase !== "idle" && (
            <p
              style={{
                fontSize: "10px",
                color: "var(--text-tertiary)",
                textAlign: "center",
                margin: "4px 0 0",
                opacity: 0.6,
              }}
            >
              Tap to skip text
            </p>
          )}
        </div>
      )}

      {/* ── Inline keyframes ── */}
      <style>{`
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes onboarding-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(var(--brand-primary-rgb, 99, 102, 241), 0.5);
            opacity: 1;
          }
          50% {
            box-shadow: 0 0 12px 6px rgba(var(--brand-primary-rgb, 99, 102, 241), 0);
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
};

// ── Tiny helper for the blinking RPG cursor ──
const BlinkCursor = () => (
  <span
    style={{
      display: "inline-block",
      width: "2px",
      height: "12px",
      backgroundColor: "var(--brand-primary)",
      marginLeft: "1px",
      verticalAlign: "text-bottom",
      animation: "blink-cursor 0.6s step-end infinite",
    }}
  />
);

export default OnboardingOverlay;
