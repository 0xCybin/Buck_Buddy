// src/config/shopCatalog.js
// Shop catalog, mood computation, and Buck dialog lines for the tamagotchi system.

export const CONSUMABLE_CATEGORIES = ['food', 'drink', 'food_premium'];

export const SHOP_CATALOG = {
  // ─── Food (5-15 coins) ─────────────────────────────────────────────────────
  apple: {
    id: 'apple', name: 'Apple', category: 'food',
    cost: 5, hungerRestore: 8, happinessBoost: 2,
    asset: 'items/food/apple.png',
  },
  cookie: {
    id: 'cookie', name: 'Cookie', category: 'food',
    cost: 8, hungerRestore: 10, happinessBoost: 5,
    asset: 'items/food/cookie.png',
  },
  sandwich: {
    id: 'sandwich', name: 'Sandwich', category: 'food',
    cost: 12, hungerRestore: 20, happinessBoost: 5,
    asset: 'items/food/sandwich.png',
  },
  pizza: {
    id: 'pizza', name: 'Pizza', category: 'food',
    cost: 14, hungerRestore: 25, happinessBoost: 8,
    asset: 'items/food/pizza.png',
  },
  burger: {
    id: 'burger', name: 'Burger', category: 'food',
    cost: 15, hungerRestore: 30, happinessBoost: 10,
    asset: 'items/food/burger.png',
  },
  candy_bar: {
    id: 'candy_bar', name: 'Candy Bar', category: 'food',
    cost: 6, hungerRestore: 5, happinessBoost: 12,
    asset: 'items/food/candy_bar.png',
  },

  // ─── Drinks (3-12 coins) ──────────────────────────────────────────────────
  water: {
    id: 'water', name: 'Water', category: 'drink',
    cost: 3, hungerRestore: 3, happinessBoost: 2,
    asset: 'items/drinks/water.png',
  },
  soda: {
    id: 'soda', name: 'Soda', category: 'drink',
    cost: 5, hungerRestore: 5, happinessBoost: 8,
    asset: 'items/drinks/soda.png',
  },
  coffee: {
    id: 'coffee', name: 'Coffee', category: 'drink',
    cost: 8, hungerRestore: 5, happinessBoost: 10,
    asset: 'items/drinks/coffee.png',
  },
  energy_drink: {
    id: 'energy_drink', name: 'Energy Drink', category: 'drink',
    cost: 12, hungerRestore: 8, happinessBoost: 15,
    asset: 'items/drinks/energy_drink.png',
  },

  // ─── Premium Food (18-30 coins) ───────────────────────────────────────────
  donut: {
    id: 'donut', name: 'Donut', category: 'food_premium',
    cost: 18, hungerRestore: 15, happinessBoost: 20,
    asset: 'items/food_premium/donut.png',
  },
  ice_cream: {
    id: 'ice_cream', name: 'Ice Cream', category: 'food_premium',
    cost: 22, hungerRestore: 12, happinessBoost: 25,
    asset: 'items/food_premium/ice_cream.png',
  },
  ramen: {
    id: 'ramen', name: 'Ramen', category: 'food_premium',
    cost: 25, hungerRestore: 35, happinessBoost: 15,
    asset: 'items/food_premium/ramen.png',
  },
  cake: {
    id: 'cake', name: 'Cake', category: 'food_premium',
    cost: 30, hungerRestore: 20, happinessBoost: 30,
    asset: 'items/food_premium/cake.png',
  },

  // ─── Hats (40-200 coins) ──────────────────────────────────────────────────
  headband: {
    id: 'headband', name: 'Headband', category: 'hat',
    cost: 40, slot: 'hat',
    asset: 'items/hats/headband.png',
  },
  visor: {
    id: 'visor', name: 'Visor', category: 'hat',
    cost: 60, slot: 'hat',
    asset: 'items/hats/visor.png',
  },
  party_hat: {
    id: 'party_hat', name: 'Party Hat', category: 'hat',
    cost: 80, slot: 'hat',
    asset: 'items/hats/party_hat.png',
  },
  santa_hat: {
    id: 'santa_hat', name: 'Santa Hat', category: 'hat',
    cost: 100, slot: 'hat',
    asset: 'items/hats/santa_hat.png',
  },
  wizard_hat: {
    id: 'wizard_hat', name: 'Wizard Hat', category: 'hat',
    cost: 150, slot: 'hat',
    asset: 'items/hats/wizard_hat.png',
  },
  crown: {
    id: 'crown', name: 'Crown', category: 'hat',
    cost: 200, slot: 'hat',
    asset: 'items/hats/crown.png',
  },

  // ─── Eyewear (60-120 coins) ───────────────────────────────────────────────
  nerd_glasses: {
    id: 'nerd_glasses', name: 'Nerd Glasses', category: 'eyewear',
    cost: 60, slot: 'eyewear',
    asset: 'items/eyewear/nerd_glasses.png',
  },
  sunglasses: {
    id: 'sunglasses', name: 'Sunglasses', category: 'eyewear',
    cost: 80, slot: 'eyewear',
    asset: 'items/eyewear/sunglasses.png',
  },
  monocle: {
    id: 'monocle', name: 'Monocle', category: 'eyewear',
    cost: 120, slot: 'eyewear',
    asset: 'items/eyewear/monocle.png',
  },

  // ─── Outfits (80-180 coins) ───────────────────────────────────────────────
  gamestop_polo: {
    id: 'gamestop_polo', name: 'GameStop Polo', category: 'outfit',
    cost: 80, slot: 'outfit',
    asset: 'items/outfits/gamestop_polo.png',
  },
  hawaiian_shirt: {
    id: 'hawaiian_shirt', name: 'Hawaiian Shirt', category: 'outfit',
    cost: 100, slot: 'outfit',
    asset: 'items/outfits/hawaiian_shirt.png',
  },
  gamestop_hoodie: {
    id: 'gamestop_hoodie', name: 'GameStop Hoodie', category: 'outfit',
    cost: 120, slot: 'outfit',
    asset: 'items/outfits/gamestop_hoodie.png',
  },
  cape: {
    id: 'cape', name: 'Cape', category: 'outfit',
    cost: 150, slot: 'outfit',
    asset: 'items/outfits/cape.png',
  },
  tuxedo: {
    id: 'tuxedo', name: 'Tuxedo', category: 'outfit',
    cost: 180, slot: 'outfit',
    asset: 'items/outfits/tuxedo.png',
  },

  // ─── Held Items (30-150 coins) ────────────────────────────────────────────
  balloon: {
    id: 'balloon', name: 'Balloon', category: 'held',
    cost: 30, slot: 'held',
    asset: 'items/held_items/balloon.png',
  },
  foam_finger: {
    id: 'foam_finger', name: 'Foam Finger', category: 'held',
    cost: 50, slot: 'held',
    asset: 'items/held_items/foam_finger.png',
  },
  controller: {
    id: 'controller', name: 'Controller', category: 'held',
    cost: 80, slot: 'held',
    asset: 'items/held_items/controller.png',
  },
  magic_wand: {
    id: 'magic_wand', name: 'Magic Wand', category: 'held',
    cost: 150, slot: 'held',
    asset: 'items/held_items/magic_wand.png',
  },
};

