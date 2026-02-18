// src/utils/buckStateMachine.js
// Simple state machine for Buck's autonomous behavior in the tamagotchi scene.

export const BUCK_STATES = {
  IDLE: 'idle',
  WALKING: 'walking',
  SITTING: 'sitting',
  SLEEPING: 'sleeping',
  EATING: 'eating',
  CELEBRATING: 'celebrating',
  TALKING: 'talking',
};

// Named spots Buck visits (x as % of scene width)
export const ACTIVITY_SPOTS = {
  desk:      { x: 22, label: 'Working hard',     arrivalAnim: 'talking' },
  center:    { x: 50, label: 'Hanging out',      arrivalAnim: null },
  window:    { x: 68, label: 'Looking outside',  arrivalAnim: null },
  bookshelf: { x: 82, label: 'Browsing books',   arrivalAnim: 'pointing' },
};

// Mood-based spot preference weights
const MOOD_WEIGHTS = {
  love:    { desk: 40, center: 25, bookshelf: 20, window: 15 },
  happy:   { desk: 30, center: 30, bookshelf: 20, window: 20 },
  hungry:  { center: 40, desk: 15, window: 25, bookshelf: 20 },
  sad:     { window: 45, center: 30, bookshelf: 15, desk: 10 },
  sick:    { center: 30, desk: 10, window: 30, bookshelf: 30 },
  angry:   { center: 40, desk: 30, window: 15, bookshelf: 15 },
};

// Weighted random pick, avoids repeating current spot
export function pickNextSpot(mood, currentSpot) {
  const weights = MOOD_WEIGHTS[mood] || MOOD_WEIGHTS.happy;
  const options = Object.entries(weights).filter(([spot]) => spot !== currentSpot);
  const totalWeight = options.reduce((sum, [, w]) => sum + w, 0);

  let roll = Math.random() * totalWeight;
  for (const [spot, weight] of options) {
    roll -= weight;
    if (roll <= 0) return spot;
  }
  return options[options.length - 1][0];
}

// Which sprite sheet to use for a given state
export function getBuckSpriteKey(state, walkDirection) {
  switch (state) {
    case BUCK_STATES.WALKING:
      return walkDirection > 0 ? 'walkRight' : 'walkLeft';
    case BUCK_STATES.SLEEPING:
      return 'exhausted';
    case BUCK_STATES.EATING:
      return 'talking';
    case BUCK_STATES.CELEBRATING:
      return 'waving';
    case BUCK_STATES.TALKING:
      return 'talking';
    case BUCK_STATES.SITTING:
    case BUCK_STATES.IDLE:
    default:
      return 'idle';
  }
}

// Occasional idle fidget animation
export function getRandomIdleFidget() {
  const roll = Math.random();
  if (roll < 0.25) return 'waving';
  if (roll < 0.45) return 'pointing';
  if (roll < 0.55) return 'surprised';
  return null;
}

// Randomized delay between autonomous actions (ms)
export function getNextActionDelay() {
  return 5000 + Math.random() * 10000;
}
