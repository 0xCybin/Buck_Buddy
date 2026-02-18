// src/components/tamagotchi/BuckCharacter.jsx
// Buck's rendering and autonomous behavior controller.
// Handles sprite sheet loading, walking, idle fidgets, action reactions,
// and position management within the tamagotchi scene.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import SpriteAnimator from './SpriteAnimator';
import { removeBlackBackground } from '../../utils/spriteProcessor';
import { BUCK_SPRITES } from '../../utils/assetManifest';
import {
  BUCK_STATES,
  ACTIVITY_SPOTS,
  pickNextSpot,
  getBuckSpriteKey,
  getRandomIdleFidget,
  getNextActionDelay,
} from '../../utils/buckStateMachine';

// Buck display: 140px * 0.8 = 112px tall, prominent in the scene
const BUCK_SCALE = 0.8;
const FLOOR_Y = 5; // % from bottom

const BuckCharacter = ({
  mood = 'happy',
  onStateChange,
  onSpotChange,
  onClick,
  triggerAction, // { type: 'eat'|'sleep'|'play'|'clean', id: number } or null
}) => {
  const [buckState, setBuckState] = useState(BUCK_STATES.IDLE);
  const [posX, setPosX] = useState(50);
  const [targetX, setTargetX] = useState(null);
  const [currentSpot, setCurrentSpot] = useState('center');
  const [actionAnim, setActionAnim] = useState(null);
  const [idleFidget, setIdleFidget] = useState(null);
  const [spriteCache, setSpriteCache] = useState({});
  const [spritesReady, setSpritesReady] = useState(false);

  const behaviorRef = useRef(null);
  const fidgetRef = useRef(null);
  const walkRef = useRef(null);
  const actionRef = useRef(null);
  const stateRef = useRef(buckState);
  const moodRef = useRef(mood);
  const spotRef = useRef(currentSpot);
  const lastActionId = useRef(null);

  stateRef.current = buckState;
  moodRef.current = mood;
  spotRef.current = currentSpot;

  // Pre-process all sprite sheets on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const cache = {};
      const entries = Object.entries(BUCK_SPRITES);

      // Process in parallel batches of 4
      for (let i = 0; i < entries.length; i += 4) {
        const batch = entries.slice(i, i + 4);
        const results = await Promise.all(
          batch.map(async ([key, sprite]) => {
            try {
              const processed = await removeBlackBackground(sprite.src());
              return [key, processed];
            } catch {
              return [key, sprite.src()];
            }
          })
        );
        if (cancelled) return;
        results.forEach(([key, val]) => { cache[key] = val; });
      }

      if (!cancelled) {
        setSpriteCache(cache);
        setSpritesReady(true);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // Walk to a named spot
  const walkTo = useCallback((spotName) => {
    const spot = ACTIVITY_SPOTS[spotName];
    if (!spot) return;

    setCurrentSpot(spotName);
    spotRef.current = spotName;
    setTargetX(spot.x);
    setBuckState(BUCK_STATES.WALKING);
    setIdleFidget(null);
    setActionAnim(null);
    onSpotChange?.(spotName, spot.label);
  }, [onSpotChange]);

  // Walking animation: smooth interpolation from current to target
  useEffect(() => {
    if (buckState !== BUCK_STATES.WALKING || targetX === null) return;

    const startX = posX;
    const distance = targetX - startX;
    if (Math.abs(distance) < 1) {
      // Already there
      setBuckState(BUCK_STATES.IDLE);
      setTargetX(null);
      return;
    }

    const duration = (Math.abs(distance) / 30) * 1000; // ~30% per second
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease in-out quad
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      setPosX(startX + distance * eased);

      if (t < 1) {
        walkRef.current = requestAnimationFrame(animate);
      } else {
        setPosX(targetX);
        setTargetX(null);
        setBuckState(BUCK_STATES.IDLE);

        // Play arrival fidget if spot defines one
        const spot = ACTIVITY_SPOTS[spotRef.current];
        if (spot?.arrivalAnim) {
          setIdleFidget(spot.arrivalAnim);
          setTimeout(() => setIdleFidget(null), 1800);
        }
      }
    };

    walkRef.current = requestAnimationFrame(animate);
    return () => { if (walkRef.current) cancelAnimationFrame(walkRef.current); };
  }, [buckState, targetX]);

  // Autonomous behavior: pick random spots on a timer
  useEffect(() => {
    if (!spritesReady) return;

    const schedule = () => {
      behaviorRef.current = setTimeout(() => {
        if (stateRef.current === BUCK_STATES.IDLE) {
          const next = pickNextSpot(moodRef.current, spotRef.current);
          walkTo(next);
        }
        schedule();
      }, getNextActionDelay());
    };

    schedule();
    return () => clearTimeout(behaviorRef.current);
  }, [spritesReady, walkTo]);

  // Idle fidgets: random animation blips while standing around
  useEffect(() => {
    if (buckState !== BUCK_STATES.IDLE) return;

    const schedule = () => {
      fidgetRef.current = setTimeout(() => {
        if (stateRef.current === BUCK_STATES.IDLE && !idleFidget) {
          const fidget = getRandomIdleFidget();
          if (fidget) {
            setIdleFidget(fidget);
            setTimeout(() => setIdleFidget(null), 2000);
          }
        }
        schedule();
      }, 8000 + Math.random() * 12000);
    };

    schedule();
    return () => clearTimeout(fidgetRef.current);
  }, [buckState]);

  // Handle external action triggers (feed, sleep, play, clean)
  useEffect(() => {
    if (!triggerAction || triggerAction.id === lastActionId.current) return;
    lastActionId.current = triggerAction.id;

    const actions = {
      eat:   { state: BUCK_STATES.EATING,       anim: 'talking',    dur: 1500 },
      sleep: { state: BUCK_STATES.SLEEPING,      anim: 'exhausted',  dur: 3000 },
      play:  { state: BUCK_STATES.CELEBRATING,   anim: 'waving',     dur: 2000 },
      clean: { state: BUCK_STATES.TALKING,        anim: 'pointing',   dur: 1500 },
    };

    const action = actions[triggerAction.type];
    if (!action) return;

    // Cancel any ongoing walk
    if (walkRef.current) cancelAnimationFrame(walkRef.current);
    setTargetX(null);

    setBuckState(action.state);
    setActionAnim(action.anim);
    setIdleFidget(null);

    if (actionRef.current) clearTimeout(actionRef.current);
    actionRef.current = setTimeout(() => {
      setBuckState(BUCK_STATES.IDLE);
      setActionAnim(null);
    }, action.dur);
  }, [triggerAction]);

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.(buckState);
  }, [buckState, onStateChange]);

  // Determine which sprite to render
  const walkDirection = targetX !== null ? targetX - posX : 0;
  let spriteKey;
  if (buckState === BUCK_STATES.WALKING) {
    spriteKey = getBuckSpriteKey(BUCK_STATES.WALKING, walkDirection);
  } else if (actionAnim) {
    spriteKey = actionAnim;
  } else if (idleFidget) {
    spriteKey = idleFidget;
  } else {
    spriteKey = 'idle';
  }

  const spriteData = BUCK_SPRITES[spriteKey] || BUCK_SPRITES.idle;
  const processedSrc = spriteCache[spriteKey] || spriteCache.idle;

  // Static idle uses NESW south-facing frame (index 2)
  const isStaticIdle = spriteKey === 'idle' && buckState === BUCK_STATES.IDLE && !idleFidget && !actionAnim;

  if (!spritesReady) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${posX}%`,
        bottom: `${FLOOR_Y}%`,
        transform: 'translateX(-50%)',
        zIndex: 5,
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      {/* Ground shadow */}
      <div style={{
        position: 'absolute',
        bottom: -2,
        left: '50%',
        transform: 'translateX(-50%)',
        width: buckState === BUCK_STATES.WALKING ? 36 : 48,
        height: 6,
        background: 'rgba(0,0,0,0.35)',
        borderRadius: '50%',
        filter: 'blur(2px)',
        transition: 'width 0.3s ease',
      }} />

      {/* Sprite with walk bounce */}
      <div style={{
        animation: buckState === BUCK_STATES.WALKING
          ? 'buckSceneBounce 0.3s ease-in-out infinite' : undefined,
      }}>
        <SpriteAnimator
          src={processedSrc}
          frameWidth={spriteData.frameWidth}
          frameHeight={spriteData.frameHeight}
          frameCount={isStaticIdle ? 1 : spriteData.frameCount}
          fps={buckState === BUCK_STATES.WALKING ? 8 : 6}
          scale={BUCK_SCALE}
          playing={!isStaticIdle}
          startFrame={isStaticIdle ? 2 : 0}
        />
      </div>

      <style>{`
        @keyframes buckSceneBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
};

export default BuckCharacter;
