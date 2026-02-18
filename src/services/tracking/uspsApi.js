/**
 * USPS Tracking API Service
 *
 * Authenticates via OAuth2 client_credentials grant, then queries the
 * USPS Tracking v3 API. Tokens are cached in-memory with a 60s safety
 * buffer before expiry. Exports { trackPackage }.
 */

import apiKeys from '../../config/apiKeys';

const USPS_BASE_URL = 'https://apis.usps.com';

// In-memory token cache (lives for the service worker session)
let cachedToken = null;
let tokenExpiresAt = 0;

// --- OAuth2 Authentication ---

async function getAccessToken() {
  // Return cached token if still valid (with 60s buffer before expiry)
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const { consumerKey, consumerSecret } = await apiKeys.usps;

  // USPS uses JSON body for OAuth (unlike FedEx which uses form-urlencoded)
  const response = await fetch(`${USPS_BASE_URL}/oauth2/v3/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: consumerKey,
      client_secret: consumerSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`USPS OAuth failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000; // Default 1hr if missing

  return cachedToken;
}

// --- Tracking ---

async function trackPackage(trackingNumber) {
  const token = await getAccessToken();

  // GET request with expand=DETAIL for full scan event history
  const response = await fetch(
    `${USPS_BASE_URL}/tracking/v3/tracking/${encodeURIComponent(trackingNumber)}?expand=DETAIL`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`USPS Tracking API failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return parseTrackingResponse(data, trackingNumber);
}

// Strip HTML tags and decode common entities (USPS sometimes returns HTML in fields)
function stripHtml(str) {
  if (!str) return null;
  return str.replace(/<[^>]*>/g, '').replace(/&#153;/g, '\u2122').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() || null;
}

// --- Response Parsing ---

function parseTrackingResponse(data, trackingNumber) {
  // USPS v3 response structure varies -- handle both flat and nested formats.
  // If data has trackingNumber at top level it's the flat format; otherwise
  // look for the legacy TrackResults.TrackInfo wrapper.
  const trackInfo = data?.trackingNumber
    ? data
    : data?.TrackResults?.TrackInfo || data;

  if (!trackInfo) {
    throw new Error('No tracking results found');
  }

  const statusCategory = trackInfo.statusCategory || trackInfo.StatusCategory || '';
  const statusDescription = trackInfo.status || trackInfo.Status || trackInfo.statusSummary || 'Unknown';

  // Map USPS verbose status category to a short code (DL, IT, OD, etc.)
  const statusCode = mapUspsStatusCode(statusCategory);

  // Normalize events -- API may return an array or a single object
  const rawEvents = trackInfo.trackingEvents || trackInfo.TrackDetail || [];
  const events = Array.isArray(rawEvents)
    ? rawEvents
    : [rawEvents];

  // Normalize each event into the carrier-agnostic format used by TrackingPreview.
  // Field names differ between v3 (camelCase) and legacy (PascalCase).
  const scanEvents = events
    .filter((e) => e)
    .map((event) => ({
      date: event.eventTimestamp || event.EventDate || '',
      description: event.eventType || event.Event || event.event || '',
      city: event.eventCity || event.EventCity || '',
      state: event.eventState || event.EventState || '',
      country: event.eventCountry || event.EventCountry || 'US',
      zip: event.eventZIP || event.EventZIPCode || '',
      location: formatEventLocation(event),
    }));

  const expectedDelivery =
    trackInfo.expectedDeliveryDate ||
    trackInfo.ExpectedDeliveryDate ||
    trackInfo.expectedDeliveryTimestamp ||
    null;

  // If delivered, infer actual delivery time from the most recent scan event
  const actualDelivery =
    statusCode === 'DL' && scanEvents.length > 0
      ? scanEvents[0].date
      : null;

  // Return a normalized tracking object consumed by TrackingPreview
  return {
    trackingNumber,
    status: {
      code: statusCode,
      description: statusDescription,
      statusByLocale: statusDescription,
    },
    estimatedDelivery: expectedDelivery,
    actualDelivery,
    shipDate: null, // USPS API does not provide a ship date
    scanEvents,
    packageDetails: {
      weight: null, // Not available from USPS tracking
      packaging: trackInfo.mailClass || trackInfo.Class || null,
    },
    serviceType: stripHtml(trackInfo.mailClass || trackInfo.Class || ''),
    destinationCity: trackInfo.destinationCity || trackInfo.DestinationCity || null,
    destinationState: trackInfo.destinationState || trackInfo.DestinationState || null,
    destinationZip: trackInfo.destinationZIP || trackInfo.DestinationZip || null,
  };
}

// Map USPS status category strings to short codes used internally.
// Codes: DL=Delivered, IT=In Transit, OD=Out for Delivery,
//        PU=Picked Up, DE=Delivery Exception, PS=Pre-Shipment
function mapUspsStatusCode(statusCategory) {
  const category = (statusCategory || '').toLowerCase();
  if (category.includes('delivered')) return 'DL';
  if (category.includes('transit') || category.includes('in-transit')) return 'IT';
  if (category.includes('out for delivery')) return 'OD';
  if (category.includes('accepted') || category.includes('picked up')) return 'PU';
  if (category.includes('alert') || category.includes('exception')) return 'DE';
  if (category.includes('pre-shipment') || category.includes('pre shipment')) return 'PS';
  return 'IT'; // Default to in-transit for unrecognized categories
}

// Build a human-readable location string; omit country for domestic (US) shipments
function formatEventLocation(event) {
  const parts = [];
  const city = event.eventCity || event.EventCity || '';
  const state = event.eventState || event.EventState || '';
  const country = event.eventCountry || event.EventCountry || '';

  if (city) parts.push(city);
  if (state) parts.push(state);
  if (country && country !== 'US') parts.push(country);

  return parts.length > 0 ? parts.join(', ') : 'Location unavailable';
}

export default { trackPackage };
