// src/components/buck/BuckInventoryModal.jsx
// Inventory modal: shows owned accessories by slot, tap to equip/unequip.

import React from 'react';
import { SHOP_CATALOG, getAssetUrl } from '../../config/shopCatalog';

const SLOTS = [
  { key: 'hat', label: 'Hats' },
  { key: 'eyewear', label: 'Glasses' },
  { key: 'outfit', label: 'Outfits' },
  { key: 'held', label: 'Held Items' },
];

const BuckInventoryModal = ({ inventory, equippedItems, onClose, onEquip }) => {
  const ownedItems = (inventory?.ownedItems || [])
    .map(id => SHOP_CATALOG[id])
    .filter(Boolean);

  const getItemsBySlot = (slot) => ownedItems.filter(item => item.slot === slot);
  const isEquipped = (itemId, slot) => equippedItems?.[slot]?.id === itemId;
  const hasAnyItems = ownedItems.length > 0;

  const closeIcon = chrome.runtime.getURL('assets/tamagotchi/ui/icons/icon_close.png');
  const shopSign = chrome.runtime.getURL('assets/tamagotchi/ui/shop/shop_sign.png');

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
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          Buck's Wardrobe
        </span>
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

      {/* Content */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: 12,
        background: 'var(--bg-primary)',
      }}>
        {!hasAnyItems ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: 200, gap: 10,
            color: 'var(--text-tertiary)',
          }}>
            <img
              src={shopSign}
              alt=""
              style={{ width: 48, height: 48, imageRendering: 'pixelated', opacity: 0.4 }}
            />
            <span style={{ fontSize: 13 }}>No items yet!</span>
            <span style={{ fontSize: 11, opacity: 0.6 }}>Visit the shop to gear up Buck</span>
          </div>
        ) : (
          SLOTS.map(slot => {
            const slotItems = getItemsBySlot(slot.key);
            if (slotItems.length === 0) return null;

            return (
              <div key={slot.key} style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  color: 'var(--text-secondary)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {slot.label}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 8,
                }}>
                  {slotItems.map(item => {
                    const equipped = isEquipped(item.id, slot.key);
                    return (
                      <button
                        key={item.id}
                        onClick={() => onEquip(equipped ? null : item.id, slot.key)}
                        style={{
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', gap: 4,
                          padding: 8,
                          background: equipped ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-secondary)',
                          border: equipped ? '2px solid #22c55e' : '1px solid var(--border-primary)',
                          borderRadius: 10,
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{
                          width: 36, height: 36,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'var(--bg-tertiary)',
                          borderRadius: 6,
                        }}>
                          <img
                            src={getAssetUrl(item.asset)}
                            alt={item.name}
                            style={{
                              width: 28, height: 28,
                              imageRendering: 'pixelated', objectFit: 'contain',
                            }}
                          />
                        </div>
                        <span style={{
                          fontSize: 9, fontWeight: 500,
                          color: 'var(--text-primary)',
                          textAlign: 'center',
                        }}>
                          {item.name}
                        </span>
                        {equipped && (
                          <div style={{
                            position: 'absolute', top: 3, right: 3,
                            width: 14, height: 14,
                            background: '#22c55e', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 8, color: '#fff', fontWeight: 700,
                            boxShadow: '0 0 6px #22c55e66',
                          }}>
                            E
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
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

export default BuckInventoryModal;