// Compute Buck's current mood from hunger + happiness values
export function computeMood(hunger, happiness, isOnVacation) {
  if (isOnVacation) return 'sick';
  const avg = (hunger + happiness) / 2;
  if (hunger <= 10) return 'hungry';
  if (happiness <= 15) return 'sad';
  if (avg >= 75) return 'love';
  if (avg >= 55) return 'happy';
  if (avg >= 35) return 'hungry';
  if (avg >= 20) return 'sad';
  return 'sick';
}

// Maps a mood string to a sprite animation folder path (includes subdirectory)
export function getMoodAnimation(mood) {
  const map = {
    happy: 'emotions/happy',
    hungry: 'emotions/hungry',
    sad: 'emotions/sad',
    sick: 'emotions/sick',
    angry: 'emotions/angry',
    love: 'emotions/love',
    surprised: 'emotions/surprised_new',
  };
  return map[mood] || 'emotions/happy';
}

// Maps an action name to its animation folder path
export function getActionAnimation(action) {
  const map = {
    eating: 'actions/eating',
    sleeping: 'actions/sleeping',
    working: 'actions/working',
    celebrating: 'actions/celebrating',
    sitting_down: 'movement/sitting_down',
    standing_up: 'movement/standing_up',
    achievement: 'special/achievement',
    coin_collect: 'special/coin_collect',
    dancing: 'special/dancing',
    level_up: 'special/level_up',
    vacation_depart: 'special/vacation_depart',
    vacation_return: 'special/vacation_return',
  };
  return map[action] || null;
}

