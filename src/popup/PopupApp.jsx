/**
 * PopupApp.jsx -- Main popup UI for the BuckBuddy Chrome extension.
 *
 * Layout: WidgetBar (configurable pills + lock/settings) -> Tabs -> Quick Templates
 *         -> Tab content (data / templates / stats / buck) -> Footer action buttons
 *         -> Modals (settings, tracking, SKU lookup, notepad, reminders)
 *
 * Data flow: On mount, extracts ticket data from the active tab via content script
 * message passing, then persists it to chrome.storage.local. Storage change
 * listeners keep the UI in sync when data updates externally.
 */

import React, { useState, useEffect } from 'react';
import { setupKonamiCode } from '../utils/konamiCode';
import { achievementSystem } from '../utils/achievementSystem';
import {
  Loader,
  Package,
} from 'lucide-react';
import {
  RefreshCw,
  AlertCircle,
  Search,
  FileText,
  Bell,
} from '../icons';
import { Unlock } from 'lucide-react';
import { Lock, Settings as SettingsIcon } from '../icons';
import WidgetBar from '../components/widgetbar/WidgetBar';
import SiteWidget from '../components/widgetbar/widgets/SiteWidget';
import FreshnessWidget from '../components/widgetbar/widgets/FreshnessWidget';
import DraggableDataGroups from '../components/dataDisplay/DraggableDataGroups';
import DraggableTabs from '../components/navigation/DraggableTabs';
import TemplatesPage from '../components/templates/TemplatesPage';
import BuckTamagotchi from '../components/buck/BuckTamagotchi';
import StatsDashboard from '../components/stats/StatsDashboard';
import SettingsModal from '../components/settings/SettingsModal';
import BreakOverlay from '../components/overlay/BreakOverlay';
import SoundButton from '../components/common/SoundButton';
import { useSoundEffect } from '../utils/soundUtils';
import { achievementTriggers } from '../utils/achievementTriggers';
import AchievementToast from '../components/notifications/AchievementToast';
import TrackingLookupModal from '../components/tracking/TrackingLookupModal';
import SkuLookupModal from '../components/lookup/SkuLookupModal';
import NotepadModal from '../components/notepad/NotepadModal';
import RemindersModal from '../components/reminders/RemindersModal';
import OnboardingOverlay from '../components/onboarding/OnboardingOverlay';
import QuickTemplates from '../components/templates/QuickTemplates';
import TicketNote from '../components/dataDisplay/TicketNote';
import { Monitor } from 'lucide-react';

// Compact pill button shown in the header quick-templates strip.
// Resolves template variables against current ticket data on click, copies to clipboard.
const HeaderQuickTemplatePill = ({ template, ticketData }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // Dynamic import keeps templateClipboard out of the initial bundle
      const { copyTemplateToClipboard } = await import('../utils/templateClipboard');
      await copyTemplateToClipboard(template, ticketData);
      chrome.runtime.sendMessage({ type: 'TRACK_TEMPLATE_COPY' }).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error('Error copying template:', error);
    }
  };

  return (
    <button
      onClick={handleCopy}
      title={template.name || 'Template'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 500,
        maxWidth: '80px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        border: copied ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid var(--border-primary)',
        backgroundColor: copied ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-secondary)',
        color: copied ? '#22c55e' : 'var(--text-secondary)',
      }}
    >
      {copied ? 'Copied' : (template.name || 'Template')}
    </button>
  );
};

