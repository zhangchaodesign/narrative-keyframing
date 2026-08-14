"use client";

import { useState } from "react";
import { useApiKeyStore } from "@/lib/stores/apiKeyStore";

/**
 * Full-screen entry panel shown before an OpenAI API key has been provided.
 * The key is stored client-side (localStorage) and sent with each AI request;
 * it never touches the server's environment config.
 */
export function ApiKeyEntryPanel() {
  const [keyInput, setKeyInput] = useState("");
  const setApiKey = useApiKeyStore((state) => state.setApiKey);

  const canStart = keyInput.trim() !== "";

  const handleStart = () => {
    if (!canStart) return;
    setApiKey(keyInput.trim());
  };

  return (
    <div className="landing-page tool-gate-page">
      <div className="tool-gate-card">
        <div className="tool-gate-form">
          <h1 className="tool-gate-title">
            <em>Welcome!</em>
          </h1>
          <p className="tool-gate-description">
            Enter your OpenAI API key to start using the tool. It&apos;s stored
            only in your browser and sent directly with your requests.
          </p>

          <div className="tool-gate-field">
            <label className="tool-gate-label">OpenAI API Key</label>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleStart();
              }}
              placeholder="sk-..."
              className="tool-gate-input"
              autoFocus
            />
            <p className="tool-gate-hint">
              Get a key from{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
              >
                platform.openai.com/api-keys
              </a>
              .
            </p>
          </div>

          <button
            onClick={handleStart}
            disabled={!canStart}
            className="tool-gate-button"
          >
            Start
          </button>
        </div>

        <section
          className="tool-gate-tutorial"
          aria-labelledby="tutorial-title"
        >
          <div className="tool-gate-tutorial-heading">
            <span>Tutorial</span>
            <div>
              <h2 id="tutorial-title">See Narrative Keyframing in action</h2>
              <p>Watch the walkthrough to learn how to use the tool.</p>
            </div>
          </div>
          <div className="tool-gate-video">
            <iframe
              src="https://www.youtube.com/embed/as-Gz14iRLY"
              title="Narrative Keyframing tutorial"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Small toolbar control to update or clear the stored OpenAI API key.
 */
export function ChangeApiKeyButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const setApiKey = useApiKeyStore((state) => state.setApiKey);
  const clearApiKey = useApiKeyStore((state) => state.clearApiKey);

  const openModal = () => {
    setKeyInput("");
    setIsOpen(true);
  };

  const handleSave = () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    setIsOpen(false);
  };

  const handleClear = () => {
    clearApiKey();
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={openModal}
        className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
      >
        API Key
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-100000 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Update API Key
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Enter a new OpenAI API key, or clear the stored key to sign out.
            </p>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              placeholder="sk-..."
              className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-shadow"
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={!keyInput.trim()}
              className={`w-full mt-4 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                keyInput.trim()
                  ? "bg-gray-900 text-white hover:bg-gray-700 cursor-pointer shadow-sm hover:shadow"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Save
            </button>
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={handleClear}
                className="text-sm text-red-500 hover:text-red-600 transition-colors"
              >
                Clear key
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
