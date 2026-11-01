import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AccessibilitySettingsState {
  dyslexiaFont: boolean;
  highContrast: boolean;
  textToSpeechEnabled: boolean;
  speechRate: number;
  speechPitch: number;
  speechVolume: number;
  isSpeaking: boolean;
  isPaused: boolean;
  announcement: string;
  isSettingsModalOpen: boolean;

  // Actions
  setSettingsModalOpen: (open: boolean) => void;
  toggleDyslexiaFont: () => void;
  toggleHighContrast: () => void;
  toggleTextToSpeech: () => void;
  setSpeechRate: (rate: number) => void;
  setSpeechPitch: (pitch: number) => void;
  setSpeechVolume: (volume: number) => void;
  speak: (text: string) => void;
  stopSpeech: () => void;
  pauseSpeech: () => void;
  resumeSpeech: () => void;
  announce: (message: string) => void;
  syncDOMClasses: () => void;
}

const applyDOMClasses = (dyslexia: boolean, highContrast: boolean) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (dyslexia) {
    root.classList.add('dyslexia-mode');
  } else {
    root.classList.remove('dyslexia-mode');
  }

  if (highContrast) {
    root.classList.add('high-contrast');
  } else {
    root.classList.remove('high-contrast');
  }
};

export const useAccessibilitySettingsStore = create<AccessibilitySettingsState>()(
  persist(
    (set, get) => ({
      dyslexiaFont: false,
      highContrast: false,
      textToSpeechEnabled: true,
      speechRate: 1.0,
      speechPitch: 1.0,
      speechVolume: 1.0,
      isSpeaking: false,
      isPaused: false,
      announcement: '',
      isSettingsModalOpen: false,

      setSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),

      toggleDyslexiaFont: () => {
        const next = !get().dyslexiaFont;
        set({ dyslexiaFont: next });
        applyDOMClasses(next, get().highContrast);
        get().announce(`Dyslexia-friendly reading mode ${next ? 'enabled' : 'disabled'}.`);
      },

      toggleHighContrast: () => {
        const next = !get().highContrast;
        set({ highContrast: next });
        applyDOMClasses(get().dyslexiaFont, next);
        get().announce(`High contrast display mode ${next ? 'enabled' : 'disabled'}.`);
      },

      toggleTextToSpeech: () => {
        const next = !get().textToSpeechEnabled;
        if (!next) {
          get().stopSpeech();
        }
        set({ textToSpeechEnabled: next });
        get().announce(`Text to speech ${next ? 'enabled' : 'disabled'}.`);
      },

      setSpeechRate: (rate) => set({ speechRate: rate }),
      setSpeechPitch: (pitch) => set({ speechPitch: pitch }),
      setSpeechVolume: (volume) => set({ speechVolume: volume }),

      speak: (text: string) => {
        if (!text || typeof window === 'undefined') return;
        const synth = window.speechSynthesis;
        if (!synth) {
          get().announce('Speech synthesis is not supported on this device.');
          return;
        }

        // Cancel any active utterance
        synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = get().speechRate;
        utterance.pitch = get().speechPitch;
        utterance.volume = get().speechVolume;

        utterance.onstart = () => {
          set({ isSpeaking: true, isPaused: false });
        };

        utterance.onend = () => {
          set({ isSpeaking: false, isPaused: false });
        };

        utterance.onerror = () => {
          set({ isSpeaking: false, isPaused: false });
        };

        synth.speak(utterance);
        get().announce('Reading text aloud.');
      },

      stopSpeech: () => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        set({ isSpeaking: false, isPaused: false });
        get().announce('Speech stopped.');
      },

      pauseSpeech: () => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.pause();
        }
        set({ isPaused: true });
        get().announce('Speech paused.');
      },

      resumeSpeech: () => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.resume();
        }
        set({ isPaused: false });
        get().announce('Speech resumed.');
      },

      announce: (message: string) => {
        set({ announcement: message });
      },

      syncDOMClasses: () => {
        applyDOMClasses(get().dyslexiaFont, get().highContrast);
      },
    }),
    {
      name: 'eventflow-accessibility-settings',
      partialize: (state) => ({
        dyslexiaFont: state.dyslexiaFont,
        highContrast: state.highContrast,
        textToSpeechEnabled: state.textToSpeechEnabled,
        speechRate: state.speechRate,
        speechPitch: state.speechPitch,
        speechVolume: state.speechVolume,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyDOMClasses(state.dyslexiaFont, state.highContrast);
        }
      },
    }
  )
);

