// src/components/buck/BuckActionButtons.jsx
// Feed / Pet / Shop / Items action buttons with pixel art icons and hover states.

import React, { useState } from 'react';

const ActionButton = ({ label, icon, onClick, disabled, badge }) => {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: '7px 10px 5px',
        background: disabled ? 'var(--bg-tertiary)'
          : hover ? 'var(--hover-bg)' : 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'all 0.15s ease',
        position: 'relative',
        minWidth: 58,
        color: 'var(--text-primary)',
        transform: hover && !disabled ? 'translateY(-1px)' : 'none',
        boxShadow: hover && !disabled ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
      }}
    >
      <img
        src={icon}
        alt={label}
        style={{
          width: 20, height: 20,
          imageRendering: 'pixelated',
          transition: 'transform 0.15s ease',
          transform: hover && !disabled ? 'scale(1.1)' : 'scale(1)',
        }}
      />
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1 }}>
        {label}
      </span>
      {badge && (
        <span style={{
          position: 'absolute', top: -5, right: -5,
          background: '#ef4444', color: '#fff',
          fontSize: 9, fontWeight: 700,
          padding: '1px 4px', borderRadius: 6,
          minWidth: 14, textAlign: 'center',
          boxShadow: '0 1px 3px rgba(239,68,68,0.4)',
        }}>
          {badge}
        </span>
      )}
    </button>
  );
};

const BuckActionButtons = ({ onFeed, onPet, onShop, onInventory, petCooldown, feedCost }) => {
  const feedIcon = chrome.runtime.getURL('assets/tamagotchi/ui/icons/icon_feed.png');
  const petIcon = chrome.runtime.getURL('assets/tamagotchi/ui/icons/icon_play.png');
  const shopIcon = chrome.runtime.getURL('assets/tamagotchi/ui/icons/icon_shop.png');
  const itemsIcon = chrome.runtime.getURL('assets/tamagotchi/ui/icons/icon_settings.png');

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: 8,
      width: '100%',
      padding: '0 8px',
    }}>
      <ActionButton
        label={`Feed (${feedCost})`}
        icon={feedIcon}
        onClick={onFeed}
      />
      <ActionButton
        label={petCooldown > 0 ? `Pet (${petCooldown}s)` : 'Pet'}
        icon={petIcon}
        onClick={onPet}
        disabled={petCooldown > 0}
      />
      <ActionButton
        label="Shop"
        icon={shopIcon}
        onClick={onShop}
      />
      <ActionButton
        label="Items"
        icon={itemsIcon}
        onClick={onInventory}
      />
    </div>
  );
};

export default BuckActionButtons;
