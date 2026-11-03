import { flushSync } from 'react-dom';

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** Runs a state change inside a view transition when the browser supports it. */
export function transition(update: () => void): void {
  type Started = { ready?: Promise<unknown>; finished?: Promise<unknown>; updateCallbackDone?: Promise<unknown> };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => Started };
  if (typeof doc.startViewTransition === 'function' && !reducedMotion()) {
    const started = doc.startViewTransition(() => flushSync(update));
    const ignore = () => undefined;
    started?.ready?.catch(ignore);
    started?.finished?.catch(ignore);
    started?.updateCallbackDone?.catch(ignore);
  } else {
    update();
  }
}

/** Waits for an animation to play; resolves immediately when motion is reduced. */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : ms));
}
