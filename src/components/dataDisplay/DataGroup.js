/**
 * DataGroup - Renders a group of extracted data items (tracking numbers, SKUs,
 * orders, etc.) with copy-to-clipboard, inline preview modals, and
 * external-link actions. Each data type gets a distinct icon and set of
 * action buttons. Tracking and SKU types support in-app preview modals
 * (TrackingPreview / ProductPreview) fetched via chrome.runtime messaging.
 */

import React, { useState } from "react";
import {
  ExternalLink,
  Package,
  CreditCard,
  Phone,
  Ticket,
  Medal,
  User,
  ShoppingCart,
  Mail,
  ScanLine,
  Hash,
  Info,
  Loader2,
  Store,
  DollarSign,
} from "lucide-react";
import { Copy, Check } from "../../icons";
import carrierDetector from "../../services/tracking/carrierDetector";
import TrackingPreview from "../preview/TrackingPreview";
import ProductPreview from "../preview/ProductPreview";
import SoundButton from "../../components/common/SoundButton";
import { achievementSystem } from "../../utils/achievementSystem";

const DataGroup = ({ title, items, type }) => {
  // -- Tracking preview state --
  const [selectedTracking, setSelectedTracking] = useState(null); // tracking number with open modal
  const [trackingData, setTrackingData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);               // which item just got copied
  const [loadingTrackingId, setLoadingTrackingId] = useState(null); // spinner for specific row

  // -- Product preview state --
  const [selectedSku, setSelectedSku] = useState(null);
  const [productData, setProductData] = useState(null);
  const [productLoading, setProductLoading] = useState(false);
  const [productError, setProductError] = useState(null);
  const [loadingSkuId, setLoadingSkuId] = useState(null);

  // Copy item to clipboard; strips formatting from phone numbers
  const handleCopy = async (text) => {
    try {
      const copyText = type === "phone" ? text.replace(/\D/g, "") : text;
      await navigator.clipboard.writeText(copyText);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Fetch tracking details via background service worker (FedEx or USPS API)
  const handleTrackingInfo = async (trackingNumber) => {
    const carrier = carrierDetector.detectCarrier(trackingNumber);
    if (!carrier) return;

    // Route to the right background handler based on carrier
    const messageType =
      carrier.name === "FedEx" ? "FEDEX_TRACK" :
      carrier.name === "USPS" ? "USPS_TRACK" : null;

    if (!messageType) return;

    setLoadingTrackingId(trackingNumber);
    setTrackingData(null);
    setTrackingError(null);
    setTrackingLoading(true);
    setSelectedTracking(trackingNumber);

    try {
      const response = await chrome.runtime.sendMessage({
        type: messageType,
        trackingNumber,
      });

      if (response?.success) {
        setTrackingData(response.data);
      } else {
        setTrackingError(response?.error || "Failed to fetch tracking data");
      }
    } catch (error) {
      setTrackingError(error.message || "Failed to fetch tracking data");
    } finally {
      setTrackingLoading(false);
      setLoadingTrackingId(null);
    }
  };

  // Open GameStop search in a new tab for the given SKU
  const handleSkuLookup = async (sku) => {
    try {
      const searchUrl = `https://www.gamestop.com/search/?q=${sku}&type=product`;
      window.open(searchUrl, "_blank");
      await achievementSystem.unlockAchievement("SKU_LOOKUP");
    } catch (error) {
      console.error("Error unlocking SKU_LOOKUP achievement:", error);
    }
  };

  // Fetch product details via background service worker (gamestopScraper)
  const handleProductLookup = async (sku) => {
    setLoadingSkuId(sku);
    setProductData(null);
    setProductError(null);
    setProductLoading(true);
    setSelectedSku(sku);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GAMESTOP_SKU_LOOKUP',
        sku,
      });

      if (response?.success) {
        setProductData(response.data);
      } else {
        setProductError(response?.error || 'Failed to look up product');
      }
    } catch (error) {
      setProductError(error.message || 'Failed to look up product');
    } finally {
      setProductLoading(false);
      setLoadingSkuId(null);
    }
  };

  // Open carrier tracking page in a new tab
  const handleTrackingClick = (tracking) => {
    const carrier = carrierDetector.detectCarrier(tracking);
    if (!carrier) return;

    // Open carrier site in new tab
    window.open(carrier.getUrl(tracking), "_blank");

    // Show preview modal for all carriers
    setSelectedTracking(tracking);
  };

  const handleTicketClick = (ticket) => {
    window.open(
      `https://gamestop.zendesk.com/agent/tickets/${ticket}`,
      "_blank"
    );
  };

  const handlePurClick = (pur) => {
    window.open(`https://gamestop.com/poweruprewards/summary/${pur}`, "_blank");
  };

  // Map data type to its icon; each type gets a distinct color
  const getIcon = () => {
    switch (type) {
      case "customer":
        return <User className="w-4 h-4 text-blue-400" />;
      case "tracking":
        return <Package className="w-4 h-4 text-purple-400" />;
      case "pur":
        return <Medal className="w-4 h-4 text-yellow-400" />;
      case "giftCard":
        return <CreditCard className="w-4 h-4 text-green-400" />;
      case "phone":
        return <Phone className="w-4 h-4 text-red-400" />;
      case "ticket":
        return <Ticket className="w-4 h-4 text-orange-400" />;
      case "order":
        return <ShoppingCart className="w-4 h-4 text-pink-400" />;
      case "email":
        return <Mail className="w-4 h-4 text-teal-400" />;
      case "sku":
        return <ScanLine className="w-4 h-4 text-indigo-400" />;
      case "store":
        return <Store className="w-4 h-4 text-amber-400" />;
      case "amount":
        return <DollarSign className="w-4 h-4 text-emerald-400" />;
      default:
        return <Hash className="w-4 h-4 text-zinc-400" />;
    }
  };

  // Rebrand "PowerUp Rewards" as "PRO Rewards" for display
  const getTitle = (originalTitle) => {
    if (originalTitle === "PowerUp Rewards") {
      return "PRO Rewards";
    }
    return originalTitle;
  };

  if (!items?.length) return null;

  return (
    <>
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
        <div className="p-1" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex justify-center items-center gap-2">
            {getIcon()}
            <h3 className="text-lg font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
              {getTitle(title)}
            </h3>
            <span className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
              {items.length} items
            </span>
          </div>
        </div>

        <div className="p-2 space-y-1">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-0.5 rounded transition-colors group"
              style={{ cursor: "pointer", backgroundColor: 'var(--card-bg)' }}
              onClick={() => handleCopy(item)}
            >
              <span className="text-sm font-mono break-all" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', color: 'var(--text-secondary)' }}>
                {String(item)}
              </span>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <SoundButton
                  onClick={() => handleCopy(item)}
                  className="p-1.5 rounded transition-colors"
                  style={
                    copiedId === item
                      ? { backgroundColor: 'var(--success-color)', color: '#fff' }
                      : { backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }
                  }
                  title={copiedId === item ? "Copied!" : "Copy to clipboard"}
                >
                  {copiedId === item ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </SoundButton>

                {type === "sku" && (
                  <>
                    <SoundButton
                      onClick={() => handleProductLookup(item)}
                      className="p-1.5 rounded transition-colors"
                      style={
                        loadingSkuId === item
                          ? { backgroundColor: '#4f46e5', color: '#fff' }
                          : { backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }
                      }
                      title="View product info"
                      disabled={loadingSkuId === item}
                    >
                      {loadingSkuId === item ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Info className="w-4 h-4" />
                      )}
                    </SoundButton>
                    <SoundButton
                      onClick={() => handleSkuLookup(item)}
                      isOffPage={true}
                      className="p-1.5 rounded transition-colors"
                      style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }}
                      title="Search on GameStop"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </SoundButton>
                  </>
                )}

                {type === "ticket" && (
                  <SoundButton
                    onClick={() => handleTicketClick(item)}
                    isOffPage={true}
                    className="p-1.5 rounded transition-colors"
                    style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }}
                    title="Open ticket"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </SoundButton>
                )}

                {type === "pur" && (
                  <SoundButton
                    onClick={() => handlePurClick(item)}
                    isOffPage={true}
                    className="p-1.5 rounded transition-colors"
                    style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }}
                    title="View PRO Rewards"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </SoundButton>
                )}

                {type === "tracking" && (
                  <>
                    <SoundButton
                      onClick={() => handleTrackingInfo(item)}
                      className="p-1.5 rounded transition-colors"
                      style={
                        loadingTrackingId === item
                          ? { backgroundColor: '#9333ea', color: '#fff' }
                          : { backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }
                      }
                      title="View tracking info"
                      disabled={loadingTrackingId === item}
                    >
                      {loadingTrackingId === item ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Info className="w-4 h-4" />
                      )}
                    </SoundButton>
                    <SoundButton
                      onClick={async () => {
                        const carrier = carrierDetector.detectCarrier(item);
                        if (carrier) {
                          window.open(carrier.getUrl(item), "_blank");
                        }
                      }}
                      isOffPage={true}
                      className="p-1.5 rounded transition-colors"
                      style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }}
                      title="Track package"
                    >
                      <Package className="w-4 h-4" />
                    </SoundButton>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedTracking && (
        <TrackingPreview
          trackingNumber={selectedTracking}
          trackingData={trackingData}
          loading={trackingLoading}
          error={trackingError}
          onClose={() => {
            setSelectedTracking(null);
            setTrackingData(null);
            setTrackingError(null);
          }}
          onRetry={() => handleTrackingInfo(selectedTracking)}
        />
      )}

      {selectedSku && (
        <ProductPreview
          sku={selectedSku}
          productData={productData}
          loading={productLoading}
          error={productError}
          onClose={() => {
            setSelectedSku(null);
            setProductData(null);
            setProductError(null);
          }}
          onRetry={() => handleProductLookup(selectedSku)}
        />
      )}
    </>
  );
};

export default DataGroup;
