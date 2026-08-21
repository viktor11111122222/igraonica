import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// jsdom nema scrollIntoView, a Jelovnik njime skace na danasnji dan.
Element.prototype.scrollIntoView = vi.fn();

// Ni ResizeObserver - grafikon njime meri svoju sirinu pre crtanja.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom nema ni navigator.mediaDevices. QrScanner to gleda da bi razlikovao
// "pregledac ne da kameru" od "kamera je pukla pri pokretanju", pa bez ovoga
// svaki test skenera padne na prvoj proveri. Testovi koji bas gadjaju taj
// slucaj ga sami sklone.
beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn() },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});
