// src/components/buck/BuckShopModal.jsx
// Full-screen shop modal with category tabs, pixel-art item cards, and buy buttons.

import React, { useState } from 'react';
import { SHOP_CATEGORIES, getItemsByCategory, getAssetUrl, CONSUMABLE_CATEGORIES } from '../../config/shopCatalog';

const BuckShopModal = ({ coinBalance, inventory, onClose, onPurchase }) => {
  const [activeCategory, setActiveCategory] = useState('food');
  const items = getItemsByCategory(activeCategory);
  const ownedItems = inventory?.ownedItems || [];

  const coinIcon = chrome.runtime.getURL('assets/tamagotchi/ui/currency/gme_coin_1.png');
  const shopSign = chrome.runtime.getURL('assets/tamagotchi/ui/shop/shop_sign.png');
  const closeIcon = chrome.runtime.getURL('assets/tamagotchi/ui/icons/icon_close.png');

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.85)',
      zIndex: 100,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      animation: 'buckModalIn 0.2s ease-out',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '2px solid var(--border-primary)',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={shopSign} alt="Shop"
            style={{ width: 22, height: 22, imageRendering: 'pixelated' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Buck's Shop
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'var(--bg-tertiary)', borderRadius: 6, padding: '3px 8px',
          }}>
            <img src={coinIcon} alt="coins"
              style={{ width: 13, height: 13, imageRendering: 'pixelated' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#eab308', fontFamily: 'monospace' }}>
              {coinBalance}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
              borderRadius: 6, padding: 4, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <img src={closeIcon} alt="Close"
              style={{ width: 14, height: 14, imageRendering: 'pixelated', opacity: 0.7 }} />
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--border-primary)',
        background: 'var(--bg-secondary)',
        overflowX: 'auto', flexShrink: 0,
      }}>
        {SHOP_CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            style={{
              flex: '0 0 auto',
              padding: '7px 12px',
              background: activeCategory === cat.key ? 'var(--bg-primary)' : 'transparent',
              border: 'none',
              borderBottom: activeCategory === cat.key ? '2px solid var(--brand-primary)' : '2px solid transparent',
              color: activeCategory === cat.key ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontSize: 11, fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Item grid */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: 10,
        background: 'var(--bg-primary)',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}>
          {items.map(item => {
            const isConsumable = CONSUMABLE_CATEGORIES.includes(item.category);
            const isOwned = !isConsumable && ownedItems.includes(item.id);
            const canAfford = coinBalance >= item.cost;

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 4,
                  padding: '10px 6px 8px',
                  background: 'var(--bg-secondary)',
                  border: isOwned ? '2px solid #22c55e44' : '1px solid var(--border-primary)',
                  borderRadius: 10,
                  opacity: isOwned ? 0.55 : 1,
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                {/* Item image with frame-like background */}
                <div style={{
                  width: 44, height: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 8,
                  border: '1px solid var(--border-primary)',
                }}>
                  <img
                    src={getAssetUrl(item.asset)}
                    alt={item.name}
                    style={{
                      width: 34, height: 34,
                      imageRendering: 'pixelated', objectFit: 'contain',
                    }}
                  />
                </div>

                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: 'var(--text-primary)',
                  textAlign: 'center', lineHeight: 1.2,
                }}>
                  {item.name}
                </span>

                {/* Stats for consumables */}
                {isConsumable && (
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.3 }}>
                    +{item.hungerRestore} food, +{item.happinessBoost} joy
                  </div>
                )}

                <button
                  onClick={() => !isOwned && onPurchase(item.id)}
                  disabled={isOwned || !canAfford}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    padding: '3px 10px',
                    background: isOwned ? 'var(--bg-tertiary)' : canAfford ? 'var(--brand-primary)' : 'var(--bg-tertiary)',
                    color: isOwned ? 'var(--text-tertiary)' : canAfford ? '#fff' : 'var(--text-tertiary)',
                    border: 'none', borderRadius: 5,
                    fontSize: 10, fontWeight: 600,
                    cursor: isOwned || !canAfford ? 'not-allowed' : 'pointer',
                    opacity: !canAfford && !isOwned ? 0.5 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isOwned ? 'Owned' : (
                    <>
                      <img src={coinIcon} alt="" style={{ width: 10, height: 10, imageRendering: 'pixelated' }} />
                      {item.cost}
                    </>
                  )}
                </button>

                {/* Owned checkmark */}
                {isOwned && (
                  <div style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 16, height: 16,
                    background: '#22c55e', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: '#fff', fontWeight: 700,
                  }}>
                    ok
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes buckModalIn {
          0% { opacity: 0; transform: scale(0.97); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default BuckShopModal;
