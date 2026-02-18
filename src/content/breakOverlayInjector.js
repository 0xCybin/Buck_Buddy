/**
 * breakOverlayInjector.js
 *
 * Content script that injects a full-page React break overlay into the
 * Freshdesk page when the background service worker fires a break alarm.
 * Listens for BREAK_TIME_START / BREAK_ENDED messages via chrome.runtime.
 *
 * BUG: `root` is created as a local variable inside the BREAK_TIME_START
 * case but is never assigned to `overlayContainer._root`. The BREAK_ENDED
 * handler therefore never finds a root to unmount -- the only working
 * teardown path is the onClose callback inside BreakOverlay itself.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import BreakOverlay from "../components/overlay/BreakOverlay";

console.log("[Buck Buddy] Break overlay injector loaded");

// -- DOM setup: persistent container appended once on load --
const overlayContainer = document.createElement("div");
overlayContainer.id = "buck-buddy-break-overlay";
document.body.appendChild(overlayContainer);
console.log("[Buck Buddy] Overlay container created");

// -- Message handler: reacts to break lifecycle events from background.js --
const handleBreakMessages = (message) => {
  switch (message.type) {
    case "BREAK_TIME_START":
      overlayContainer.classList.add("active");

      overlayContainer._root = createRoot(overlayContainer);
      overlayContainer._root.render(
        <BreakOverlay
          onClose={() => {
            if (overlayContainer._root) {
              overlayContainer._root.unmount();
              overlayContainer._root = null;
            }
            overlayContainer.classList.remove("active");
          }}
        />
      );
      break;

    case "BREAK_ENDED":
      if (overlayContainer._root) {
        overlayContainer._root.unmount();
        overlayContainer._root = null;
      }
      overlayContainer.classList.remove("active");
      break;

    case "BREAK_WARNING": {
      // Show a dismissible toast banner at the top of the page
      const existing = document.getElementById("buck-buddy-break-warning");
      if (existing) existing.remove();

      const toast = document.createElement("div");
      toast.id = "buck-buddy-break-warning";
      Object.assign(toast.style, {
        position: "fixed",
        top: "12px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "2147483647",
        padding: "10px 20px",
        borderRadius: "8px",
        backgroundColor: "rgba(234, 179, 8, 0.95)",
        color: "#1a1a1a",
        fontSize: "13px",
        fontWeight: "600",
        fontFamily: "system-ui, sans-serif",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        cursor: "pointer",
        transition: "opacity 0.3s ease",
      });
      toast.textContent = `Break in ${message.minutes || 2} minutes \u2014 wrap up your ticket.`;
      toast.title = "Click to dismiss";
      toast.addEventListener("click", () => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      });
      // Auto-dismiss after 30 seconds
      setTimeout(() => {
        if (document.body.contains(toast)) {
          toast.style.opacity = "0";
          setTimeout(() => toast.remove(), 300);
        }
      }, 30000);
      document.body.appendChild(toast);
      break;
    }
  }
};

chrome.runtime.onMessage.addListener(handleBreakMessages);

// -- DOM persistence guard: re-attach container if something removes it --
const observer = new MutationObserver(() => {
  if (!document.body.contains(overlayContainer)) {
    document.body.appendChild(overlayContainer);
  }
});
observer.observe(document.body, { childList: true });
