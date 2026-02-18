// src/components/buck/BuckEffects.jsx
// Floating particle effects: hearts, sparkles, confetti, dust, coins, stars, steam.

import React from 'react';

const HEART_POSITIONS = [
  { left: '20%', delay: 0 },
  { left: '40%', delay: 0.1 },
  { left: '60%', delay: 0.2 },
  { left: '80%', delay: 0.05 },
];

const SPARKLE_POSITIONS = [
  { left: '10%', top: '20%', delay: 0 },
  { left: '80%', top: '10%', delay: 0.1 },
  { left: '30%', top: '70%', delay: 0.15 },
  { left: '70%', top: '60%', delay: 0.05 },
  { left: '50%', top: '30%', delay: 0.2 },
];

const CONFETTI_POSITIONS = [
  { left: '10%', delay: 0 },
  { left: '25%', delay: 0.05 },
  { left: '40%', delay: 0.12 },
  { left: '55%', delay: 0.03 },
  { left: '70%', delay: 0.15 },
  { left: '85%', delay: 0.08 },
];

const COIN_POSITIONS = [
  { left: '30%', delay: 0 },
  { left: '50%', delay: 0.1 },
  { left: '70%', delay: 0.06 },
];

const STAR_POSITIONS = [
  { left: '20%', top: '15%', delay: 0 },
  { left: '75%', top: '20%', delay: 0.1 },
  { left: '50%', top: '5%', delay: 0.18 },
];

const STEAM_POSITIONS = [
  { left: '30%', delay: 0 },
  { left: '50%', delay: 0.12 },
  { left: '70%', delay: 0.06 },
];

const EffectImage = ({ src, style }) => (
  <img src={src} alt="" draggable={false} style={{
    position: 'absolute',
    imageRendering: 'pixelated',
    pointerEvents: 'none',
    ...style,
  }} />
);

const BuckEffects = ({ effects }) => {
  if (!effects || effects.length === 0) return null;

  const getUrl = (name) => chrome.runtime.getURL(`assets/tamagotchi/effects/${name}`);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 5,
      overflow: 'visible',
    }}>
      {effects.map(effect => (
        <div key={effect.id}>
          {/* Hearts - float up */}
          {effect.type === 'heart' && HEART_POSITIONS.map((pos, i) => (
            <EffectImage key={`heart-${i}`} src={getUrl('hearts_float.png')} style={{
              left: pos.left, bottom: '50%', width: 16, height: 16,
              animation: `buckFloatUp 1.2s ease-out ${pos.delay}s forwards`, opacity: 0,
            }} />
          ))}

          {/* Sparkles - pop in/out */}
          {effect.type === 'sparkle' && SPARKLE_POSITIONS.map((pos, i) => (
            <EffectImage key={`sparkle-${i}`} src={getUrl('sparkle.png')} style={{
              left: pos.left, top: pos.top, width: 14, height: 14,
              animation: `buckSparkle 0.8s ease-out ${pos.delay}s forwards`, opacity: 0,
            }} />
          ))}

          {/* Confetti - scatter and fall */}
          {effect.type === 'confetti' && CONFETTI_POSITIONS.map((pos, i) => (
            <EffectImage key={`confetti-${i}`} src={getUrl('confetti.png')} style={{
              left: pos.left, top: '10%', width: 18, height: 18,
              animation: `buckConfettiFall 1.4s ease-in ${pos.delay}s forwards`, opacity: 0,
            }} />
          ))}

          {/* Dust poof - quick burst at feet */}
          {effect.type === 'dust' && (
            <EffectImage src={getUrl('dust_poof.png')} style={{
              left: '50%', bottom: '5%', width: 28, height: 28,
              transform: 'translateX(-50%)',
              animation: 'buckDustPoof 0.6s ease-out forwards', opacity: 0,
            }} />
          )}

          {/* Coin shower - coins rain down */}
          {effect.type === 'coins' && COIN_POSITIONS.map((pos, i) => (
            <EffectImage key={`coin-${i}`} src={getUrl('coin_shower.png')} style={{
              left: pos.left, top: '0%', width: 16, height: 16,
              animation: `buckCoinDrop 1s ease-in ${pos.delay}s forwards`, opacity: 0,
            }} />
          ))}

          {/* Star burst - expand and fade */}
          {effect.type === 'star' && STAR_POSITIONS.map((pos, i) => (
            <EffectImage key={`star-${i}`} src={getUrl('star_burst.png')} style={{
              left: pos.left, top: pos.top, width: 20, height: 20,
              animation: `buckStarBurst 0.9s ease-out ${pos.delay}s forwards`, opacity: 0,
            }} />
          ))}

          {/* Steam - angry puffs rising */}
          {effect.type === 'steam' && STEAM_POSITIONS.map((pos, i) => (
            <EffectImage key={`steam-${i}`} src={getUrl('steam_angry.png')} style={{
              left: pos.left, top: '0%', width: 16, height: 16,
              animation: `buckSteamRise 1s ease-out ${pos.delay}s forwards`, opacity: 0,
            }} />
          ))}
        </div>
      ))}

      <style>{`
        @keyframes buckFloatUp {
          0% { opacity: 1; transform: translateY(0) scale(0.5); }
          50% { opacity: 1; transform: translateY(-30px) scale(1); }
          100% { opacity: 0; transform: translateY(-60px) scale(0.8); }
        }
        @keyframes buckSparkle {
          0% { opacity: 0; transform: scale(0) rotate(0deg); }
          40% { opacity: 1; transform: scale(1.2) rotate(90deg); }
          100% { opacity: 0; transform: scale(0.5) rotate(180deg); }
        }
        @keyframes buckBubbleIn {
          0% { opacity: 0; transform: translateX(-50%) translateY(4px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes buckConfettiFall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg) scale(0.6); }
          30% { opacity: 1; transform: translateY(-15px) rotate(120deg) scale(1.1); }
          100% { opacity: 0; transform: translateY(50px) rotate(360deg) scale(0.4); }
        }
        @keyframes buckDustPoof {
          0% { opacity: 0.8; transform: translateX(-50%) scale(0.3); }
          40% { opacity: 0.9; transform: translateX(-50%) scale(1.2); }
          100% { opacity: 0; transform: translateX(-50%) scale(1.5); }
        }
        @keyframes buckCoinDrop {
          0% { opacity: 1; transform: translateY(-10px) scale(0.8); }
          60% { opacity: 1; transform: translateY(30px) scale(1); }
          100% { opacity: 0; transform: translateY(50px) scale(0.6); }
        }
        @keyframes buckStarBurst {
          0% { opacity: 0; transform: scale(0) rotate(0deg); }
          30% { opacity: 1; transform: scale(1.3) rotate(45deg); }
          60% { opacity: 1; transform: scale(1) rotate(90deg); }
          100% { opacity: 0; transform: scale(0.3) rotate(180deg); }
        }
        @keyframes buckSteamRise {
          0% { opacity: 0.8; transform: translateY(0) scale(0.5); }
          50% { opacity: 0.6; transform: translateY(-20px) scale(1); }
          100% { opacity: 0; transform: translateY(-45px) scale(0.7); }
        }
      `}</style>
    </div>
  );
};

export default BuckEffects;
