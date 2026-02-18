/**
 * FedEx Tracking API Service
 *
 * Authenticates via OAuth2 client_credentials grant, then queries the
 * FedEx Track v1 API. Tokens are cached in-memory with a 60s safety
 * buffer before expiry. Exports { trackPackage }.
 */

import apiKeys from '../../config/apiKeys';

const FEDEX_BASE_URL = 'https://apis.fedex.com';

// In-memory token cache (lives for the service worker session)
let cachedToken = null;
let tokenExpiresAt = 0;

// --- OAuth2 Authentication ---

async function getAccessToken() {
  // Return cached token if still valid (with 60s buffer before expiry)
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const { apiKey, secretKey } = await apiKeys.fedex;

  // FedEx requires x-www-form-urlencoded for the OAuth endpoint
  const response = await fetch(`${FEDEX_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(secretKey)}`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FedEx OAuth failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000; // expires_in is seconds

  return cachedToken;
}

// --- Tracking ---

async function trackPackage(trackingNumber) {
  const token = await getAccessToken();

  // POST to Track v1 with detailed scan history enabled
  const response = await fetch(`${FEDEX_BASE_URL}/track/v1/trackingnumbers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      trackingInfo: [
        {
          trackingNumberInfo: {
            trackingNumber: trackingNumber,
          },
        },
      ],
      includeDetailedScans: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FedEx Track API failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return parseTrackingResponse(data, trackingNumber);
}

// --- Response Parsing ---

function parseTrackingResponse(data, trackingNumber) {
  // FedEx nests results deeply: output > completeTrackResults[] > trackResults[]
  const trackResult =
    data?.output?.completeTrackResults?.[0]?.trackResults?.[0];

  if (!trackResult) {
    throw new Error('No tracking results found');
  }

  // API may return a result object with an embedded error instead of an HTTP error
  if (trackResult.error) {
    throw new Error(
      trackResult.error.message || 'Tracking number not found'
    );
  }

  const latestStatus = trackResult.latestStatusDetail || {};
  const status = {
    code: latestStatus.code || 'UNKNOWN',
    description: latestStatus.description || 'Unknown',
    statusByLocale: latestStatus.statusByLocale || latestStatus.description || 'Unknown',
  };

  // Extract key dates from the dateAndTimes array by type
  const dateAndTimes = trackResult.dateAndTimes || [];
  let estimatedDelivery = null;
  let actualDelivery = null;
  let shipDate = null;

  for (const dt of dateAndTimes) {
    if (dt.type === 'ESTIMATED_DELIVERY') {
      estimatedDelivery = dt.dateTime;
    } else if (dt.type === 'ACTUAL_DELIVERY') {
      actualDelivery = dt.dateTime;
    } else if (dt.type === 'SHIP') {
      shipDate = dt.dateTime;
    }
  }

  // Normalize scan events into a flat, carrier-agnostic format
  const scanEvents = (trackResult.scanEvents || []).map((event) => ({
    date: event.date,
    description: event.eventDescription || event.derivedStatus || '',
    city: event.scanLocation?.city || '',
    state: event.scanLocation?.stateOrProvinceCode || '',
    country: event.scanLocation?.countryCode || '',
    location: formatScanLocation(event.scanLocation),
  }));

  const packageDetails = trackResult.packageDetails || {};

  // Return a normalized tracking object consumed by TrackingPreview
  return {
    trackingNumber,
    status,
    estimatedDelivery,
    actualDelivery,
    shipDate,
    scanEvents,
    packageDetails: {
      weight: packageDetails.weightAndDimensions?.weight?.[0]
        ? `${packageDetails.weightAndDimensions.weight[0].value} ${packageDetails.weightAndDimensions.weight[0].unit}`
        : null,
      packaging: packageDetails.packagingDescription?.description || null,
    },
    serviceType: trackResult.serviceDetail?.description || null,
    deliveryAttempts: trackResult.deliveryDetails?.deliveryAttempts || null,
  };
}

// Build a human-readable location string; omit country for domestic (US) shipments
function formatScanLocation(location) {
  if (!location) return 'Location unavailable';

  const parts = [];
  if (location.city) parts.push(location.city);
  if (location.stateOrProvinceCode) parts.push(location.stateOrProvinceCode);
  if (location.countryCode && location.countryCode !== 'US') {
    parts.push(location.countryName || location.countryCode);
  }

  return parts.length > 0 ? parts.join(', ') : 'Location unavailable';
}

export default { trackPackage };
