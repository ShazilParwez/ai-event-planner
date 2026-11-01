import '@testing-library/jest-dom';

// Mock Web Speech API for JSDOM
if (typeof window !== 'undefined') {
  window.SpeechSynthesisUtterance = class {
    text: string;
    rate = 1.0;
    pitch = 1.0;
    volume = 1.0;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  } as any;

  window.speechSynthesis = {
    speak: (utterance: any) => {
      if (utterance && utterance.onstart) utterance.onstart();
      if (utterance && utterance.onend) utterance.onend();
    },
    cancel: () => {},
    pause: () => {},
    resume: () => {},
    getVoices: () => [],
    speaking: false,
    paused: false,
    pending: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  } as any;
}
