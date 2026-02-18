/**
 * TrackingPreview - Full-screen modal that displays tracking information
 * for a package (FedEx/USPS). Shows status badge, delivery date, and a
 * timeline of scan events. Supports loading, error, and empty states with
 * retry. Parent provides data via props; this component is purely presentational
 * except for carrier detection on mount.
 */

import React, { useState, useEffect } from "react";
import {
  Package,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Truck,
  MapPin,
  CircleDot,
} from "lucide-react";
import { X, RefreshCw, Clock } from "../../icons";
import carrierDetector from "../../services/tracking/carrierDetector";

// Status code -> color/label mapping. Codes match FedEx/USPS normalized status codes.
const STATUS_COLORS = {
  DL: { label: "Delivered", style: { backgroundColor: 'var(--success-bg)', color: 'var(--success-color)' } },
  IT: { label: "In Transit", style: { backgroundColor: 'var(--info-bg, rgba(59,130,246,0.2))', color: 'var(--info-color, #60a5fa)' } },
  OD: { label: "Out for Delivery", style: { backgroundColor: 'var(--warning-bg)', color: 'var(--warning-color)' } },
  PU: { label: "Picked Up", style: { backgroundColor: 'rgba(168,85,247,0.2)', color: '#c084fc' } },
  DE: { label: "Delivery Exception", style: { backgroundColor: 'var(--error-bg)', color: 'var(--error-color)' } },
  CA: { label: "Cancelled", style: { backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' } },
};

const TrackingPreview = ({
  trackingNumber,
  trackingData,
  loading,
  error,
  onClose,
  onRetry,
}) => {
  const [carrier, setCarrier] = useState(null);

  // Detect carrier (FedEx, USPS, etc.) from the tracking number format
  useEffect(() => {
    const detectedCarrier = carrierDetector.detectCarrier(trackingNumber);
    setCarrier(
      detectedCarrier
        ? { name: detectedCarrier.name, url: detectedCarrier.getUrl(trackingNumber) }
        : { name: "Unknown", url: null }
    );
  }, [trackingNumber]);

  // Format ISO date string to a short readable date (e.g., "Mon, Jan 5, 2026")
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Format ISO date string to date+time for scan event timeline
  const formatDateTime = (dateStr) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusStyle = (code) => {
    return STATUS_COLORS[code] || { label: "Unknown", style: { backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' } };
  };

  if (!carrier) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="rounded-lg shadow-lg w-96 max-h-[80vh] flex flex-col relative" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
        {/* Header */}
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <Package className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {carrier.name} Tracking
              </h3>
              <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                #{trackingNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 transition-colors rounded"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Fetching tracking info...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <AlertTriangle className="w-8 h-8" style={{ color: 'var(--error-color)' }} />
              <p className="text-sm text-center" style={{ color: 'var(--error-color)' }}>{error}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                >
                  <RefreshCw size={14} />
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Tracking Data */}
          {trackingData && !loading && (
            <>
              {/* Status Badge */}
              <div
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{ backgroundColor: getStatusStyle(trackingData.status.code).style.backgroundColor }}
              >
                {trackingData.status.code === "DL" ? (
                  <CheckCircle2 className="w-5 h-5" style={{ color: getStatusStyle(trackingData.status.code).style.color }} />
                ) : trackingData.status.code === "OD" ? (
                  <Truck className="w-5 h-5" style={{ color: getStatusStyle(trackingData.status.code).style.color }} />
                ) : (
                  <Clock className="w-5 h-5" style={{ color: getStatusStyle(trackingData.status.code).style.color }} />
                )}
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: getStatusStyle(trackingData.status.code).style.color }}
                  >
                    {trackingData.status.statusByLocale || trackingData.status.description}
                  </p>
                  {trackingData.serviceType && (
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{trackingData.serviceType}</p>
                  )}
                </div>
              </div>

              {/* Delivery Date */}
              {(trackingData.actualDelivery || trackingData.estimatedDelivery) && (
                <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--card-bg)' }}>
                  <MapPin className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {trackingData.actualDelivery ? "Delivered" : "Estimated Delivery"}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {formatDate(trackingData.actualDelivery || trackingData.estimatedDelivery)}
                    </p>
                  </div>
                </div>
              )}

              {/* Scan History */}
              {trackingData.scanEvents?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
                    Scan History
                  </h4>
                  <div className="space-y-0">
                    {trackingData.scanEvents.map((event, index) => (
                      <div key={index} className="flex gap-3">
                        {/* Timeline line */}
                        <div className="flex flex-col items-center">
                          <CircleDot
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: index === 0 ? '#c084fc' : 'var(--text-tertiary)' }}
                          />
                          {index < trackingData.scanEvents.length - 1 && (
                            <div className="w-px flex-1 my-1" style={{ backgroundColor: 'var(--border-primary)' }} />
                          )}
                        </div>
                        {/* Event details */}
                        <div className="pb-4 flex-1 min-w-0">
                          <p
                            className="text-sm font-medium"
                            style={{ color: index === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                          >
                            {event.description}
                          </p>
                          {event.location && event.location !== "Location unavailable" && (
                            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{event.location}</p>
                          )}
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{formatDateTime(event.date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* No data and not loading/error — simple carrier display (fallback) */}
          {!trackingData && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Package className="w-8 h-8" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Click retry to fetch tracking details
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                >
                  <RefreshCw size={14} />
                  Fetch Info
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer — View on carrier site */}
        {carrier.url && (
          <div className="p-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
            <a
              href={carrier.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2 rounded-lg transition-colors text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
            >
              View on {carrier.name}
              <ExternalLink size={14} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackingPreview;
