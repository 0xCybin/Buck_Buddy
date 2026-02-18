// src/components/lookup/SkuLookupModal.jsx
// Modal for looking up GameStop products by SKU number.
// Opens the GameStop search page in a new tab with the entered SKU.
//
// TODO: No Enter key submission -- user must click the button.

import React, { useState } from "react";
import { X, Search } from "../../icons";
import SoundButton from "../common/SoundButton";

const SkuLookupModal = ({ isOpen, onClose }) => {
  const [skuNumber, setSkuNumber] = useState("");
  const [error, setError] = useState(null);

  // Validate input and open GameStop search in a new tab
  const handleLookupSku = async () => {
    if (!skuNumber.trim()) {
      setError("Please enter a SKU number");
      return;
    }

    try {
      const url = `https://www.gamestop.com/search/?q=${skuNumber}&type=product`;
      window.open(url, "_blank");
      onClose();
    } catch (error) {
      console.error("Failed to lookup SKU:", error);
      setError("Failed to lookup SKU. Please try again.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div
        className="rounded-lg w-full max-w-md"
        style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
      >
        <div
          className="p-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border-primary)' }}
        >
          <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>SKU Lookup</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="skuNumber"
                className="block text-sm font-medium mb-1"
              >
                SKU Number
              </label>
              <input
                type="text"
                id="skuNumber"
                value={skuNumber}
                onChange={(e) => {
                  setSkuNumber(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleLookupSku()}
                className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--brand-primary)' }}
                placeholder="Enter SKU number"
              />
            </div>

            {error && <div className="text-sm" style={{ color: 'var(--error-color)' }}>{error}</div>}
          </div>
        </div>

        <div className="p-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <SoundButton
            onClick={handleLookupSku}
            className="w-full text-white py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2 text-sm font-medium btn-brand"
          >
            <Search className="w-4 h-4" />
            Search SKU
          </SoundButton>
        </div>
      </div>
    </div>
  );
};

export default SkuLookupModal;
