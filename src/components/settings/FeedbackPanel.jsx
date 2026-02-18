// src/components/settings/FeedbackPanel.jsx
// Feedback launcher panel. Each category opens a pre-filled mailto link
// via chrome.tabs.create, directing users to report bugs, request features,
// or send general feedback.

import React from "react";
import { Bug, Lightbulb, MessageCircle } from "lucide-react";
import SoundButton from "../common/SoundButton";

const FEEDBACK_EMAIL = "JohnEvans@gamestop.com";

// Each category defines the email subject and a pre-filled body template
const categories = [
  {
    id: "bug",
    icon: Bug,
    title: "Bug Report",
    description: "Found something broken? Let us know so we can squash it.",
    subject: "[Buck Buddy - Bug Report]",
    body: [
      "Hi Buck Buddy Team,",
      "",
      "I found a bug:",
      "",
      "What happened:",
      "(describe the issue)",
      "",
      "Steps to reproduce:",
      "1. ",
      "2. ",
      "3. ",
      "",
      "What I expected to happen:",
      "(describe expected behavior)",
      "",
      "Extension version: (check Settings > Credits)",
      "Browser: Chrome",
    ].join("\n"),
  },
  {
    id: "feature",
    icon: Lightbulb,
    title: "Feature Request",
    description: "Got an idea to make Buck Buddy better? We'd love to hear it.",
    subject: "[Buck Buddy - Feature Request]",
    body: [
      "Hi Buck Buddy Team,",
      "",
      "I have a feature idea:",
      "",
      "Description:",
      "(describe your idea)",
      "",
      "Why it would be useful:",
      "(how would this help your workflow?)",
      "",
      "Any additional context:",
      "",
    ].join("\n"),
  },
  {
    id: "general",
    icon: MessageCircle,
    title: "General Feedback",
    description: "Anything else on your mind? We're all ears.",
    subject: "[Buck Buddy - Feedback]",
    body: [
      "Hi Buck Buddy Team,",
      "",
      "I wanted to share some feedback:",
      "",
      "(write your feedback here)",
      "",
    ].join("\n"),
  },
];

const FeedbackPanel = () => {
  // Construct mailto URL and open it in a new browser tab
  const handleCategoryClick = (category) => {
    const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(category.subject)}&body=${encodeURIComponent(category.body)}`;
    chrome.tabs.create({ url: mailto });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
          Bugs & Feedback
        </h3>
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          Let us know how we can make Buck Buddy better!
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {categories.slice(0, 2).map((cat) => (
          <SoundButton
            key={cat.id}
            onClick={() => handleCategoryClick(cat)}
            className="flex flex-col items-start gap-2 p-4 rounded-lg text-left transition-colors"
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-primary)",
            }}
          >
            <cat.icon className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
            <div>
              <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {cat.title}
              </h4>
              <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                {cat.description}
              </p>
            </div>
          </SoundButton>
        ))}
      </div>

      <SoundButton
        onClick={() => handleCategoryClick(categories[2])}
        className="flex items-start gap-3 w-full p-4 rounded-lg text-left transition-colors"
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <MessageCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--brand-primary)" }} />
        <div>
          <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {categories[2].title}
          </h4>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            {categories[2].description}
          </p>
        </div>
      </SoundButton>
    </div>
  );
};

export default FeedbackPanel;