const PopupApp = () => {
  // --- State: UI controls ---
  const [activeTab, setActiveTab] = useState(null);
  const [activeAchievement, setActiveAchievement] = useState(null);

  // Listen for achievement unlock events dispatched by the achievement system
  useEffect(() => {
    const handler = (e) => {
      setActiveAchievement(e.detail);
      setTimeout(() => setActiveAchievement(null), 5000);
    };
    document.addEventListener('achievementUnlocked', handler);
    return () => document.removeEventListener('achievementUnlocked', handler);
  }, []);

  // --- State: ticket data and extraction ---
  const [ticketData, setTicketData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnTicketPage, setIsOnTicketPage] = useState(false);
  const [lastTicketId, setLastTicketId] = useState(null);

  // --- State: layout and modal visibility ---
  const [isLocked, setIsLocked] = useState(true); // Locks tab/data-group drag reordering
  const [showSettings, setShowSettings] = useState(false);
  const [quickTemplates, setQuickTemplates] = useState([]);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showSkuModal, setShowSkuModal] = useState(false);
  const [showNotepadModal, setShowNotepadModal] = useState(false);
  const [showRemindersModal, setShowRemindersModal] = useState(false);
  const [overdueReminders, setOverdueReminders] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dataSite, setDataSite] = useState(null); // Which site data was extracted from (freshdesk, outlook, etc.)
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState(null);
  const [relativeTime, setRelativeTime] = useState('');
  const [ticketElapsed, setTicketElapsed] = useState(0); // seconds on current ticket

  // --- State: feature toggles loaded from storage ---
  const [featureSettings, setFeatureSettings] = useState({
    trackingEnabled: true,
    skuLookupEnabled: true,
    notepadEnabled: true,
    remindersEnabled: true,
    notificationSoundEnabled: true,
    hudMode: false,
    widgetBarEnabled: true,
  });
  const sounds = useSoundEffect();

  // Count overdue reminders for the badge dot on the Remind button
  const countOverdue = (reminders) => {
    const now = Date.now();
    return (reminders || []).filter((r) => new Date(r.dateTime).getTime() <= now).length;
  };

  // Master initialization effect -- runs once on popup open
  useEffect(() => {
    const initialize = async () => {
      // Check onboarding status -- re-show if version changed
      const CURRENT_ONBOARDING_VERSION = 2;
      const onboardingResult = await chrome.storage.local.get(['onboarding_completed', 'onboarding_version']);
      if (!onboardingResult.onboarding_completed || (onboardingResult.onboarding_version || 0) < CURRENT_ONBOARDING_VERSION) {
        setShowOnboarding(true);
      }

      await initializeActiveTab();
      await loadQuickTemplates();
      await loadStoredTicketData();
      await loadFeatureSettings();
      await initializeExtraction();
      setupKonamiCode(() => {
        achievementTriggers.onKonamiCode();
      });

      // Seed overdue count on popup open
      const { reminders } = await chrome.storage.local.get('reminders');
      setOverdueReminders(countOverdue(reminders));
    };
    initialize();

    // Keep popup in sync when storage changes externally (e.g., from content script or HUD)
    const handleStorageChange = (changes, area) => {
      if (area === 'local') {
        if (changes.lastTicketData) {
          handleTicketDataUpdate(changes.lastTicketData.newValue);
        }
        if (changes.featureSettings) {
          setFeatureSettings((prev) => ({ ...prev, ...changes.featureSettings.newValue }));
        }
        if (changes.reminders) {
          setOverdueReminders(countOverdue(changes.reminders.newValue));
        }
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Track per-ticket timer: record start time when ticket changes, tick every second
  useEffect(() => {
    if (!lastTicketId) return;

    const initTimer = async () => {
      const result = await chrome.storage.local.get('currentTicketTimer');
      const timer = result.currentTicketTimer;
      if (timer?.ticketId === lastTicketId) {
        // Resume existing timer
        setTicketElapsed(Math.floor((Date.now() - timer.startTime) / 1000));
      } else {
        // New ticket, start fresh
        const startTime = Date.now();
        await chrome.storage.local.set({ currentTicketTimer: { ticketId: lastTicketId, startTime } });
        setTicketElapsed(0);
      }
    };
    initTimer();

    const id = setInterval(() => {
      setTicketElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [lastTicketId]);

  // Refresh relative time display every 30 seconds
  useEffect(() => {
    const computeRelative = () => {
      if (!lastUpdateTimestamp) { setRelativeTime(''); return; }
      const diff = Math.floor((Date.now() - new Date(lastUpdateTimestamp).getTime()) / 1000);
      if (diff < 60) setRelativeTime('just now');
      else if (diff < 3600) setRelativeTime(`${Math.floor(diff / 60)}m ago`);
      else setRelativeTime(`${Math.floor(diff / 3600)}h ago`);
    };
    computeRelative();
    const id = setInterval(computeRelative, 30000);
    return () => clearInterval(id);
  }, [lastUpdateTimestamp]);

  // Normalize and apply incoming ticket data, ensuring trackingNumbers is always an array
  const handleTicketDataUpdate = (newData) => {
    if (!newData) return;

    const trackingNumbers = Array.isArray(newData.trackingNumbers)
      ? newData.trackingNumbers
      : [];

    console.log('New ticket data detected:', newData);
    console.log('Tracking numbers in update:', trackingNumbers);

    const validatedData = {
      ...newData,
      trackingNumbers: trackingNumbers,
    };

    setTicketData(validatedData);
  };

  // Restore the first tab from the user's saved tab order.
  // Migrates old saved orders that may be missing 'stats'.
  const initializeActiveTab = async () => {
    try {
      const result = await chrome.storage.local.get('tabOrder');
      let savedOrder = result.tabOrder || ['data', 'templates', 'stats', 'buck'];
      // Ensure 'stats' tab exists for users with old saved order
      if (!savedOrder.includes('stats')) {
        savedOrder = [...savedOrder.slice(0, -1), 'stats', ...savedOrder.slice(-1)];
      }
      // NOTE: 'chat' was renamed to 'buck' -- this guard is unreachable for new users
      // but kept for anyone with a stale tabOrder in storage.
      const firstTab = savedOrder[0] === 'chat' ? 'buck' : savedOrder[0];
      setActiveTab(firstTab);
    } catch (error) {
      console.error('Error loading initial tab:', error);
      setActiveTab('data');
    }
  };

  const loadQuickTemplates = async () => {
    try {
      const result = await chrome.storage.local.get('quickTemplates');
      setQuickTemplates(result.quickTemplates || []);
    } catch (error) {
      console.error('Error loading quick templates:', error);
    }
  };

  const loadStoredTicketData = async () => {
    try {
      const result = await chrome.storage.local.get([
        'lastTicketData',
        'lastTicketId',
        'lastDataSite',
        'lastUpdateTimestamp',
      ]);
      console.log('Storage result:', result);
      if (result.lastTicketData && result.lastTicketId) {
        console.log('Loading stored ticket data:', result.lastTicketData);
        setTicketData(result.lastTicketData);
        setLastTicketId(result.lastTicketId);
        if (result.lastDataSite) setDataSite(result.lastDataSite);
        if (result.lastUpdateTimestamp) setLastUpdateTimestamp(result.lastUpdateTimestamp);
      } else {
        console.log('No ticket data found in storage');
      }
    } catch (error) {
      console.error('Error loading stored ticket data:', error);
    }
  };

  const loadFeatureSettings = async () => {
    try {
      const result = await chrome.storage.local.get('featureSettings');
      if (result.featureSettings) {
        setFeatureSettings((prev) => ({ ...prev, ...result.featureSettings }));
      }
    } catch (error) {
      console.error('Error loading feature settings:', error);
    }
  };


  // Core extraction flow: detect site, gather frame text if needed, then
  // ask the content script to extract ticket data and persist results to storage.
  const initializeExtraction = async () => {
    try {
      setLoading(true);
      setError(null);

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Determine which supported site the user is on
      const url = tab?.url || '';
      const isOutlook =
        url.includes('outlook.office.com') ||
        url.includes('outlook.office365.com') ||
        url.includes('outlook.live.com');
      const isPowerBI = url.includes('app.powerbi.com');
      const isSterling = url.includes('oms-web.prod-pci-gsaws.com');
      const isSupportedSite = url.includes('freshdesk.com') || isOutlook || isPowerBI || isSterling;
      setIsOnTicketPage(isSupportedSite);

      if (!isSupportedSite) {
        setLoading(false);
        return;
      }

      // For Outlook and Power BI, collect text from child frames
      // (content may be in sandboxed iframes).
      let frameText = '';
      if (isOutlook || isPowerBI) {
        try {
          const frameResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            func: () => document.body?.innerText || '',
          });
          // Exclude frame 0 (main frame) — only keep child frame content
          const childFrames = (frameResults || [])
            .filter(r => r.frameId !== 0 && r.result)
            .sort((a, b) => (b.result?.length || 0) - (a.result?.length || 0));
          frameText = childFrames[0]?.result || '';
          console.log('Collected from', frameResults?.length, 'frames, best child frame length:', frameText.length);
        } catch (e) {
          console.warn('Could not collect frame text:', e);
        }
      }

      let response;
      try {
        response = await chrome.tabs.sendMessage(tab.id, {
          type: 'INITIALIZE_EXTRACTION',
          frameText: frameText || undefined,
        });
      } catch (msgErr) {
        // Content script is dead (extension updated, tab predates install, etc.)
        // Re-inject it and retry once
        console.warn('Content script unreachable, re-injecting:', msgErr.message);
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['contentScript.js'],
        });
        // Brief pause for the script to initialize its message listeners
        await new Promise((r) => setTimeout(r, 300));
        response = await chrome.tabs.sendMessage(tab.id, {
          type: 'INITIALIZE_EXTRACTION',
          frameText: frameText || undefined,
        });
      }

      console.log('Extraction response:', response);

      if (response?.success) {
        const trackingNumbers = Array.isArray(response.data?.trackingNumbers)
          ? response.data.trackingNumbers
          : [];

        console.log('Setting ticket data:', response.data);
        console.log('Tracking numbers found:', trackingNumbers);

        const validatedData = {
          ...response.data,
          trackingNumbers: trackingNumbers,
        };

        setTicketData(validatedData);
        setLastTicketId(response.ticketId);
        if (response.site) setDataSite(response.site);

        const timestamp = new Date().toISOString();
        setLastUpdateTimestamp(timestamp);
        await chrome.storage.local.set({
          lastTicketData: validatedData,
          lastTicketId: response.ticketId,
          lastDataSite: response.site || null,
          lastUpdateTimestamp: timestamp,
        });

      } else {
        throw new Error('Data extraction failed');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to connect to the page. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="buck-buddy-popup w-[400px] h-full flex flex-col overflow-hidden"
         style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Achievement Toast */}
      {activeAchievement && (
        <AchievementToast achievement={activeAchievement} />
      )}

      {/* Onboarding Overlay */}
      {showOnboarding && (
        <OnboardingOverlay onComplete={() => setShowOnboarding(false)} setActiveTab={setActiveTab} />
      )}

      {/* ═══ TOP BAR: site badge, freshness, lock, settings ═══ */}
      <div
        className="flex-none"
        style={{ backgroundColor: 'var(--card-bg)', borderBottom: '1px solid var(--border-primary)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', minHeight: '36px', gap: '6px' }}>
          {/* Left spacer */}
          <div style={{ flex: 1 }} />

          {/* Center: site + freshness badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <SiteWidget dataSite={dataSite} tooltip="Where ticket data was pulled from" />
            <FreshnessWidget relativeTime={relativeTime} lastUpdateTimestamp={lastUpdateTimestamp} tooltip="How fresh the ticket data is" />
          </div>

          {/* Right: lock + settings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, justifyContent: 'flex-end' }}>
            <SoundButton
              onClick={() => setIsLocked(!isLocked)}
              className="p-1 rounded-lg transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              title={isLocked ? 'Unlock to rearrange tabs and data groups' : 'Lock tabs and data groups in place'}
              data-onboarding="btn-lock"
            >
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </SoundButton>
            <SoundButton
              onClick={() => setShowSettings(true)}
              className="p-1 rounded-lg transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              title="Settings"
              data-onboarding="btn-settings"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
            </SoundButton>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-none"
           style={{ backgroundColor: 'var(--card-bg)', borderBottom: '1px solid var(--border-primary)' }}>
        <DraggableTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isLocked={isLocked}
        />
      </div>

      {/* Quick Templates Strip */}
      {quickTemplates.length > 0 && (
        <div
          className="flex-none"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderBottom: '1px solid var(--border-primary)',
            padding: '3px 8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
              justifyContent: 'center',
              maxHeight: '60px',
              overflowY: 'auto',
            }}
          >
            {quickTemplates.map((qt) => (
              <HeaderQuickTemplatePill key={qt.id} template={qt} ticketData={ticketData} />
            ))}
          </div>
        </div>
      )}

      {/* Main Content -- loading spinner -> error state -> HUD placeholder -> active tab panel */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader className="w-8 h-8 animate-spin text-brand" />
          </div>
        ) : error ? (
          <div className="p-4">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-primary)' }}>
              <div className="flex items-start gap-4">
                <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--error-color)' }} />
                <div>
                  <h3 className="font-medium mb-2" style={{ color: 'var(--error-color)' }}>Error</h3>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{error}</p>
                  <SoundButton
                    onClick={initializeExtraction}
                    className="w-full text-white py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2 text-sm font-medium btn-brand"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                  </SoundButton>
                </div>
              </div>
            </div>
          </div>
        ) : featureSettings.hudMode ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-6"
               style={{ color: 'var(--text-secondary)' }}>
            <Monitor className="w-10 h-10" style={{ color: 'var(--brand-primary)' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              HUD Mode Active
            </span>
            <span style={{ fontSize: '12px', textAlign: 'center', lineHeight: '1.4' }}>
              Panels are displayed on your webpage. Drag them anywhere on screen.
            </span>
            <button
              onClick={async () => {
                const updated = { ...featureSettings, hudMode: false };
                setFeatureSettings(updated);
                await chrome.storage.local.set({ featureSettings: updated });
              }}
              style={{
                marginTop: '4px',
                padding: '6px 16px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px',
                border: '1px solid var(--border-primary)',
                backgroundColor: 'var(--card-bg)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              Disable HUD Mode
            </button>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            {activeTab === 'data' && (
              <div className="p-1">
                <TicketNote ticketId={lastTicketId} />
                <DraggableDataGroups
                  ticketData={ticketData}
                  isLocked={isLocked}
                />
              </div>
            )}
            {activeTab === 'templates' && (
              <div className="p-4">
                <TemplatesPage
                  quickTemplates={quickTemplates}
                  setQuickTemplates={setQuickTemplates}
                  ticketData={ticketData}
                />
              </div>
            )}
            {activeTab === 'stats' && (
              <div className="p-4">
                <StatsDashboard ticketId={lastTicketId} />
              </div>
            )}
            {activeTab === 'buck' && (
              <div className="p-4 flex items-center justify-center" style={{ minHeight: '100%' }}>
                <BuckTamagotchi />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer -- action buttons conditionally rendered based on feature toggles */}
      <div className="flex-none"
           style={{ backgroundColor: 'var(--card-bg)', borderTop: '1px solid var(--border-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 4px' }}>
          {featureSettings.trackingEnabled && (
            <SoundButton
              data-onboarding="btn-track"
              onClick={() => setShowTrackingModal(true)}
              style={{
                flex: 1,
                margin: '0 2px',
                padding: '8px 0',
                textAlign: 'center',
                fontSize: '13px',
                fontWeight: 500,
                borderRadius: '6px',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background-color 0.15s ease, color 0.15s ease',
                color: '#fff',
                backgroundColor: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <Package className="w-3.5 h-3.5" />
              Track
            </SoundButton>
          )}
          {featureSettings.skuLookupEnabled && (
            <SoundButton
              data-onboarding="btn-sku"
              onClick={() => setShowSkuModal(true)}
              style={{
                flex: 1,
                margin: '0 2px',
                padding: '8px 0',
                textAlign: 'center',
                fontSize: '13px',
                fontWeight: 500,
                borderRadius: '6px',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background-color 0.15s ease, color 0.15s ease',
                color: '#fff',
                backgroundColor: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <Search className="w-3.5 h-3.5" />
              SKU
            </SoundButton>
          )}
          {featureSettings.notepadEnabled && (
            <SoundButton
              data-onboarding="btn-notes"
              onClick={() => setShowNotepadModal(true)}
              style={{
                flex: 1,
                margin: '0 2px',
                padding: '8px 0',
                textAlign: 'center',
                fontSize: '13px',
                fontWeight: 500,
                borderRadius: '6px',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background-color 0.15s ease, color 0.15s ease',
                color: '#fff',
                backgroundColor: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <FileText className="w-3.5 h-3.5" />
              Notes
            </SoundButton>
          )}
          {featureSettings.remindersEnabled && (
            <SoundButton
              data-onboarding="btn-remind"
              onClick={() => setShowRemindersModal(true)}
              style={{
                flex: 1,
                margin: '0 2px',
                padding: '8px 0',
                textAlign: 'center',
                fontSize: '13px',
                fontWeight: 500,
                borderRadius: '6px',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background-color 0.15s ease, color 0.15s ease',
                color: '#fff',
                backgroundColor: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                position: 'relative',
              }}
            >
              <Bell className="w-3.5 h-3.5" />
              Remind
              {overdueReminders > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-2px',
                    minWidth: '16px',
                    height: '16px',
                    borderRadius: '9999px',
                    backgroundColor: '#EF4444',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    lineHeight: 1,
                    boxShadow: '0 0 0 2px var(--bg-primary)',
                  }}
                >
                  {overdueReminders}
                </span>
              )}
            </SoundButton>
          )}
        </div>
      </div>

      {/* ═══ WIDGET BAR (bottom) ═══ */}
      {featureSettings.widgetBarEnabled && (
        <WidgetBar
          ticketElapsed={ticketElapsed}
          lastTicketId={lastTicketId}
        />
      )}

      {/* Modals */}
      {showSettings && (
        <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      )}
      {showTrackingModal && (
        <TrackingLookupModal isOpen={showTrackingModal} onClose={() => setShowTrackingModal(false)} />
      )}
      {showSkuModal && (
        <SkuLookupModal isOpen={showSkuModal} onClose={() => setShowSkuModal(false)} />
      )}
      {showNotepadModal && (
        <NotepadModal isOpen={showNotepadModal} onClose={() => setShowNotepadModal(false)} />
      )}
      {showRemindersModal && (
        <RemindersModal isOpen={showRemindersModal} onClose={() => setShowRemindersModal(false)} />
      )}
    </div>
  );
};

export default PopupApp;