// Contextual dialog lines keyed by mood
export const BUCK_DIALOG = {
  happy: [
    "Closing tickets like a boss!",
    "I'm feeling great today!",
    "Best. Day. Ever!",
    "Let's goooo!",
    "Thanks for taking care of me!",
  ],
  hungry: [
    "My tummy is rumbling...",
    "Got any snacks?",
    "I could really go for a pizza...",
    "Feed me please!",
    "Is it lunch time yet?",
  ],
  sad: [
    "I miss you when you're gone...",
    "Could use some pets...",
    "Feeling kinda lonely...",
    "Don't forget about me okay?",
    "A little attention would be nice...",
  ],
  sick: [
    "I don't feel so good...",
    "Need... food...",
    "Everything hurts...",
    "Please help me...",
    "I'm going on vacation if this keeps up...",
  ],
  angry: [
    "FEED ME ALREADY!",
    "I'm not happy right now...",
    "This is unacceptable!",
    "Do I look happy to you?!",
  ],
  love: [
    "You're the best!",
    "I love working with you!",
    "Best partner ever!",
    "My heart is full!",
  ],
  onFeed: [
    "Yum! That hit the spot!",
    "Delicious, thank you!",
    "Om nom nom!",
    "Now THAT'S what I'm talking about!",
    "You always know what I need!",
  ],
  onPet: [
    "Hehe that tickles!",
    "Aww, thanks!",
    "I love head pats!",
    "More please!",
    "You're so nice to me!",
  ],
  onShopBuy: [
    "Ooh, shiny!",
    "Great purchase!",
    "I love new stuff!",
    "You have great taste!",
  ],
  onEquip: [
    "How do I look?",
    "Looking fresh!",
    "Feeling fancy!",
    "Fashion icon right here!",
  ],
  onPopupOpen: [
    "Hey! Welcome back!",
    "Oh hi there!",
    "Ready to work!",
    "Let's crush some tickets!",
    "I missed you!",
  ],
  vacation: [
    "I'll be back when I feel better...",
    "Taking a break to recover...",
    "See you soon... hopefully...",
  ],
};

// Pick a random line from a dialog category
export function getRandomDialog(category) {
  const lines = BUCK_DIALOG[category];
  if (!lines || lines.length === 0) return '';
  return lines[Math.floor(Math.random() * lines.length)];
}

// Category labels for shop UI tabs
export const SHOP_CATEGORIES = [
  { key: 'food', label: 'Food' },
  { key: 'drink', label: 'Drinks' },
  { key: 'food_premium', label: 'Premium' },
  { key: 'hat', label: 'Hats' },
  { key: 'eyewear', label: 'Glasses' },
  { key: 'outfit', label: 'Outfits' },
  { key: 'held', label: 'Items' },
];

// Get all items in a given category
export function getItemsByCategory(category) {
  return Object.values(SHOP_CATALOG).filter(item => item.category === category);
}

// Resolve an item asset path to a chrome extension URL
export function getAssetUrl(assetPath) {
  return chrome.runtime.getURL(`assets/tamagotchi/${assetPath}`);
}

// Get animation frame URL for a given animation and frame number
export function getAnimationFrameUrl(animationName, frameNum) {
  const padded = String(frameNum).padStart(3, '0');
  return chrome.runtime.getURL(`assets/tamagotchi/animations/${animationName}/frame_${padded}.png`);
}
