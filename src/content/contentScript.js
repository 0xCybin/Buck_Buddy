/**
 * ContentScriptManager - Chrome MV3 content script for BuckBuddy.
 *
 * Runs on Freshdesk, Outlook, Sterling OMS, and Power BI pages.
 * Extracts GameStop-specific data (orders, SKUs, tracking numbers, customer
 * info, etc.) from the active page DOM and stores it in chrome.storage.local
 * so the popup can read it. Also tracks send/resolve actions for stats and
 * achievement triggers.
 *
 * NOTE: There are two chrome.runtime.onMessage listeners (constructor +
 * initializeEventListeners). Both are intentional -- the first forwards
 * achievement updates to the page via CustomEvent, the second handles
 * extraction and status requests from the popup/background.
 */

import { achievementTriggers } from '../utils/achievementTriggers';
import { achievementSystem } from '../utils/achievementSystem';

console.log('GameStop CS Helper: Content script loaded');

class ContentScriptManager {
  constructor() {
    this.debugMode = false;
    this.initialized = false;

    // Listener #1: Forward achievement updates from background to page-level CustomEvent
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'achievementUpdate') {
        console.log('Received achievement update:', message.achievements);
        document.dispatchEvent(
          new CustomEvent('achievementUpdate', {
            detail: message.achievements,
          })
        );
      }
    });

    // Whitelist of domains where data extraction is allowed
    this.validDomains = [
      'freshdesk.com',
      'outlook.office.com',
      'outlook.office365.com',
      'outlook.live.com',
      'app.powerbi.com',
      'oms-web.prod-pci-gsaws.com',
      'localhost',
      '127.0.0.1',
    ];

    this.currentSite = this.detectSite();

    // Regex patterns for GameStop-specific identifiers found in ticket/email text
    this.patterns = {
      orderNumber: {
        gamestop: /\b11000000\d{8}\b/g,
        web: /\bW\d{8}\b/g,
        digital: /\bD\d{8}\b/g,
        store: /\bS\d{8}\b/g,
        short: /\b20\d{7}\b/g,
      },
      giftCard: /\b636\d{16}\b/g,
      ticket: /\b\d{6}-\d{6}\b/g,
      sku: [/\b\d{6}\b/g, /\bPSA\d{8,9}\b/g, /\bPSA[:\s]+\d{6,9}\b/gi],
      storeNumber: [/\bST\d{4}\b/gi, /\bstore\s*#?\s*(\d{4})\b/gi],
      tracking: {
        fedex: [/\b(?!38\d{11})\d{12}\b/g, /\b(?!38\d{11})\d{14}\b/g],
        usps: [
          /\b92\d{18,22}\b/g,
          /\b93\d{18,22}\b/g,
          /\b94\d{18,22}\b/g,
          /\b95\d{18,22}\b/g,
          /\b[A-Z]{2}\d{9}US\b/g,
          /\b[A-Z]{2}\d{9}[A-Z]{2}\b/g,
        ],
      },
      pur: /\b38\d{11}\b/g,
    };

    // Freshdesk-specific DOM selectors for ticket fields, content areas, and action buttons
    this.selectors = {
      orderField: {
        // Freshdesk custom fields - adjust data-field-name if your field name differs
        primary: '.ticket-custom-field input[data-field-name="cf_order_number"]',
        alternate: '.custom_field input[type="text"]',
        // Fallback: any input with order-related labels
        fallback: 'input[placeholder*="order" i], input[placeholder*="Order" i]',
      },
      trackingField: {
        primary: '.ticket-custom-field input[data-field-name="cf_tracking_number"]',
        fallback: 'input[placeholder*="tracking" i]',
      },
      ticket: {
        // Freshdesk ticket page selectors
        container: '.ticket-details, .ticket-content-wrapper, #ticket-details-container',
        content: '.ticket-content, .conversation-text',
        subject: '.ticket-subject-heading, .subject-field input, h2.heading',
        comments: '.conversation-pane .conversation, .reply-box, .note-box',
        metadata: '.ticket-properties, .ticket-meta',
        customFields: '.ticket-custom-fields .custom-field, .custom_field',
        description: '.ticket-description .content, .fr-view, .ticket-content .content',
        internalNotes: '.note-content, .private-note .content, .conversation.private .content',
        status: '.status-label, .ticket-status .ember-power-select-selected-item',
        timestamp: '.timestamp time, .created-at time, [data-tooltip]',
      },
      // Freshdesk reply/resolve buttons
      actions: {
        sendReply: '#reply-btn, .reply-button, button[data-action="reply"]',
        resolveButton: '.resolve-btn, button[data-action="resolve"], #resolve-ticket-btn',
        submitButton: '#send-reply-btn, .send-reply, button[type="submit"]',
        statusDropdown: '.status-dropdown, .ticket-status select',
      },
    };

    // Outlook DOM selectors with fallbacks for new/old Outlook and compose mode
    this.outlookSelectors = {
      emailBody: [
        // Reading pane body (new Outlook)
        'div[data-testid="ReadingPaneContent"]',
        'div[class*="ReadingPaneContent"]',
        'div[id*="UniqueMessageBody"]',
        'div[role="article"]',
        'div.customScrollBar div[role="document"]',
        // Compose mode
        'div[role="textbox"][aria-label*="Message body"]',
        'div[aria-label="Message body"]',
      ],
      senderName: [
        'span[data-testid="SenderPersona"]',
        'span.lpc-hoverTarget span',
        'div[aria-label*="From"] span.allowTextSelection',
        'button[aria-label*="email actions"] span',
      ],
      senderEmail: [
        'span[title*="@"]',
        'a[href^="mailto:"]',
        'span.lpc-hoverTarget[title*="@"]',
        'button[aria-label*="@"]',
      ],
      subject: [
        'div[role="heading"][aria-level="2"]',
        'span[id*="Subject"]',
        'input[aria-label="Add a subject"]',
        'div[data-testid="SubjectLine"]',
        'span.allowTextSelection[title]',
      ],
    };

    this.init();
  }

  // Waits for DOM ready, then calls setup()
  init() {
    this.logDebug('Initializing content script...');

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  // Registers shared event listeners, then wires up site-specific observers and trackers
  setup() {
    this.initializeEventListeners();

    if (this.currentSite === 'freshdesk') {
      this.setupSolveTracking();
      this.setupTicketCounterObserver();
      this.setupFreshdeskSendTracking();
      this.setupFreshdeskStatusDropdownTracking();
    } else if (this.currentSite === 'outlook') {
      this._outlookUserEmail = this._detectOutlookUserEmail();
      this.setupOutlookEmailObserver();
      this.setupOutlookSendTracking();
    } else if (this.currentSite === 'sterling') {
      this.setupSterlingObserver();
    } else if (this.currentSite === 'powerbi') {
      this.setupPowerBIObserver();
    }
  }

  logDebug(...args) {
    if (this.debugMode) {
      console.log('GameStop CS Helper:', ...args);
    }
  }

  // Returns a site key based on hostname, or null if unrecognized
  detectSite() {
    const hostname = window.location.hostname;
    if (hostname.includes('freshdesk.com')) return 'freshdesk';
    if (
      hostname.includes('outlook.office.com') ||
      hostname.includes('outlook.office365.com') ||
      hostname.includes('outlook.live.com')
    ) return 'outlook';
    if (hostname.includes('app.powerbi.com')) return 'powerbi';
    if (hostname.includes('oms-web.prod-pci-gsaws.com')) return 'sterling';
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) return 'freshdesk';
    return null;
  }

  isValidDomain() {
    const currentDomain = window.location.hostname;
    return this.validDomains.some((domain) => currentDomain.includes(domain));
  }

  // Extracts Freshdesk ticket ID from URL, data attributes, or header text (3 fallbacks)
  extractTicketId() {
    let ticketId = null;

    // Freshdesk URL pattern: /a/tickets/12345 or /helpdesk/tickets/12345
    const urlMatch = window.location.pathname.match(/(?:\/a)?\/tickets\/(\d+)/);
    if (urlMatch) {
      ticketId = urlMatch[1];
    }

    // Fallback: check for ticket ID in data attributes
    if (!ticketId) {
      const ticketElement = document.querySelector('[data-ticket-id]');
      ticketId = ticketElement?.getAttribute('data-ticket-id');
    }

    // Fallback: check Freshdesk's ticket number display
    if (!ticketId) {
      const ticketHeader = document.querySelector('.ticket-id, .ticket-number');
      if (ticketHeader) {
        const match = ticketHeader.textContent.match(/#?(\d+)/);
        if (match) ticketId = match[1];
      }
    }

    return ticketId;
  }

  // Main Freshdesk extraction: pulls description, notes, and all GameStop identifiers from page text
  async extractTicketData() {
    try {
      const ticketContent = document.body.innerText;
      console.log('Extracting data from ticket content');

      // Get ticket description from Freshdesk
      let description = '';
      const descSelectors = this.selectors.ticket.description.split(', ');
      for (const sel of descSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          description = el.textContent || el.value || '';
          if (description) break;
        }
      }

      // Get internal/private notes
      const noteSelectors = this.selectors.ticket.internalNotes.split(', ');
      const internalNotes = [];
      for (const sel of noteSelectors) {
        const elements = document.querySelectorAll(sel);
        elements.forEach((note) => {
          const text = note.textContent?.trim();
          if (text) internalNotes.push(text);
        });
      }

      const allNumbers = ticketContent.match(/\b\d+\b/g) || [];
      console.log('All number sequences found:', allNumbers);

      const customerInfo = this._extractCustomerInfo();
      console.log('Extracted customer info:', customerInfo);

      // Combine all text sources so regex finds identifiers in every section
      const notesText = internalNotes.join('\n');
      const allText = `${ticketContent}\n${description}\n${notesText}`;
      const allEmails = this._extractAllEmails(allText);
      const allPhones = this._extractAllPhones(allText);

      // Merge DOM-extracted customer info with regex-found results; DOM values go first
      if (customerInfo.email && !allEmails.includes(customerInfo.email)) {
        allEmails.unshift(customerInfo.email);
      }
      if (customerInfo.phone && !allPhones.includes(customerInfo.phone) &&
          !this._isBogusPhone(customerInfo.phone)) {
        allPhones.unshift(customerInfo.phone);
      }

      const rawSkus = this.extractPattern(ticketContent, this.patterns.sku);

      const extractedData = {
        ticketDescription: description || 'No description available',
        internalNotes: internalNotes.length > 0 ? internalNotes : ['No internal notes available'],
        orderNumbers: this._extractOrderNumbers(ticketContent),
        giftCards: this.extractPattern(ticketContent, this.patterns.giftCard),
        tickets: this.extractPattern(ticketContent, this.patterns.ticket),
        skus: this._normalizeSkus(rawSkus),
        storeNumbers: this._extractStoreNumbers(ticketContent),
        purNumbers: this._extractPurNumbers(allNumbers, ticketContent),
        trackingNumbers: await this._extractTrackingNumbers(ticketContent),
        status: this._extractStatus(),
        timestamp: this._extractTimestamp(),
        customerName: customerInfo.name || '',
        emails: allEmails,
        phones: allPhones,
      };

      console.log('Full extracted data:', extractedData);
      return this.cleanExtractedData(extractedData);
    } catch (error) {
      console.error('GameStop CS Helper: Data extraction error:', error);
      throw new Error('Failed to extract ticket data: ' + error.message);
    }
  }

  // Reads the ticket status label from Freshdesk DOM
  _extractStatus() {
    const statusSelectors = this.selectors.ticket.status.split(', ');
    for (const sel of statusSelectors) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim();
    }
    return '';
  }

  // Reads the ticket creation timestamp from Freshdesk DOM
  _extractTimestamp() {
    const tsSelectors = this.selectors.ticket.timestamp.split(', ');
    for (const sel of tsSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        return el.getAttribute('datetime') || el.getAttribute('data-tooltip') || el.textContent?.trim() || '';
      }
    }
    return '';
  }

  // Sets up keyboard shortcuts, SPA URL observer, click handlers, and message listener #2
  initializeEventListeners() {
    // Ctrl+Shift+B toggles the popup
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        chrome.runtime.sendMessage({ type: 'TOGGLE_POPUP' });
      }
    });

    // SPA navigation detector: MutationObserver watches for URL changes caused by
    // client-side routing. The 1500ms delay lets Freshdesk finish rendering the new
    // ticket, but can race if the user switches tickets rapidly.
    let lastUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        this.logDebug('URL changed, re-checking ticket data');
        setTimeout(() => {
          if (this.extractTicketId()) {
            this.storeCurrentData();
          }
        }, 1500);
      }
    });

    urlObserver.observe(document.body, { childList: true, subtree: true });

    // Re-extract when conversation/note tabs are clicked (content may change without URL change)
    document.addEventListener('click', (e) => {
      const target = e.target;
      // Check if user clicked on a conversation or note tab
      if (
        target.closest('.conversation-tab') ||
        target.closest('.note-tab') ||
        target.closest('[data-tab]')
      ) {
        setTimeout(() => this.storeCurrentData(), 500);
      }
    }, { passive: true, capture: true });

    // Listener #2: Handles popup/background requests (extraction, status check, solve count)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.logDebug('Received message:', request);

      if (!this.isValidDomain()) {
        sendResponse({
          success: false,
          error: 'Not a supported site',
        });
        return true;
      }

      switch (request.type) {
        case 'INITIALIZE_EXTRACTION':
          this.handleDataExtraction(sendResponse, request.frameText);
          break;

        case 'CHECK_STATUS':
          sendResponse({
            success: true,
            initialized: this.initialized,
            domain: window.location.hostname,
          });
          break;

        case 'GET_SOLVE_COUNT':
          this.handleGetSolveCount(sendResponse);
          break;

        default:
          sendResponse({
            success: false,
            error: 'Unknown message type',
          });
      }

      return true;
    });

    this.initialized = true;
    this.logDebug('Content script initialized');

    this.setupTicketObserver();
  }

  // Routes extraction to the correct site-specific method, stores results, and responds
  async handleDataExtraction(sendResponse, frameText) {
    try {
      let data;
      let itemId;

      if (this.currentSite === 'outlook') {
        data = await this.extractOutlookData(frameText);
        itemId = this._extractOutlookItemId();
      } else if (this.currentSite === 'sterling') {
        data = await this.extractSterlingData();
        itemId = this._extractSterlingItemId();
      } else if (this.currentSite === 'powerbi') {
        data = await this.extractPowerBIData(frameText);
        itemId = this._extractPowerBIItemId();
      } else {
        data = await this.extractTicketData();
        itemId = this.extractTicketId();
      }

      await this.storeCurrentData(data, itemId);

      sendResponse({
        success: true,
        data,
        ticketId: itemId,
        site: this.currentSite,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('GameStop CS Helper: Extraction error:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to extract data',
        retryable: true,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Returns the daily ticket-resolve count from chrome.storage
  handleGetSolveCount(sendResponse) {
    try {
      chrome.storage.local.get('daily_solve_count', (result) => {
        const count = result.daily_solve_count?.count || 0;
        sendResponse({
          success: true,
          count,
          timestamp: new Date().toISOString(),
        });
      });
    } catch (error) {
      console.error('Error getting solve count:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to get solve count',
      });
    }
    return true; // Keep channel open for async response
  }

  // Watches Freshdesk conversation pane for new replies/notes and re-extracts on change
  setupTicketObserver() {
    const conversationPane = document.querySelector(
      '.conversation-pane, .ticket-conversation, #ticket-conversation'
    );
    if (conversationPane) {
      const observer = new MutationObserver(() => {
        this.logDebug('Conversation pane changed');
        setTimeout(() => this.storeCurrentData(), 500);
      });
      observer.observe(conversationPane, {
        childList: true,
        subtree: true,
      });
    }
  }

  // Attaches click handlers to resolve/close buttons for solve-count tracking.
  // Uses MutationObserver because Freshdesk is an SPA and buttons appear dynamically.
  setupSolveTracking() {
    const attachResolveHandler = (button) => {
      if (button._buckBuddyTracked) return;
      button._buckBuddyTracked = true;

      button.addEventListener('click', async () => {
        this.logDebug('Resolve/close button clicked');
        try {
          // Check if the action will resolve the ticket
          const isResolving = this._isResolvingAction(button);
          if (isResolving) {
            await this._handleTicketResolved();
          }
        } catch (error) {
          console.error('Error tracking ticket resolution:', error);
        }
      });
    };

    // Freshdesk button selectors
    const resolveSelectors = this.selectors.actions.resolveButton.split(', ');
    const submitSelectors = this.selectors.actions.submitButton.split(', ');
    const allSelectors = [...resolveSelectors, ...submitSelectors];

    // Try to find existing buttons
    allSelectors.forEach((sel) => {
      const btn = document.querySelector(sel);
      if (btn) attachResolveHandler(btn);
    });

    // Watch for dynamically added buttons (Freshdesk is an SPA)
    const buttonObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;

          allSelectors.forEach((sel) => {
            if (node.matches?.(sel)) {
              attachResolveHandler(node);
            }
            const found = node.querySelector?.(sel);
            if (found) attachResolveHandler(found);
          });
        });
      });
    });

    buttonObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    this.solveButtonObserver = buttonObserver;
  }

  // Checks button text/data-action to determine if it resolves or closes the ticket
  _isResolvingAction(button) {
    const text = button.textContent?.toLowerCase() || '';
    const action = button.getAttribute('data-action') || '';
    return (
      text.includes('resolve') ||
      text.includes('close') ||
      action === 'resolve' ||
      action === 'close'
    );
  }

  // Increments daily solve count, awards coins (10 base + 15 bonus for first of day),
  // logs the coin transaction, and fires the achievement trigger
  async _handleTicketResolved() {
    try {
      const result = await chrome.storage.local.get('daily_solve_count');
      const current = result.daily_solve_count || { count: 0, date: new Date().toDateString() };

      if (current.date !== new Date().toDateString()) {
        current.count = 0;
        current.date = new Date().toDateString();
      }

      current.count++;

      await chrome.storage.local.set({ daily_solve_count: current });

      // Award coins for ticket completion
      const coinResult = await chrome.storage.local.get('gme_coin_balance');
      const currentCoins = coinResult.gme_coin_balance || 0;

      // +10 coins per ticket, +15 bonus for first ticket of the day
      let coinsEarned = 10;
      if (current.count === 1) coinsEarned += 15;

      await chrome.storage.local.set({
        gme_coin_balance: currentCoins + coinsEarned,
      });

      // Log transaction
      const txResult = await chrome.storage.local.get('coin_transactions');
      const transactions = txResult.coin_transactions || [];
      transactions.push({
        type: 'earn',
        source: 'ticket',
        amount: coinsEarned,
        timestamp: Date.now(),
      });
      await chrome.storage.local.set({
        coin_transactions: transactions.slice(-200),
      });

      // Trigger achievement
      await achievementTriggers.onTicketSolved();

      this.logDebug(`Ticket resolved! +${coinsEarned} coins`);
    } catch (error) {
      console.error('Error handling ticket resolution:', error);
    }
  }

  // Observes the Freshdesk sidebar ticket counter badge for changes (informational logging)
  setupTicketCounterObserver() {
    const countElement = document.querySelector(
      '.ticket-count, .unresolved-count, .badge-count'
    );
    if (countElement) {
      const observer = new MutationObserver(() => {
        this.logDebug('Ticket counter changed');
      });
      observer.observe(countElement, { childList: true, characterData: true, subtree: true });
    }
  }

  // ═══ Send Button Tracking ═══

  // Tracks Freshdesk send-reply clicks (including "Send and set as" dropdown items).
  // Classifies each send by status: send, send_resolved, send_closed, send_pending.
  // Uses 2s debounce to avoid double-counting from rapid clicks.
  setupFreshdeskSendTracking() {
    let lastSendTime = 0;

    const attachSendHandler = (button) => {
      if (button._buckBuddySendTracked) return;
      button._buckBuddySendTracked = true;

      button.addEventListener('click', () => {
        const now = Date.now();
        if (now - lastSendTime < 2000) return; // 2s debounce
        lastSendTime = now;

        // Check button text + data-test-link attribute for "Send and set as" items
        const text = (button.textContent || '').toLowerCase().trim();
        const testLink = (button.getAttribute('data-test-link') || '').toLowerCase();
        let sendType = 'send';
        if (text.includes('resolve') || testLink.includes('resolved')) sendType = 'send_resolved';
        else if (text.includes('close') || testLink.includes('closed')) sendType = 'send_closed';
        else if (text.includes('pending') || testLink.includes('pending')) sendType = 'send_pending';
        else if (text.includes('waiting') || testLink.includes('waiting')) sendType = 'send';

        this.logDebug(`Freshdesk send tracked: ${sendType}`);
        chrome.runtime.sendMessage({
          type: 'TRACK_SEND', source: 'freshdesk', sendType,
        }).catch(() => {});
      });
    };

    // Selectors for Freshdesk send buttons (primary + dropdown items)
    const sendSelectors = [
      '#send-reply-btn', '.send-reply', 'button[data-action="reply"]',
      'a[data-action="send_and_set_as"]', '.reply-action-btn',
      '.dropdown-menu a[data-action]',
      // "Send and set as" dropdown items
      'a.send-and-set-item',
      '[data-test-id="send-and-set"] a',
      '[data-test-id="send-and-set-list-box"] a.send-and-set-item',
    ];

    const findAndAttach = (root) => {
      // Selector-based
      for (const sel of sendSelectors) {
        try {
          const els = root.querySelectorAll(sel);
          els.forEach((el) => attachSendHandler(el));
        } catch (e) { /* skip */ }
      }
      // Text-content fallback: buttons/links starting with "Send"
      const candidates = root.querySelectorAll('button, a.btn, a[role="button"]');
      candidates.forEach((el) => {
        const text = (el.textContent || '').trim();
        if (/^Send\b/i.test(text)) attachSendHandler(el);
      });
    };

    findAndAttach(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          findAndAttach(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    this.freshdeskSendObserver = observer;
  }

  // Tracks status changes via Freshdesk dropdowns (both native <select> and Ember/React variants)
  setupFreshdeskStatusDropdownTracking() {
    let lastSendTime = 0;

    const trackStatusChange = (statusText) => {
      const now = Date.now();
      if (now - lastSendTime < 2000) return; // 2s debounce
      lastSendTime = now;

      const text = (statusText || '').toLowerCase().trim();
      let sendType = 'send';
      if (text.includes('resolve')) sendType = 'send_resolved';
      else if (text.includes('close')) sendType = 'send_closed';
      else if (text.includes('pending')) sendType = 'send_pending';

      this.logDebug(`Freshdesk status dropdown tracked: ${sendType}`);
      chrome.runtime.sendMessage({
        type: 'TRACK_SEND', source: 'freshdesk', sendType,
      }).catch(() => {});
    };

    const attachDropdownHandler = (el) => {
      if (el._buckBuddyStatusTracked) return;
      el._buckBuddyStatusTracked = true;

      // Handle <select> elements
      if (el.tagName === 'SELECT') {
        el.addEventListener('change', () => {
          const selected = el.options[el.selectedIndex];
          trackStatusChange(selected?.textContent || selected?.value || '');
        });
      } else {
        // Handle click-based dropdown items (Freshdesk Ember/React dropdowns)
        el.addEventListener('click', () => {
          trackStatusChange(el.textContent || '');
        });
      }
    };

    // Selectors for Freshdesk status dropdown and its items
    const statusSelectors = [
      '.status-dropdown select',
      '.ticket-status select',
      '.status-dropdown .dropdown-item',
      '.ticket-status .ember-power-select-option',
      '.status-dropdown li a',
      'li[data-status-id]',
      '.dropdown-menu a[data-status]',
      '.ticket-actions .dropdown-item',
    ];

    const findAndAttach = (root) => {
      for (const sel of statusSelectors) {
        try {
          const els = root.querySelectorAll(sel);
          els.forEach((el) => attachDropdownHandler(el));
        } catch (e) { /* skip */ }
      }
    };

    findAndAttach(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          findAndAttach(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    this.freshdeskStatusObserver = observer;
  }

  // Tracks Outlook send-button clicks with 2s debounce
  setupOutlookSendTracking() {
    let lastSendTime = 0;

    const attachSendHandler = (button) => {
      if (button._buckBuddySendTracked) return;
      button._buckBuddySendTracked = true;

      button.addEventListener('click', () => {
        const now = Date.now();
        if (now - lastSendTime < 2000) return;
        lastSendTime = now;

        this.logDebug('Outlook send tracked');
        chrome.runtime.sendMessage({
          type: 'TRACK_SEND', source: 'outlook', sendType: 'send',
        }).catch(() => {});
      });
    };

    const outlookSendSelectors = [
      'button[aria-label="Send"]',
      'button[title="Send"]',
      'button[data-testid="send"]',
    ];

    const findAndAttach = (root) => {
      for (const sel of outlookSendSelectors) {
        try {
          const els = root.querySelectorAll(sel);
          els.forEach((el) => attachSendHandler(el));
        } catch (e) { /* skip */ }
      }
    };

    findAndAttach(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          findAndAttach(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    this.outlookSendObserver = observer;
  }

  // Extracts customer name, email, and phone from Freshdesk DOM.
  // Strategy: container-based lookup first (scoped to contact/requester panels),
  // then falls back to full-page regex search for anything still missing.
  _extractCustomerInfo() {
    console.log('Starting customer info extraction...');

    const customerInfo = {
      name: '',
      email: '',
      phone: '',
    };

    try {
      // Freshdesk customer info selectors
      const selectors = {
        container: [
          '.contact-info',
          '.requester-info',
          '.ticket-requester',
          '.contact-details',
          '.customer-info',
          '[data-test-id="contact-info"]',
        ],
        name: [
          '.contact-name a',
          '.contact-name',
          '.requester-name',
          '.contact-info .name',
          '.ticket-requester .name',
          'a[data-contact-id]',
        ],
        email: [
          '.contact-email a',
          '.contact-email',
          '.requester-email',
          '.contact-info .email',
          'a[href^="mailto:"]',
        ],
        phone: [
          '.contact-phone',
          '.requester-phone',
          '.contact-info .phone',
          'a[href^="tel:"]',
        ],
      };

      // Try container-based extraction
      for (const containerSel of selectors.container) {
        const container = document.querySelector(containerSel);
        if (!container) continue;

        console.log('Found customer container:', containerSel);

        // Extract name
        if (!customerInfo.name) {
          for (const sel of selectors.name) {
            const el = container.querySelector(sel);
            if (el) {
              customerInfo.name = el.textContent?.trim() || el.getAttribute('title') || '';
              if (customerInfo.name) break;
            }
          }
        }

        // Extract email (skip agent/support addresses)
        if (!customerInfo.email) {
          for (const sel of selectors.email) {
            const el = container.querySelector(sel);
            if (el) {
              const href = el.getAttribute('href') || '';
              const candidate = href.startsWith('mailto:')
                ? href.replace('mailto:', '')
                : el.textContent?.trim() || el.getAttribute('title') || '';
              if (candidate && !this._isAgentOrSupportEmail(candidate)) {
                customerInfo.email = candidate;
                break;
              }
            }
          }
        }

        // Extract phone
        if (!customerInfo.phone) {
          for (const sel of selectors.phone) {
            const el = container.querySelector(sel);
            if (el) {
              const href = el.getAttribute('href') || '';
              customerInfo.phone = href.startsWith('tel:')
                ? href.replace('tel:', '').replace(/\D/g, '')
                : (el.textContent?.trim() || '').replace(/\D/g, '');
              if (customerInfo.phone) break;
            }
          }
        }

        if (customerInfo.name || customerInfo.email) break;
      }

      // Global fallback: search entire page
      if (!customerInfo.name || !customerInfo.email || !customerInfo.phone) {
        console.log('Using fallback content search for missing customer info');
        const ticketContent = document.body.textContent;

        if (!customerInfo.name) {
          const nameMatch = ticketContent.match(
            /(?:name|customer|requester):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i
          );
          if (nameMatch) {
            customerInfo.name = nameMatch[1].trim();
          }
        }

        if (!customerInfo.email) {
          const emailMatches = ticketContent.match(/\b[\w.-]+@[\w.-]+\.\w{2,}\b/g) || [];
          const guestEmail = emailMatches.find((e) => !this._isAgentOrSupportEmail(e));
          if (guestEmail) {
            customerInfo.email = guestEmail;
          }
        }

        if (!customerInfo.phone) {
          const phoneMatch = ticketContent.match(
            /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/
          );
          if (phoneMatch) {
            customerInfo.phone = phoneMatch[0].replace(/\D/g, '');
          }
        }
      }

      console.log('Final extracted customer info:', customerInfo);
      return customerInfo;
    } catch (error) {
      console.error('Error extracting customer info:', error);
      return customerInfo;
    }
  }

  // Filters out internal, system, and agent emails so only customer addresses remain
  _isAgentOrSupportEmail(email) {
    const lower = email.toLowerCase();
    // Filter out Freshdesk system/support addresses
    if (lower.endsWith('.freshdesk.com')) return true;
    // Filter out internal GameStop addresses
    if (lower.endsWith('@gamestop.com')) return true;
    // Common support/agent prefixes
    const agentPrefixes = ['support@', 'noreply@', 'no-reply@', 'mailer@', 'notifications@', 'system@', 'helpdesk@', 'admin@'];
    if (agentPrefixes.some((prefix) => lower.startsWith(prefix))) return true;
    // Filter out the logged-in user's own email (not a customer)
    if (this._outlookUserEmail && lower === this._outlookUserEmail) return true;
    return false;
  }

  // Detects the logged-in user's email from the Outlook account button or profile image URL.
  // Used by _isAgentOrSupportEmail to filter out the agent's own address.
  _detectOutlookUserEmail() {
    const selectors = [
      'button[data-testid="mectrl_main_trigger"]',
      '#O365_MainLink_Me',
      '#meControl button',
      'button[aria-label*="Account manager"]',
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
          const match = label.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
          if (match) return match[0].toLowerCase();
        }
      } catch (e) { /* skip */ }
    }
    // Fallback: check image URLs that contain the user's email
    const imgSrc = document.querySelector('img[src*="/imageB2/"]')?.getAttribute('src') || '';
    const imgMatch = imgSrc.match(/users\/([^/]+)\//);
    if (imgMatch) {
      const decoded = decodeURIComponent(imgMatch[1]);
      if (decoded.includes('@')) return decoded.toLowerCase();
    }
    return null;
  }

  // Extracts all unique customer email addresses from text (deduped, agent addresses excluded)
  _extractAllEmails(text) {
    const emailRegex = /\b[\w.-]+@[\w.-]+\.\w{2,}\b/g;
    const matches = text.match(emailRegex) || [];
    // Deduplicate, case-insensitive, and filter out agent/support emails
    const seen = new Set();
    return matches.filter((email) => {
      const lower = email.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return !this._isAgentOrSupportEmail(email);
    });
  }

  // Known placeholder/invalid phone numbers that should be ignored
  _isBogusPhone(phone) {
    const bogusNumbers = new Set(['2147483647', '0000000000', '1111111111', '1234567890']);
    return bogusNumbers.has(phone);
  }

  // Extracts all unique 10-digit US phone numbers from text, normalized and deduped
  _extractAllPhones(text) {
    const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    const matches = text.match(phoneRegex) || [];
    // Normalize and deduplicate
    const seen = new Set();
    return matches
      .map((p) => p.replace(/\D/g, ''))
      .filter((phone) => {
        if (seen.has(phone)) return false;
        if (this._isBogusPhone(phone)) return false;
        seen.add(phone);
        return true;
      });
  }

  // Finds GameStop order numbers: custom field inputs (Freshdesk), regex patterns (W/D/S prefixed
  // and 16-digit 11000000* format). Results are deduped via Set.
  _extractOrderNumbers(text) {
    const allOrders = new Set();

    // Check Freshdesk custom field inputs (only on Freshdesk)
    if (this.currentSite === 'freshdesk') {
      const orderSelectors = [
        this.selectors.orderField.primary,
        this.selectors.orderField.alternate,
        this.selectors.orderField.fallback,
      ];

      orderSelectors.forEach((selector) => {
        try {
          const inputs = document.querySelectorAll(selector);
          inputs.forEach((input) => {
            const val = (input.value || input.textContent || '').trim();
            if (val) allOrders.add(val);
          });
        } catch (e) {
          // Selector might be invalid, skip
        }
      });
    }

    // Regex extraction from page text
    Object.values(this.patterns.orderNumber).forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) matches.forEach((match) => allOrders.add(match));
    });

    // GameStop 16-digit order numbers
    const potentialGameStopOrders = text.match(/\b11000000\d+\b/g) || [];
    potentialGameStopOrders.forEach((order) => {
      if (order.length === 16) allOrders.add(order);
    });

    return [...allOrders];
  }

  // Generic regex extractor: handles single pattern or array of patterns, returns deduped matches
  extractPattern(text, pattern) {
    if (Array.isArray(pattern)) {
      const all = new Set();
      pattern.forEach((p) => {
        const matches = text.match(p);
        if (matches) matches.forEach((m) => all.add(m));
      });
      return [...all];
    }
    return [...new Set(text.match(pattern) || [])];
  }

  // Finds 4-digit GameStop store numbers: "ST0480" or "store #0480" patterns
  _extractStoreNumbers(text) {
    const storeNumbers = new Set();

    // Pattern 1: ST followed by exactly 4 digits (e.g., ST0480, st0480)
    const stPattern = /\bST(\d{4})\b/gi;
    let match;
    while ((match = stPattern.exec(text)) !== null) {
      storeNumbers.add(match[1]);
    }

    // Pattern 2: Word "store" followed by 4 digits (e.g., "store 0480", "store #0480")
    const storeWordPattern = /\bstore\s*#?\s*(\d{4})\b/gi;
    while ((match = storeWordPattern.exec(text)) !== null) {
      storeNumbers.add(match[1]);
    }

    return [...storeNumbers];
  }

  // Normalizes SKU formats like "PSA: 12345678" to "PSA12345678"
  _normalizeSkus(skus) {
    return skus.map((sku) => {
      // Normalize "PSA: 12345678" or "PSA 12345678" → "PSA12345678"
      return sku.replace(/^PSA[:\s]+/i, 'PSA');
    });
  }

  // Extracts PowerUp Rewards (PUR) membership numbers: 13-digit numbers starting with 38
  _extractPurNumbers(allNumbers, text) {
    const purNumbers = new Set();
    const matches = text.match(this.patterns.pur);
    if (matches) matches.forEach((m) => purNumbers.add(m));
    return [...purNumbers];
  }

  // Extracts FedEx and USPS tracking numbers from text and Freshdesk custom fields.
  // FedEx numbers that match PUR pattern (38*) are excluded to avoid false positives.
  async _extractTrackingNumbers(text) {
    const trackingNumbers = new Set();

    // Check Freshdesk tracking custom field (only on Freshdesk)
    if (this.currentSite === 'freshdesk') {
      const trackingSelectors = [
        this.selectors.trackingField.primary,
        this.selectors.trackingField.fallback,
      ];

      trackingSelectors.forEach((selector) => {
        try {
          const inputs = document.querySelectorAll(selector);
          inputs.forEach((input) => {
            const val = (input.value || input.textContent || '').trim();
            if (val && val.length >= 12) trackingNumbers.add(val);
          });
        } catch (e) {
          // Skip invalid selectors
        }
      });
    }

    // FedEx patterns
    this.patterns.tracking.fedex.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach((m) => {
          // Use a fresh regex to avoid /g lastIndex statefulness bug
          if (!/^38\d{11}$/.test(m)) {
            trackingNumbers.add(m);
          }
        });
      }
    });

    // USPS patterns
    this.patterns.tracking.usps.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) matches.forEach((m) => trackingNumbers.add(m));
    });

    return [...trackingNumbers];
  }

  // Persists extracted data to chrome.storage.local so the popup can read it.
  // If called without args, performs a fresh extraction for the current site.
  async storeCurrentData(data, itemId) {
    try {
      if (!data || !itemId) {
        // Called without args — extract fresh
        if (this.currentSite === 'outlook') {
          data = await this.extractOutlookData();
          itemId = this._extractOutlookItemId();
        } else if (this.currentSite === 'sterling') {
          data = await this.extractSterlingData();
          itemId = this._extractSterlingItemId();
        } else if (this.currentSite === 'powerbi') {
          data = await this.extractPowerBIData();
          itemId = this._extractPowerBIItemId();
        } else {
          data = await this.extractTicketData();
          itemId = this.extractTicketId();
        }
      }

      if (itemId) {
        await chrome.storage.local.set({
          lastTicketData: data,
          lastTicketId: itemId,
          lastDataSite: this.currentSite,
          lastUpdateTimestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error storing data:', error);
    }
  }

  // ═══ Outlook-specific methods ═══

  // Tries each selector in the list and returns the first matching element (or null)
  _queryOutlookSelector(selectorList) {
    for (const sel of selectorList) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch (e) {
        // invalid selector, skip
      }
    }
    return null;
  }

  // Main Outlook extraction with 4 progressive fallback phases for body text:
  //   Phase 1: DOM selectors (reading pane, compose mode) - pick element with most text
  //   Phase 2: Same-origin iframe content (email body often rendered in an iframe)
  //   Phase 3: frameText from popup's allFrames collection (noisy, last resort)
  //   Phase 4: Reading pane container selectors (broadest DOM search)
  // After body text is resolved, extracts subject, sender, and runs GameStop regex patterns.
  async extractOutlookData(frameText) {
    try {
      console.log('BuckBuddy: Starting Outlook extraction. frameText length:', frameText?.length || 0);

      // Phase 1: Try specific DOM selectors, pick the element with the MOST text
      let bodyText = '';
      for (const sel of this.outlookSelectors.emailBody) {
        try {
          const elements = document.querySelectorAll(sel);
          for (const el of elements) {
            const text = el.innerText || '';
            if (text.length > bodyText.length) {
              bodyText = text;
            }
          }
        } catch (e) { /* skip invalid selector */ }
      }
      console.log('BuckBuddy: Phase 1 (DOM selectors) body length:', bodyText.length);

      // Phase 2: Try reading iframe content directly (same-origin iframes)
      if (bodyText.length < 100) {
        const iframes = document.querySelectorAll('iframe');
        console.log('BuckBuddy: Phase 2 checking', iframes.length, 'iframes');
        for (const iframe of iframes) {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc?.body) {
              const iframeText = iframeDoc.body.innerText || '';
              if (iframeText.length > bodyText.length) {
                bodyText = iframeText;
                console.log('BuckBuddy: Got iframe text, length:', iframeText.length);
              }
            }
          } catch (e) {
            console.log('BuckBuddy: Iframe not accessible (sandboxed/cross-origin)');
          }
        }
      }

      // Phase 3: Use popup-provided frameText only if DOM yielded almost nothing.
      // frameText comes from ALL frames (message list, sidebar, ads) so it is noisy.
      if (frameText && bodyText.length < 50) {
        bodyText = frameText;
        console.log('BuckBuddy: Using popup-provided frameText (DOM too short), length:', bodyText.length);
      }

      // Phase 4: Broadest DOM fallback -- reading pane container (avoids inbox/message list)
      if (bodyText.length < 100) {
        const readingPaneSelectors = [
          'div[data-testid="ReadingPaneContainer"]',
          'div[class*="ReadingPane"]',
          'div[role="complementary"]',
          'div[aria-label*="Reading"]',
          'div[aria-label*="Message"]',
        ];
        for (const sel of readingPaneSelectors) {
          try {
            const el = document.querySelector(sel);
            if (el) {
              const text = el.innerText || '';
              if (text.length > bodyText.length) {
                bodyText = text;
                console.log('BuckBuddy: Phase 4 reading pane fallback hit:', sel, 'length:', text.length);
                break;
              }
            }
          } catch (e) { /* skip */ }
        }
      }

      // Extract email metadata from Outlook DOM
      let subject = '';
      const subjectEl = this._queryOutlookSelector(this.outlookSelectors.subject);
      if (subjectEl) {
        subject = subjectEl.textContent?.trim() || subjectEl.getAttribute('title') || '';
      }

      let senderName = '';
      const nameEl = this._queryOutlookSelector(this.outlookSelectors.senderName);
      if (nameEl) {
        senderName = nameEl.textContent?.trim() || '';
      }

      let senderEmail = '';
      const emailEl = this._queryOutlookSelector(this.outlookSelectors.senderEmail);
      if (emailEl) {
        const href = emailEl.getAttribute('href') || '';
        senderEmail = href.startsWith('mailto:')
          ? href.replace('mailto:', '').split('?')[0]
          : emailEl.getAttribute('title') || emailEl.textContent?.trim() || '';
      }

      // Combine subject + body for full regex scanning
      const fullText = `${subject}\n${bodyText}`;
      console.log('BuckBuddy: Full text for regex scanning, length:', fullText.length);

      const allNumbers = fullText.match(/\b\d+\b/g) || [];

      // Extract ALL emails and phones from the full text
      const allEmails = this._extractAllEmails(fullText);
      const allPhones = this._extractAllPhones(fullText);

      // Ensure DOM-extracted sender email is first (skip agent/support addresses)
      if (senderEmail && !this._isAgentOrSupportEmail(senderEmail) &&
          !allEmails.map(e => e.toLowerCase()).includes(senderEmail.toLowerCase())) {
        allEmails.unshift(senderEmail);
      }

      const rawSkus = this.extractPattern(fullText, this.patterns.sku);

      const extractedData = {
        ticketDescription: subject ? `${subject}\n\n${bodyText}` : bodyText || 'No email content available',
        internalNotes: [],
        orderNumbers: this._extractOrderNumbers(fullText),
        giftCards: this.extractPattern(fullText, this.patterns.giftCard),
        tickets: this.extractPattern(fullText, this.patterns.ticket),
        skus: this._normalizeSkus(rawSkus),
        storeNumbers: this._extractStoreNumbers(fullText),
        purNumbers: this._extractPurNumbers(allNumbers, fullText),
        trackingNumbers: await this._extractTrackingNumbers(fullText),
        status: '',
        timestamp: '',
        customerName: senderName,
        emails: allEmails,
        phones: allPhones,
      };

      console.log('BuckBuddy: Outlook extracted data:', {
        bodyLength: bodyText.length,
        orders: extractedData.orderNumbers,
        emails: extractedData.emails,
        phones: extractedData.phones,
        tracking: extractedData.trackingNumbers,
        skus: extractedData.skus,
      });

      return this.cleanExtractedData(extractedData);
    } catch (error) {
      console.error('BuckBuddy: Outlook extraction error:', error);
      throw new Error('Failed to extract email data: ' + error.message);
    }
  }

  // Generates a unique ID for the currently viewed Outlook email.
  // Primary: URL hash ID. Secondary: subject+sender fingerprint hash. Last resort: URL path.
  _extractOutlookItemId() {
    const hash = window.location.hash || '';
    const idMatch = hash.match(/\/id\/([^/&]+)/);
    if (idMatch) return `outlook_${idMatch[1]}`;

    // Secondary: fingerprint from reading pane subject + sender (reliable for inbox clicks)
    const subjectEl = this._queryOutlookSelector(this.outlookSelectors.subject);
    const senderEl = this._queryOutlookSelector(this.outlookSelectors.senderName);
    const subject = subjectEl?.textContent?.trim() || '';
    const sender = senderEl?.textContent?.trim() || '';

    if (subject || sender) {
      const fp = `${subject}|${sender}`;
      let h = 0;
      for (let i = 0; i < fp.length; i++) {
        h = ((h << 5) - h) + fp.charCodeAt(i);
        h |= 0;
      }
      return `outlook_fp_${Math.abs(h).toString(36)}`;
    }

    // Last resort: URL path
    const pathMatch = window.location.pathname.match(/\/mail\/([^/]+)/);
    if (pathMatch) return `outlook_${pathMatch[1]}`;

    return 'outlook_unknown';
  }

  // Detects email switches in Outlook via URL hash changes, DOM mutations, and message-list clicks.
  // Immediately clears stale data on switch, then re-extracts after 800ms for DOM to settle.
  setupOutlookEmailObserver() {
    let lastItemId = this._extractOutlookItemId();
    let debounceTimer = null;
    let extractionTimer = null;

    const emptyData = {
      ticketDescription: 'No email content available',
      internalNotes: [],
      orderNumbers: [],
      giftCards: [],
      tickets: [],
      skus: [],
      storeNumbers: [],
      purNumbers: [],
      trackingNumbers: [],
      status: '',
      timestamp: '',
      customerName: '',
      emails: [],
      phones: [],
    };

    const checkForEmailChange = () => {
      const currentId = this._extractOutlookItemId();
      if (currentId !== lastItemId) {
        lastItemId = currentId;
        this.logDebug('Outlook email changed, clearing stale data and re-extracting');
        // Cancel any pending extraction from a previous switch
        if (extractionTimer) clearTimeout(extractionTimer);
        // Clear stale data immediately with empty structure
        chrome.storage.local.set({
          lastTicketData: emptyData,
          lastTicketId: currentId,
          lastDataSite: 'outlook',
          lastUpdateTimestamp: new Date().toISOString(),
        });
        // Re-extract after DOM fully settles
        extractionTimer = setTimeout(() => this.storeCurrentData(), 800);
      }
    };

    // Debounced check to avoid excessive DOM reads from MutationObserver
    const debouncedCheck = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => checkForEmailChange(), 250);
    };

    // Watch for URL hash changes (Outlook routes via hash)
    window.addEventListener('hashchange', () => checkForEmailChange());

    // Watch for DOM changes when clicking different emails
    const observer = new MutationObserver(() => {
      debouncedCheck();
    });

    // Observe the reading pane area for content swaps
    const target = document.querySelector('div[role="main"]') || document.body;
    observer.observe(target, { childList: true, subtree: true });

    // Also listen for clicks on the message list
    document.addEventListener('click', (e) => {
      const row = e.target.closest('div[role="option"], div[data-convid], div[aria-label*="message"]');
      if (row) {
        // Immediate check + delayed check to catch both fast and slow renders
        setTimeout(() => checkForEmailChange(), 300);
        setTimeout(() => checkForEmailChange(), 800);
      }
    }, { passive: true, capture: true });

    this.outlookObserver = observer;
  }

  // ═══ Sterling OMS (IBM Call Center) methods ═══

  // Extracts customer and order data from Sterling OMS using uid-based selectors
  // for structured fields, then falls back to full-page regex for GameStop patterns.
  async extractSterlingData() {
    try {
      console.log('BuckBuddy: Starting Sterling extraction');

      // ── Targeted uid-based selector extraction ──
      let customerName = '';
      const nameEl = document.querySelector('[uid="lnkCustomerName"] a.idxLink') ||
                      document.querySelector('.scLabel.groupHeader[uid="lblCustomerName"]');
      if (nameEl) customerName = nameEl.textContent?.trim() || '';

      let phone = '';
      const phoneEl = document.querySelector('.scLabel[uid="lblDayPhone"]');
      if (phoneEl) phone = (phoneEl.textContent?.trim() || '').replace(/\D/g, '');

      let senderEmail = '';
      const emailEl = document.querySelector('[uid="lnkEmail"] a.idxLink');
      if (emailEl) senderEmail = emailEl.textContent?.trim() || '';

      // Order number from aria-label on enterprise holder panel
      let sterlingOrderNum = '';
      const orderHolder = document.querySelector('[uid="pnlEnterpriseHolder"]');
      if (orderHolder) {
        const ariaLabel = orderHolder.getAttribute('aria-label') || '';
        const orderMatch = ariaLabel.match(/Order\s+(\d+)/i);
        if (orderMatch) sterlingOrderNum = orderMatch[1];
      }

      // Screen title for context
      const screenTitleEl = document.querySelector('.scLabel.screenTitle');
      const screenTitle = screenTitleEl?.textContent?.trim() || '';

      // ── Full-page regex scan for GameStop patterns ──
      const fullText = document.body.innerText || '';
      console.log('BuckBuddy: Sterling full text length:', fullText.length);

      const allEmails = this._extractAllEmails(fullText);
      const allPhones = this._extractAllPhones(fullText);

      // Ensure DOM-extracted values are first
      if (senderEmail && !allEmails.map(e => e.toLowerCase()).includes(senderEmail.toLowerCase())) {
        allEmails.unshift(senderEmail);
      }
      if (phone && !allPhones.includes(phone) && !this._isBogusPhone(phone)) {
        allPhones.unshift(phone);
      }

      const orderNumbers = this._extractOrderNumbers(fullText);
      if (sterlingOrderNum && !orderNumbers.includes(sterlingOrderNum)) {
        orderNumbers.unshift(sterlingOrderNum);
      }

      // Extract dollar amounts from page text
      const totalAmounts = this._extractDollarAmounts(fullText);

      const rawSkus = this.extractPattern(fullText, this.patterns.sku);

      const extractedData = {
        ticketDescription: screenTitle ? `Sterling: ${screenTitle}` : 'Sterling Call Center',
        internalNotes: [],
        orderNumbers,
        giftCards: this.extractPattern(fullText, this.patterns.giftCard),
        tickets: this.extractPattern(fullText, this.patterns.ticket),
        skus: this._normalizeSkus(rawSkus),
        storeNumbers: this._extractStoreNumbers(fullText),
        purNumbers: this._extractPurNumbers([], fullText),
        trackingNumbers: await this._extractTrackingNumbers(fullText),
        totalAmounts,
        status: '',
        timestamp: '',
        customerName,
        emails: allEmails,
        phones: allPhones,
      };

      console.log('BuckBuddy: Sterling extracted data:', {
        customerName, orders: extractedData.orderNumbers,
        emails: extractedData.emails, phones: extractedData.phones,
        tracking: extractedData.trackingNumbers, amounts: extractedData.totalAmounts,
      });

      return this.cleanExtractedData(extractedData);
    } catch (error) {
      console.error('BuckBuddy: Sterling extraction error:', error);
      throw new Error('Failed to extract Sterling data: ' + error.message);
    }
  }

  // Generates a unique ID for the current Sterling screen (order number or screen title hash)
  _extractSterlingItemId() {
    const orderHolder = document.querySelector('[uid="pnlEnterpriseHolder"]');
    if (orderHolder) {
      const ariaLabel = orderHolder.getAttribute('aria-label') || '';
      const orderMatch = ariaLabel.match(/Order\s+(\d+)/i);
      if (orderMatch) return `sterling_${orderMatch[1]}`;
    }

    // Fallback: screen title fingerprint
    const screenTitleEl = document.querySelector('.scLabel.screenTitle');
    const screenTitle = screenTitleEl?.textContent?.trim() || '';
    if (screenTitle) {
      let h = 0;
      for (let i = 0; i < screenTitle.length; i++) {
        h = ((h << 5) - h) + screenTitle.charCodeAt(i);
        h |= 0;
      }
      return `sterling_fp_${Math.abs(h).toString(36)}`;
    }

    return 'sterling_unknown';
  }

  // Watches for screen changes in Sterling (single-page Dojo app -- URL never changes, only DOM)
  setupSterlingObserver() {
    let lastItemId = this._extractSterlingItemId();
    let debounceTimer = null;

    const checkForScreenChange = () => {
      const currentId = this._extractSterlingItemId();
      if (currentId !== lastItemId) {
        lastItemId = currentId;
        this.logDebug('Sterling screen changed, re-extracting');
        setTimeout(() => this.storeCurrentData(), 800);
      }
    };

    const debouncedCheck = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => checkForScreenChange(), 300);
    };

    // Sterling is a single-page Dojo app — URL doesn't change, DOM mutates
    const target = document.querySelector('[role="main"]') ||
                   document.querySelector('.scScreenContainer') ||
                   document.body;
    const observer = new MutationObserver(() => debouncedCheck());
    observer.observe(target, { childList: true, subtree: true });
    this.sterlingObserver = observer;
  }

  // ═══ Power BI methods ═══

  // Extracts data from Power BI reports by collecting text from visual containers,
  // iframes, and frameText fallback, then running GameStop regex patterns.
  async extractPowerBIData(frameText) {
    try {
      console.log('BuckBuddy: Starting Power BI extraction');

      // ── Strategy: broad text collection + regex ──
      let bodyText = '';

      // Try visual containers first (Power BI renders data in these)
      const visuals = document.querySelectorAll('.visual-container, .visualContainer, [class*="visual"]');
      for (const visual of visuals) {
        const text = visual.innerText || '';
        if (text.length > 10) bodyText += '\n' + text;
      }

      // Try accessing report iframes (same-origin check)
      if (bodyText.length < 100) {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc?.body) {
              const iframeText = iframeDoc.body.innerText || '';
              if (iframeText.length > bodyText.length) {
                bodyText = iframeText;
              }
            }
          } catch (e) {
            // Cross-origin iframe, skip
          }
        }
      }

      // Use frameText from popup's allFrames collection as fallback
      if (frameText && bodyText.length < 50) {
        bodyText = frameText;
        console.log('BuckBuddy: Using popup-provided frameText for Power BI');
      }

      // Final fallback: full page text
      if (bodyText.length < 100) {
        bodyText = document.body.innerText || '';
      }

      console.log('BuckBuddy: Power BI text length:', bodyText.length);

      const allEmails = this._extractAllEmails(bodyText);
      const allPhones = this._extractAllPhones(bodyText);
      const totalAmounts = this._extractDollarAmounts(bodyText);
      const rawSkus = this.extractPattern(bodyText, this.patterns.sku);

      const extractedData = {
        ticketDescription: 'Power BI Report',
        internalNotes: [],
        orderNumbers: this._extractOrderNumbers(bodyText),
        giftCards: this.extractPattern(bodyText, this.patterns.giftCard),
        tickets: this.extractPattern(bodyText, this.patterns.ticket),
        skus: this._normalizeSkus(rawSkus),
        storeNumbers: this._extractStoreNumbers(bodyText),
        purNumbers: this._extractPurNumbers([], bodyText),
        trackingNumbers: await this._extractTrackingNumbers(bodyText),
        totalAmounts,
        status: '',
        timestamp: '',
        customerName: '',
        emails: allEmails,
        phones: allPhones,
      };

      console.log('BuckBuddy: Power BI extracted data:', {
        orders: extractedData.orderNumbers,
        emails: extractedData.emails,
        tracking: extractedData.trackingNumbers,
        amounts: extractedData.totalAmounts,
      });

      return this.cleanExtractedData(extractedData);
    } catch (error) {
      console.error('BuckBuddy: Power BI extraction error:', error);
      throw new Error('Failed to extract Power BI data: ' + error.message);
    }
  }

  // Generates a unique ID for the current Power BI report page (hash of URL path + hash)
  _extractPowerBIItemId() {
    const hash = window.location.hash || '';
    const path = window.location.pathname || '';
    const combined = `${path}${hash}`;

    if (combined.length > 1) {
      let h = 0;
      for (let i = 0; i < combined.length; i++) {
        h = ((h << 5) - h) + combined.charCodeAt(i);
        h |= 0;
      }
      return `powerbi_${Math.abs(h).toString(36)}`;
    }

    return 'powerbi_unknown';
  }

  // Watches for Power BI report page changes via URL hash and DOM mutations
  setupPowerBIObserver() {
    let lastItemId = this._extractPowerBIItemId();
    let debounceTimer = null;

    const checkForReportChange = () => {
      const currentId = this._extractPowerBIItemId();
      if (currentId !== lastItemId) {
        lastItemId = currentId;
        this.logDebug('Power BI report changed, re-extracting');
        setTimeout(() => this.storeCurrentData(), 800);
      }
    };

    const debouncedCheck = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => checkForReportChange(), 500);
    };

    // Watch for URL hash changes (Power BI routes via hash)
    window.addEventListener('hashchange', () => checkForReportChange());

    // Watch for DOM changes when switching report pages
    const target = document.querySelector('[role="main"]') || document.body;
    const observer = new MutationObserver(() => debouncedCheck());
    observer.observe(target, { childList: true, subtree: true });
    this.powerbiObserver = observer;
  }

  // ═══ Shared utilities ═══

  // Extracts unique dollar amounts like $1,234.56 or $99.99 from text
  _extractDollarAmounts(text) {
    const amountRegex = /\$\d{1,3}(?:,\d{3})*\.\d{2}/g;
    const matches = text.match(amountRegex) || [];
    const seen = new Set();
    return matches.filter(amount => {
      if (seen.has(amount)) return false;
      seen.add(amount);
      return true;
    });
  }

  // Post-processes extracted data: trims whitespace, strips special characters,
  // deduplicates arrays, and validates format (e.g., order numbers must match known
  // patterns, tracking numbers must be >= 12 chars). Also ensures description and
  // internalNotes always have a default value.
  cleanExtractedData(data) {
    const cleaned = {};
    Object.entries(data).forEach(([key, values]) => {
      try {
        if (Array.isArray(values)) {
          cleaned[key] = [...new Set(values)]
            .map((value) => {
              if (typeof value === 'string') {
                return value
                  .trim()
                  .replace(/\s+/g, ' ')
                  .replace(/[^\w\s-@.]/g, '');
              }
              return value;
            })
            .filter(Boolean)
            .filter((value) => {
              if (key === 'orderNumbers') {
                return (
                  /^[WDS]\d{8}$/.test(value) || /^11000000\d{8}$/.test(value) || /^20\d{7}$/.test(value)
                );
              }
              if (key === 'trackingNumbers') {
                return value.length >= 12 && !/^59\d{10}$/.test(value);
              }
              return true;
            });
        } else if (typeof values === 'object' && values !== null) {
          cleaned[key] = this.cleanExtractedData(values);
        } else {
          if (typeof values === 'string') {
            cleaned[key] = values
              .trim()
              .replace(/\s+/g, ' ')
              .replace(/[^\w\s-@.]/g, '');
          } else {
            cleaned[key] = values;
          }
        }
      } catch (error) {
        console.error(`Error cleaning ${key}:`, error);
        cleaned[key] = values;
      }
    });

    if (!cleaned.ticketDescription) {
      cleaned.ticketDescription = 'No description available';
    }
    if (!cleaned.internalNotes || cleaned.internalNotes.length === 0) {
      cleaned.internalNotes = ['No internal notes available'];
    }

    return cleaned;
  }
}

// Instantiate the content script -- runs immediately when injected by Chrome
const contentScript = new ContentScriptManager();