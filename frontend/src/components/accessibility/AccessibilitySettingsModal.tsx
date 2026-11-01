import React, { useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Type,
  Eye,
  Sliders,
  Play,
  Square,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useAccessibilitySettingsStore } from '@/stores/useAccessibilitySettingsStore';
import { Button } from '@/components/ui';

export const AccessibilitySettingsModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    setSettingsModalOpen,
    dyslexiaFont,
    toggleDyslexiaFont,
    highContrast,
    toggleHighContrast,
    textToSpeechEnabled,
    toggleTextToSpeech,
    speechRate,
    setSpeechRate,
    speechVolume,
    setSpeechVolume,
    isSpeaking,
    speak,
    stopSpeech,
    announcement,
  } = useAccessibilitySettingsStore();

  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isSettingsModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSettingsModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Focus the close button on open for keyboard navigators
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsModalOpen, setSettingsModalOpen]);

  if (!isSettingsModalOpen) return null;

  const handleTestSpeech = () => {
    speak('Welcome to the Inclusive AI Event Planner. Your accessibility preferences are actively configured.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="accessibility-settings-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      {/* Hidden Live Region for Screen Reader Announcements */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border-2 border-slate-200 focus:outline-none">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="accessibility-settings-title"
                className="text-lg font-bold text-slate-900"
              >
                Accessibility & Assistive Settings
              </h2>
              <p className="text-xs text-slate-500">
                Personalize your sensory, reading, and interaction preferences
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={() => setSettingsModalOpen(false)}
            aria-label="Close accessibility settings"
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors focus:ring-2 focus:ring-blue-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-5 space-y-6">
          {/* 1. High Contrast Mode Toggle */}
          <div className="flex items-start justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors">
            <div className="flex items-start space-x-3">
              <Eye className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <label
                  htmlFor="toggle-high-contrast"
                  className="font-semibold text-sm text-slate-900 cursor-pointer"
                >
                  High-Contrast Display Mode
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enhances borders, text contrast, and focused outlines to meet WCAG AAA standards.
                </p>
              </div>
            </div>
            <button
              id="toggle-high-contrast"
              type="button"
              role="switch"
              aria-checked={highContrast}
              onClick={toggleHighContrast}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                highContrast ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span className="sr-only">Toggle high-contrast mode</span>
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  highContrast ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 2. Dyslexia-Friendly Reading Font Toggle */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <Type className="w-5 h-5 text-purple-600 mt-0.5" />
                <div>
                  <label
                    htmlFor="toggle-dyslexia-font"
                    className="font-semibold text-sm text-slate-900 cursor-pointer"
                  >
                    Dyslexia-Friendly Reading Font
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Applies specialized letter shaping, wider character spacing, and enhanced line height.
                  </p>
                </div>
              </div>
              <button
                id="toggle-dyslexia-font"
                type="button"
                role="switch"
                aria-checked={dyslexiaFont}
                onClick={toggleDyslexiaFont}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-600 ${
                  dyslexiaFont ? 'bg-purple-600' : 'bg-slate-300'
                }`}
              >
                <span className="sr-only">Toggle dyslexia-friendly font</span>
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    dyslexiaFont ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Font Preview Snippet */}
            {dyslexiaFont && (
              <div className="mt-2 p-2.5 bg-purple-50 rounded-lg border border-purple-200 text-xs text-purple-900 font-medium">
                Preview: Event planning made clear, comfortable, and accessible for everyone.
              </div>
            )}
          </div>

          {/* 3. Text-to-Speech (TTS) Voice Guidance */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3.5">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                {textToSpeechEnabled ? (
                  <Volume2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                ) : (
                  <VolumeX className="w-5 h-5 text-slate-400 mt-0.5" />
                )}
                <div>
                  <label
                    htmlFor="toggle-tts"
                    className="font-semibold text-sm text-slate-900 cursor-pointer"
                  >
                    Text-to-Speech (TTS) Reader
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enables voice readouts of plans, routes, timeline alerts, and venue details.
                  </p>
                </div>
              </div>
              <button
                id="toggle-tts"
                type="button"
                role="switch"
                aria-checked={textToSpeechEnabled}
                onClick={toggleTextToSpeech}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                  textToSpeechEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span className="sr-only">Toggle text-to-speech</span>
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    textToSpeechEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {textToSpeechEnabled && (
              <div className="pt-2 border-t border-slate-200 space-y-3">
                {/* Speech Rate Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center space-x-1.5">
                      <Sliders className="w-3.5 h-3.5 text-slate-500" />
                      <span>Reading Speed</span>
                    </span>
                    <span>{speechRate}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.75"
                    step="0.25"
                    value={speechRate}
                    aria-label="Speech speed rate"
                    onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 mt-1.5"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>Slower (0.75x)</span>
                    <span>Normal (1.0x)</span>
                    <span>Faster (1.75x)</span>
                  </div>
                </div>

                {/* Speech Volume Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>Voice Volume</span>
                    <span>{Math.round(speechVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="1.0"
                    step="0.1"
                    value={speechVolume}
                    aria-label="Speech volume level"
                    onChange={(e) => setSpeechVolume(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 mt-1.5"
                  />
                </div>

                {/* Voice Testing Controls */}
                <div className="flex items-center space-x-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleTestSpeech}
                    className="text-xs flex items-center space-x-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Test Voice Readout</span>
                  </Button>
                  {isSpeaking && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={stopSpeech}
                      className="text-xs flex items-center space-x-1.5 border-rose-300 text-rose-800 hover:bg-rose-50"
                    >
                      <Square className="w-3.5 h-3.5 text-rose-600" />
                      <span>Stop</span>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-1 text-xs text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Preferences saved automatically</span>
          </div>
          <Button
            type="button"
            onClick={() => setSettingsModalOpen(false)}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-4 py-2"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

