/**
 * ProductPreview - Full-screen modal that displays product information
 * for a GameStop SKU. Shows product image, name, price, availability,
 * platform, and description. Supports loading, error, and empty states
 * with retry. Data comes from the gamestopScraper via background messaging.
 * Falls back to a GameStop search URL when no direct product URL is available.
 */

import React from "react";
import {
  ShoppingCart,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { X, RefreshCw } from "../../icons";

// Availability label -> badge color mapping
const AVAILABILITY_COLORS = {
  "In Stock": { style: { backgroundColor: 'rgba(34,197,94,0.2)', color: 'var(--success-color)' } },
  "Out of Stock": { style: { backgroundColor: 'rgba(239,68,68,0.2)', color: 'var(--error-color)' } },
  "Pre-Order": { style: { backgroundColor: 'rgba(234,179,8,0.2)', color: '#facc15' } },
  "Backorder": { style: { backgroundColor: 'rgba(249,115,22,0.2)', color: '#fb923c' } },
  "Limited Stock": { style: { backgroundColor: 'rgba(245,158,11,0.2)', color: '#fbbf24' } },
  "Unknown": { style: { backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' } },
};

const ProductPreview = ({
  sku,
  productData,
  loading,
  error,
  onClose,
  onRetry,
}) => {
  const getAvailabilityStyle = (availability) => {
    return AVAILABILITY_COLORS[availability] || AVAILABILITY_COLORS["Unknown"];
  };

  // Format numeric price with currency symbol via Intl (defaults to USD)
  const formatPrice = (price, currency) => {
    if (price == null) return null;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(price);
  };

  // Use the direct product URL when available; fall back to a search query
  const searchUrl = `https://www.gamestop.com/search/?q=${encodeURIComponent(sku)}&type=product`;
  const footerUrl = productData?.url || searchUrl;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="rounded-lg shadow-lg w-96 max-h-[80vh] flex flex-col relative" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
        {/* Header */}
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <ShoppingCart className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Product Lookup
              </h3>
              <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                #{sku}
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
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Looking up product...</p>
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

          {/* Product Data */}
          {productData && !loading && (
            <div className="flex flex-col items-center gap-4">
              {/* Product Image */}
              {productData.image && (
                <div className="w-32 h-32 rounded-lg overflow-hidden flex items-center justify-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <img
                    src={productData.image}
                    alt={productData.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                </div>
              )}

              {/* Product Name */}
              <h4 className="text-sm font-semibold text-center leading-snug" style={{ color: 'var(--text-primary)' }}>
                {productData.name}
              </h4>

              {/* Price */}
              {productData.price != null && (
                <p className="text-2xl font-bold" style={{ color: 'var(--success-color)' }}>
                  {formatPrice(productData.price, productData.currency)}
                </p>
              )}

              {/* Availability Badge */}
              {productData.availability && productData.availability !== "Unknown" && (
                <span
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                  style={getAvailabilityStyle(productData.availability).style}
                >
                  {productData.availability}
                </span>
              )}

              {/* Platform */}
              {productData.platform && (
                <div className="flex items-center gap-2 p-2 rounded-lg w-full" style={{ backgroundColor: 'var(--card-bg)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Platform:</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {productData.platform}
                  </span>
                </div>
              )}

              {/* Description */}
              {productData.description && (
                <p className="text-xs text-center leading-relaxed line-clamp-3" style={{ color: 'var(--text-tertiary)' }}>
                  {productData.description}
                </p>
              )}
            </div>
          )}

          {/* No data and not loading/error */}
          {!productData && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <ShoppingCart className="w-8 h-8" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Click retry to look up this product
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                >
                  <RefreshCw size={14} />
                  Look Up
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer — View on GameStop */}
        <div className="p-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <a
            href={footerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg transition-colors text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          >
            View on GameStop
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default ProductPreview;
