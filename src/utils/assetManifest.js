// src/utils/assetManifest.js
// Central registry of all sprite assets, their metadata, and scene positions.

const url = (path) => chrome.runtime.getURL(path);

// Buck sprite sheets (horizontal strips on black backgrounds)
export const BUCK_SPRITES = {
  idle: {
    src: () => url('assets/buck/Buck_NESW.png'),
    frameWidth: 133, frameHeight: 140, frameCount: 4,
    // Frame mapping: 0=North, 1=East, 2=South (front-facing), 3=West
  },
  waving: {
    src: () => url('assets/buck/Buck_Waving.png'),
    frameWidth: 133, frameHeight: 140, frameCount: 4,
  },
  pointing: {
    src: () => url('assets/buck/Buck_Pointing.png'),
    frameWidth: 133, frameHeight: 140, frameCount: 4,
  },
  talking: {
    src: () => url('assets/buck/Buck_Talking.png'),
    frameWidth: 133, frameHeight: 140, frameCount: 4,
  },
  surprised: {
    src: () => url('assets/buck/Buck_Surpised.png'),
    frameWidth: 133, frameHeight: 140, frameCount: 4,
  },
  exhausted: {
    src: () => url('assets/buck/Buck_Exahusted.png'),
    frameWidth: 133, frameHeight: 140, frameCount: 4,
  },
  walkRight: {
    src: () => url('assets/buck/Buck_Walking_Right.png'),
    frameWidth: 133, frameHeight: 140, frameCount: 4,
  },
  walkLeft: {
    src: () => url('assets/buck/Buck_Walking_Left.png'),
    frameWidth: 133, frameHeight: 140, frameCount: 4,
  },
  walkNorth: {
    src: () => url('assets/buck/Buck_Walking_North.png'),
    frameWidth: 133, frameHeight: 140, frameCount: 4,
  },
  walkSouth: {
    src: () => url('assets/buck/Buck_Walking_South.png'),
    frameWidth: 131, frameHeight: 140, frameCount: 6,
  },
};

// Room furniture and decorations with scene placement
export const ROOM_OBJECTS = {
  // Wall-mounted items (positioned from top)
  poster: {
    src: () => url('assets/tamagotchi/office/furniture/poster.png'),
    displayWidth: 65, displayHeight: 65,
    left: '7%', top: '5%',
    zIndex: 2,
  },
  sticky_notes: {
    src: () => url('assets/tamagotchi/office/furniture/sticky_notes.png'),
    displayWidth: 28, displayHeight: 28,
    left: '27%', top: '20%',
    zIndex: 2,
  },

  // Desk area (left side, positioned from bottom)
  desk: {
    src: () => url('assets/tamagotchi/office/furniture/desk.png'),
    displayWidth: 130, displayHeight: 110,
    left: '2%', bottom: '1%',
    zIndex: 3,
  },
  lamp: {
    src: () => url('assets/tamagotchi/office/furniture/lamp.png'),
    displayWidth: 42, displayHeight: 48,
    left: '4%', bottom: '40%',
    zIndex: 4,
  },
  monitor: {
    src: () => url('assets/tamagotchi/office/furniture/monitor.png'),
    displayWidth: 52, displayHeight: 52,
    left: '14%', bottom: '38%',
    zIndex: 4,
  },
  keyboard: {
    src: () => url('assets/tamagotchi/office/furniture/keyboard.png'),
    displayWidth: 46, displayHeight: 22,
    left: '15%', bottom: '33%',
    zIndex: 4,
  },
  mug: {
    src: () => url('assets/tamagotchi/office/furniture/mug.png'),
    displayWidth: 24, displayHeight: 24,
    left: '29%', bottom: '39%',
    zIndex: 4,
  },
  headset: {
    src: () => url('assets/tamagotchi/office/furniture/headset.png'),
    displayWidth: 32, displayHeight: 32,
    left: '24%', bottom: '43%',
    zIndex: 4,
  },

  // Front furniture (higher z so it can overlap Buck)
  chair: {
    src: () => url('assets/tamagotchi/office/furniture/chair.png'),
    displayWidth: 68, displayHeight: 68,
    left: '13%', bottom: '0%',
    zIndex: 6,
  },

  // Right side
  bookshelf: {
    src: () => url('assets/tamagotchi/office/furniture/bookshelf.png'),
    displayWidth: 55, displayHeight: 55,
    right: '10%', bottom: '36%',
    zIndex: 3,
  },
  plant: {
    src: () => url('assets/tamagotchi/office/furniture/plant.png'),
    displayWidth: 62, displayHeight: 62,
    right: '2%', bottom: '0%',
    zIndex: 6,
  },
};

// Ordered render lists for z-layer grouping
export const WALL_OBJECTS = ['poster', 'sticky_notes'];
export const BACK_FURNITURE = ['desk', 'bookshelf'];
export const DESK_SURFACE = ['lamp', 'monitor', 'keyboard', 'mug', 'headset'];
export const FRONT_FURNITURE = ['chair', 'plant'];

// Time-of-day window sprite
export function getWindowSprite() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10) return url('assets/tamagotchi/office/windows/window_morning.png');
  if (hour >= 10 && hour < 17) return url('assets/tamagotchi/office/windows/window_day.png');
  if (hour >= 17 && hour < 20) return url('assets/tamagotchi/office/windows/window_evening.png');
  return url('assets/tamagotchi/office/windows/window_night.png');
}

// UI asset helpers
export function getCoinFrameUrl(frameIndex) {
  return url(`assets/tamagotchi/ui/currency/gme_coin_${frameIndex + 1}.png`);
}

export function getActionIcon(action) {
  const icons = {
    feed: 'ui/icons/icon_feed.png',
    sleep: 'ui/icons/icon_sleep.png',
    play: 'ui/icons/icon_play.png',
    clean: 'ui/icons/icon_clean.png',
  };
  return icons[action] ? url(`assets/tamagotchi/${icons[action]}`) : null;
}
