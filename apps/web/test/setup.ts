import '@testing-library/jest-dom/vitest';

// Radix primitives (Dialog, Select) probe a few browser APIs jsdom
// doesn't implement. Stubbing them is test-environment plumbing, not a
// behavior change - without these, mounting them throws in jsdom.
if (!window.HTMLElement.prototype.hasPointerCapture) {
  window.HTMLElement.prototype.hasPointerCapture = () => false;
}
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}
if (!window.HTMLElement.prototype.releasePointerCapture) {
  window.HTMLElement.prototype.releasePointerCapture = () => {};
}
if (!window.HTMLElement.prototype.setPointerCapture) {
  window.HTMLElement.prototype.setPointerCapture = () => {};
}
if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
// jsdom has no PointerEvent constructor at all, which makes
// userEvent's pointer interactions (used to open a Radix Select) hang
// indefinitely rather than fail loudly. Polyfilling it on top of
// MouseEvent is the standard workaround for this combination.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    public pointerId: number;
    public pointerType: string;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? 'mouse';
    }
  }
  // @ts-expect-error - partial polyfill, sufficient for Radix's usage
  window.PointerEvent = PointerEvent;
}
