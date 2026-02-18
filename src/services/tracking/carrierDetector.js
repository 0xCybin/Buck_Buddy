/**
 * Carrier Detector
 *
 * Identifies which shipping carrier a tracking number belongs to based
 * on digit length and prefix patterns. FedEx patterns are checked first
 * because they are more specific; USPS includes a broad fallback that
 * catches any numeric-only tracking number up to 24 digits.
 *
 * Exported as a singleton instance.
 */

class CarrierDetector {
  constructor() {
    // Carrier definitions: regex patterns and public tracking URL builders.
    // Order matters -- FedEx is checked before USPS to avoid the USPS
    // fallback pattern swallowing FedEx numbers.
    this.carriers = {
      fedex: {
        name: "FedEx",
        patterns: [
          /^(\d{12}|\d{14,15})$/, // FedEx Express: 12 or 14-15 digits
          /^434011\d{6}$/,         // GameStop-specific FedEx prefix
        ],
        getUrl: (tracking) =>
          `https://www.fedex.com/fedextrack/?trackingnumber=${tracking}`,
      },
      usps: {
        name: "USPS",
        patterns: [
          /^(94|93|92|95)\d{18,20}$/, // Priority/First-Class: 20-22 digits, starts 92-95
          /^\d{1,24}$/,               // Catch-all: any numeric string up to 24 digits
        ],
        getUrl: (tracking) =>
          `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`,
      },
    };
  }

  // Identify the carrier for a given tracking number.
  // Returns the carrier config object with the cleaned tracking number attached,
  // or null if no pattern matches.
  detectCarrier(trackingNumber) {
    if (!trackingNumber) return null;

    const cleaned = trackingNumber.trim().replace(/\s+/g, "").toUpperCase();

    // FedEx first -- its patterns are strict digit-length checks.
    // Must come before USPS whose fallback matches any numeric string.
    if (this.carriers.fedex.patterns.some((pattern) => pattern.test(cleaned))) {
      return {
        ...this.carriers.fedex,
        trackingNumber: cleaned,
      };
    }

    // USPS second -- includes a broad catch-all for numeric strings
    for (const pattern of this.carriers.usps.patterns) {
      if (pattern.test(cleaned)) {
        return {
          ...this.carriers.usps,
          trackingNumber: cleaned,
        };
      }
    }

    return null;
  }

  // Convenience: returns true if any carrier pattern matches
  isValidTrackingNumber(trackingNumber) {
    return this.detectCarrier(trackingNumber) !== null;
  }

  // Build the public tracking page URL for the detected carrier
  getTrackingUrl(trackingNumber) {
    const carrier = this.detectCarrier(trackingNumber);
    if (!carrier) return null;

    const cleaned = trackingNumber.trim().replace(/\s+/g, "").toUpperCase();
    return carrier.getUrl(cleaned);
  }
}

// Export as singleton -- no need for multiple instances
export default new CarrierDetector();
