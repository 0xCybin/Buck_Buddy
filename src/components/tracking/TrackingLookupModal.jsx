// src/components/tracking/TrackingLookupModal.jsx
// Modal for looking up package tracking by number.
// Detects the carrier (FedEx, USPS, etc.) via carrierDetector and
// opens the carrier's tracking page in a new tab.
//
// TODO: No Enter key submission -- user must click the button.

import React, { useState } from "react";
import { X, Search } from "../../icons";
import carrierDetector from "../../services/tracking/carrierDetector";

const TrackingLookupModal = ({ isOpen, onClose }) => {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [error, setError] = useState(null);

  // Detect carrier from the tracking number format, then open tracking URL
  const handleTrackPackage = async () => {
    if (!trackingNumber.trim()) {
      setError("Please enter a tracking number");
      return;
    }

    try {
      const carrier = carrierDetector.detectCarrier(trackingNumber);
      if (!carrier) {
        setError("Invalid tracking number format");
        return;
      }

      window.open(carrier.getUrl(trackingNumber), "_blank");
    } catch (error) {
      console.error("Failed to track package:", error);
      setError("Failed to track package. Please try again.");
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
          <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Track Package</h3>
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
                htmlFor="trackingNumber"
                className="block text-sm font-medium mb-1"
              >
                Tracking Number
              </label>
              <input
                type="text"
                id="trackingNumber"
                value={trackingNumber}
                onChange={(e) => {
                  setTrackingNumber(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleTrackPackage()}
                className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--brand-primary)' }}
                placeholder="Enter tracking number"
              />
            </div>

            {error && <div className="text-sm" style={{ color: 'var(--error-color)' }}>{error}</div>}
          </div>
        </div>

        <div className="p-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <button
            onClick={handleTrackPackage}
            className="w-full text-white py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2 text-sm font-medium btn-brand"
          >
            <Search className="w-4 h-4" />
            Track Package
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrackingLookupModal;
