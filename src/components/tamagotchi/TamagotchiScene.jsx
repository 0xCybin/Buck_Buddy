// src/components/tamagotchi/TamagotchiScene.jsx
// Main scene container: composes the CSS room, layered object sprites,
// Buck character, UI overlays, and action buttons into a 380x280 tamagotchi view.

import React, { useState, useCallback, useRef } from 'react';
import RoomBackground from './RoomBackground';
import RoomObject from './RoomObject';
import BuckCharacter from './BuckCharacter';
import StatusBar from './StatusBar';
import CoinDisplay from './CoinDisplay';
import ActionButtons from './ActionButtons';
import {
  ROOM_OBJECTS,
  WALL_OBJECTS,
  BACK_FURNITURE,
  DESK_SURFACE,
  FRONT_FURNITURE,
  getWindowSprite,
} from '../../utils/assetManifest';

const SCENE_WIDTH = 380;
const SCENE_HEIGHT = 280;

const TamagotchiScene = ({
  hunger = 50,
  happiness = 50,
  coins = 0,
  mood = 'happy',
  onFeed,
  onSleep,
  onPlay,
  onClean,
  onBuckClick,
  speechText,
  children, // For overlaying speech bubbles / effects from parent
}) => {
  const [activityLabel, setActivityLabel] = useState('Hanging out');
  const [buckAction, setBuckAction] = useState(null);
  const actionCounter = useRef(0);

  const handleSpotChange = useCallback((spotName, label) => {
    setActivityLabel(label || 'Hanging out');
  }, []);

  const handleBuckStateChange = useCallback((state) => {
    if (state === 'walking') setActivityLabel('Walking...');
    if (state === 'idle') setActivityLabel(prev =>
      prev === 'Walking...' ? 'Hanging out' : prev
    );
  }, []);

  const handleAction = useCallback((action) => {
    actionCounter.current++;
    setBuckAction({ type: action, id: actionCounter.current });

    const labels = {
      feed: 'Eating...',
      sleep: 'Napping...',
      play: 'Playing!',
      clean: 'Tidying up!',
    };
    setActivityLabel(labels[action] || 'Hanging out');

    // Forward to parent game logic
    const handlers = { feed: onFeed, sleep: onSleep, play: onPlay, clean: onClean };
    handlers[action]?.();

    // Reset label after action completes
    setTimeout(() => {
      setActivityLabel('Hanging out');
      setBuckAction(null);
    }, 2500);
  }, [onFeed, onSleep, onPlay, onClean]);

  // Render a group of room objects from the manifest
  const renderObjectGroup = (keys) =>
    keys.map(key => {
      const obj = ROOM_OBJECTS[key];
      if (!obj) return null;
      return (
        <RoomObject
          key={key}
          src={obj.src()}
          displayWidth={obj.displayWidth}
          displayHeight={obj.displayHeight}
          left={obj.left}
          top={obj.top}
          right={obj.right}
          bottom={obj.bottom}
          zIndex={obj.zIndex}
          title={key}
        />
      );
    });

  const windowSrc = getWindowSprite();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%',
      gap: 6,
    }}>
      {/* Scene viewport */}
      <div style={{
        position: 'relative',
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        borderRadius: 10,
        overflow: 'hidden',
        border: '2px solid var(--border-primary, rgba(255,255,255,0.15))',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        imageRendering: 'pixelated',
      }}>
        {/* Layer 1: CSS-drawn room */}
        <RoomBackground width={SCENE_WIDTH} height={SCENE_HEIGHT} />

        {/* Layer 2: Time-of-day window */}
        <RoomObject
          src={windowSrc}
          displayWidth={75}
          displayHeight={70}
          right="22%"
          top="3%"
          zIndex={2}
          title="Window"
        />

        {/* Layer 2: Wall-mounted decor */}
        {renderObjectGroup(WALL_OBJECTS)}

        {/* Layer 3: Back furniture */}
        {renderObjectGroup(BACK_FURNITURE)}

        {/* Layer 4: Desk surface items */}
        {renderObjectGroup(DESK_SURFACE)}

        {/* Layer 5: Buck */}
        <BuckCharacter
          mood={mood}
          onStateChange={handleBuckStateChange}
          onSpotChange={handleSpotChange}
          onClick={onBuckClick}
          triggerAction={buckAction}
        />

        {/* Layer 6: Front furniture (can overlap Buck) */}
        {renderObjectGroup(FRONT_FURNITURE)}

        {/* Layer 7: UI overlays */}
        <CoinDisplay balance={coins} />
        <StatusBar text={activityLabel} />

        {/* Extra overlays from parent (speech bubbles, effects, etc.) */}
        {children}
      </div>

      {/* Action buttons below the scene */}
      <ActionButtons onAction={handleAction} />
    </div>
  );
};

export default TamagotchiScene;
