// src/components/buck/BuckTamagotchi.jsx
// Tamagotchi orchestrator: manages game state (chrome.storage, messaging, mood),
// renders the new layered sprite scene, and handles modals/overlays.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import TamagotchiScene from '../tamagotchi/TamagotchiScene';
import BuckStatusBars from './BuckStatusBars';
import BuckSpeechBubble from './BuckSpeechBubble';
import BuckEffects from './BuckEffects';
import BuckShopModal from './BuckShopModal';
import BuckInventoryModal from './BuckInventoryModal';
import FaceStretchEasterEgg from './FaceStretchEasterEgg';
import { getRandomDialog } from '../../config/shopCatalog';

const CHEAPEST_FOOD_ID = 'water';
const CHEAPEST_FOOD_COST = 3;
const PET_COOLDOWN_SECONDS = 30;

const BuckTamagotchi = () => {
  // Core game state
  const [tamaState, setTamaState] = useState(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [inventory, setInventory] = useState({ ownedItems: [] });
  const [mood, setMood] = useState('happy');
  const [petCooldown, setPetCooldown] = useState(0);
  const [speechText, setSpeechText] = useState('');
  const [effects, setEffects] = useState([]);
  const [showShop, setShowShop] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showEasterEgg, setShowEasterEgg] = useState(false);

  const cooldownRef = useRef(null);
  const clickTimesRef = useRef([]);
  const speechTimeoutRef = useRef(null);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const showSpeech = useCallback((text) => {
    setSpeechText(text);
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    speechTimeoutRef.current = setTimeout(() => setSpeechText(''), 4000);
  }, []);

  const addEffect = useCallback((type) => {
    const id = Date.now() + Math.random();
    setEffects(prev => [...prev, { id, type }]);
    setTimeout(() => setEffects(prev => prev.filter(e => e.id !== id)), 1800);
  }, []);

  // ─── Data fetching ───────────────────────────────────────────────────────
  const fetchState = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'GET_TAMAGOTCHI_STATE' }, (response) => {
      if (chrome.runtime.lastError || !response?.success) return;
      setTamaState(response.state);
      setCoinBalance(response.coinBalance);
      setInventory(response.inventory);
      setMood(response.mood);

      const now = Date.now();
      const lastPet = response.state.lastPetTimestamp || 0;
      const remaining = Math.max(0, Math.ceil((PET_COOLDOWN_SECONDS * 1000 - (now - lastPet)) / 1000));
      setPetCooldown(remaining);
    });
  }, []);

  useEffect(() => {
    fetchState();
    showSpeech(getRandomDialog('onPopupOpen'));
  }, []);

  useEffect(() => {
    const listener = (changes, area) => {
      if (area !== 'local') return;
      if (changes.buck_tamagotchi_state || changes.gme_coin_balance || changes.buck_inventory) {
        fetchState();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [fetchState]);

  // Pet cooldown ticker
  useEffect(() => {
    if (petCooldown <= 0) { clearInterval(cooldownRef.current); return; }
    cooldownRef.current = setInterval(() => {
      setPetCooldown(prev => { if (prev <= 1) { clearInterval(cooldownRef.current); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(cooldownRef.current);
  }, [petCooldown]);

  // ─── Scene action handlers ─────────────────────────────────────────────
  const handleFeed = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'FEED_BUCK', itemId: CHEAPEST_FOOD_ID }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success) {
        setTamaState(response.state);
        setCoinBalance(response.coinBalance);
        setMood(response.mood);
        showSpeech(getRandomDialog('onFeed'));
        addEffect('sparkle');
      } else if (response?.error === 'Not enough coins') {
        showSpeech("We don't have enough coins...");
        addEffect('steam');
      }
    });
  }, [showSpeech, addEffect]);

  const handlePlay = useCallback(() => {
    // Play action maps to petting for now
    chrome.runtime.sendMessage({ type: 'PET_BUCK' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success) {
        setTamaState(response.state);
        setMood(response.mood);
        setPetCooldown(PET_COOLDOWN_SECONDS);
        showSpeech(getRandomDialog('onPet'));
        addEffect('heart');
      } else if (response?.cooldownRemaining) {
        setPetCooldown(response.cooldownRemaining);
        showSpeech('Buck needs a little break first...');
      }
    });
  }, [showSpeech, addEffect]);

  const handleSleep = useCallback(() => {
    showSpeech('Zzz... five more minutes...');
    addEffect('sparkle');
  }, [showSpeech, addEffect]);

  const handleClean = useCallback(() => {
    showSpeech('Tidying up the office!');
    addEffect('dust');
  }, [showSpeech, addEffect]);

  // Easter egg: 5 clicks within 1.5s
  const handleBuckClick = useCallback(() => {
    const now = Date.now();
    clickTimesRef.current.push(now);
    clickTimesRef.current = clickTimesRef.current.filter(t => now - t < 1500);
    if (clickTimesRef.current.length >= 5) {
      clickTimesRef.current = [];
      setShowEasterEgg(true);
    }
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────
  if (!tamaState) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 200, color: 'var(--text-tertiary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <img
            src={chrome.runtime.getURL('assets/tamagotchi/animations/emotions/happy/frame_000.png')}
            alt=""
            style={{ width: 48, height: 48, imageRendering: 'pixelated', opacity: 0.5, animation: 'buckLoadPulse 1.2s ease-in-out infinite' }}
          />
          <div style={{ fontSize: 12, marginTop: 8 }}>Loading Buck...</div>
          <style>{`
            @keyframes buckLoadPulse {
              0%, 100% { opacity: 0.3; transform: scale(0.95); }
              50% { opacity: 0.6; transform: scale(1.05); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%',
      gap: 6,
      position: 'relative',
    }}>
      {/* New layered sprite scene */}
      <TamagotchiScene
        hunger={tamaState.hunger}
        happiness={tamaState.happiness || 0}
        coins={coinBalance}
        mood={mood}
        onFeed={handleFeed}
        onSleep={handleSleep}
        onPlay={handlePlay}
        onClean={handleClean}
        onBuckClick={handleBuckClick}
      >
        {/* Speech bubble + effects overlay inside the scene */}
        {(speechText || effects.length > 0) && (
          <div style={{
            position: 'absolute',
            left: '50%', bottom: '18%',
            transform: 'translateX(-50%)',
            zIndex: 8,
            pointerEvents: 'none',
          }}>
            {speechText && <BuckSpeechBubble text={speechText} />}
            <BuckEffects effects={effects} />
          </div>
        )}
      </TamagotchiScene>

      {/* Status bars */}
      <BuckStatusBars hunger={tamaState.hunger} happiness={tamaState.happiness || 0} />

      {/* Shop and Inventory buttons */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button
          onClick={() => setShowShop(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 12px', border: '2px solid rgba(255,255,255,0.15)',
            borderRadius: 8, background: 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
            fontSize: 11, fontWeight: 600, fontFamily: 'monospace',
            transition: 'all 0.15s ease',
          }}
        >
          <img
            src={chrome.runtime.getURL('assets/tamagotchi/ui/icons/icon_shop.png')}
            alt="" style={{ width: 14, height: 14, imageRendering: 'pixelated' }}
          />
          Shop
        </button>
        <button
          onClick={() => setShowInventory(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 12px', border: '2px solid rgba(255,255,255,0.15)',
            borderRadius: 8, background: 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
            fontSize: 11, fontWeight: 600, fontFamily: 'monospace',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 13 }}>{'\uD83C\uDF92'}</span>
          Items
        </button>
      </div>

      {/* Modals */}
      {showShop && (
        <BuckShopModal
          coinBalance={coinBalance}
          inventory={inventory}
          onClose={() => setShowShop(false)}
          onPurchase={(itemId) => {
            chrome.runtime.sendMessage({ type: 'BUY_ITEM', itemId }, (response) => {
              if (chrome.runtime.lastError) return;
              if (response?.success) {
                setTamaState(response.state);
                setCoinBalance(response.coinBalance);
                if (response.inventory) setInventory(response.inventory);
                setMood(response.mood);
                showSpeech(getRandomDialog('onShopBuy'));
                addEffect('confetti');
                addEffect('coins');
              }
            });
          }}
        />
      )}

      {showInventory && (
        <BuckInventoryModal
          inventory={inventory}
          equippedItems={tamaState.equippedItems || {}}
          onClose={() => setShowInventory(false)}
          onEquip={(itemId, slot) => {
            chrome.runtime.sendMessage({ type: 'EQUIP_ITEM', itemId, slot }, (response) => {
              if (chrome.runtime.lastError) return;
              if (response?.success) {
                setTamaState(response.state);
                setMood(response.mood);
                if (itemId) {
                  showSpeech(getRandomDialog('onEquip'));
                  addEffect('star');
                }
              }
            });
          }}
        />
      )}

      {showEasterEgg && (
        <FaceStretchEasterEgg onClose={() => setShowEasterEgg(false)} />
      )}
    </div>
  );
};

export default BuckTamagotchi;
