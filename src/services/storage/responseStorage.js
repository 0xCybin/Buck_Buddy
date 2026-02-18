// src/services/storage/responseStorage.js
// Manages saved AI-generated responses in chrome.storage.local.
// Stores up to 100 responses (FIFO eviction) under the "buck_saved_responses" key.
// Supports CRUD, full-text search with optional date filtering, and JSON import with deduplication.

class ResponseStorage {
  constructor() {
    this.storageKey = "buck_saved_responses";
    this.maxResponses = 100; // oldest entries evicted when exceeded
  }

  // Save a new response. Prepends to the array (newest first) and trims overflow.
  async saveResponse(response) {
    try {
      const responses = await this.getSavedResponses();

      // Add new response with unique ID and timestamp
      const newResponse = {
        id: this._generateId(),
        ...response,
        savedAt: new Date().toISOString(),
      };

      responses.unshift(newResponse);

      // Maintain size limit
      if (responses.length > this.maxResponses) {
        responses.pop();
      }

      // Save to storage
      await chrome.storage.local.set({
        [this.storageKey]: responses,
      });

      return true;
    } catch (error) {
      console.error("Error saving response:", error);
      return false;
    }
  }

  // Import responses from an external JSON array. Assigns new IDs to avoid conflicts,
  // deduplicates by content, and merges with existing responses.
  async importResponses(responses) {
    try {
      // Validate input
      if (!Array.isArray(responses)) {
        throw new Error("Invalid import format: expected array");
      }

      // Get existing responses
      const existingResponses = await this.getSavedResponses();

      // Process new responses
      const processedResponses = responses.map((response) => ({
        ...response,
        id: this._generateId(), // Generate new IDs to avoid conflicts
        importedAt: new Date().toISOString(),
      }));

      // Merge responses, remove duplicates by content
      const mergedResponses = this._mergeDeduplicate([
        ...processedResponses,
        ...existingResponses,
      ]);

      // Enforce size limit
      const finalResponses = mergedResponses.slice(0, this.maxResponses);

      // Save to storage
      await chrome.storage.local.set({
        [this.storageKey]: finalResponses,
      });

      console.log("Imported responses:", finalResponses.length);
      return true;
    } catch (error) {
      console.error("Error importing responses:", error);
      throw error; // Propagate error for UI handling
    }
  }

  // Deduplicate by trimmed content string. Keeps the first occurrence (imported > existing).
  _mergeDeduplicate(responses) {
    const seen = new Set();
    return responses.filter((response) => {
      const content = response.content.trim();
      if (seen.has(content)) {
        return false;
      }
      seen.add(content);
      return true;
    });
  }

  // Retrieve all saved responses (returns empty array on error or first use)
  async getSavedResponses() {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      return result[this.storageKey] || [];
    } catch (error) {
      console.error("Error getting saved responses:", error);
      return [];
    }
  }

  // Full-text search across content and tags. All search terms must match content (AND),
  // but any term matching a tag is sufficient (OR). Optional date range filter.
  async searchResponses(query, options = {}) {
    const responses = await this.getSavedResponses();
    const searchTerms = query.toLowerCase().split(" ");

    return responses.filter((response) => {
      // Search in content
      const contentMatch = searchTerms.every((term) =>
        response.content.toLowerCase().includes(term)
      );

      // Search in tags if available
      const tagMatch = response.tags
        ? searchTerms.some((term) =>
            response.tags.some((tag) => tag.toLowerCase().includes(term))
          )
        : false;

      // Apply date filter if specified
      const dateMatch = options.dateRange
        ? this._isInDateRange(response.savedAt, options.dateRange)
        : true;

      return (contentMatch || tagMatch) && dateMatch;
    });
  }

  // Delete a single response by ID
  async deleteResponse(id) {
    try {
      const responses = await this.getSavedResponses();
      const updatedResponses = responses.filter((r) => r.id !== id);

      await chrome.storage.local.set({
        [this.storageKey]: updatedResponses,
      });

      return true;
    } catch (error) {
      console.error("Error deleting response:", error);
      return false;
    }
  }

  // Partial update: merge new fields into an existing response by ID
  async updateResponse(id, updates) {
    try {
      const responses = await this.getSavedResponses();
      const index = responses.findIndex((r) => r.id === id);

      if (index === -1) return false;

      responses[index] = {
        ...responses[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await chrome.storage.local.set({
        [this.storageKey]: responses,
      });

      return true;
    } catch (error) {
      console.error("Error updating response:", error);
      return false;
    }
  }

  // Check if an ISO date string falls within {start, end} timestamp range
  _isInDateRange(date, range) {
    const timestamp = new Date(date).getTime();
    return timestamp >= range.start && timestamp <= range.end;
  }

  // Generate a unique ID from timestamp + random suffix
  _generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default ResponseStorage;
