export const DOUBLE_MS = 350;

export function createClickDiscriminator({
  doubleMs = DOUBLE_MS,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  let timer = null;

  function reset() {
    if (timer != null) {
      clearTimeoutFn(timer);
      timer = null;
    }
  }

  function onClicked(handlers) {
    if (timer != null) {
      clearTimeoutFn(timer);
      timer = null;
      handlers.openUi();
      return "openUi";
    }
    timer = setTimeoutFn(() => {
      timer = null;
      handlers.extract();
    }, doubleMs);
    return "scheduledExtract";
  }

  return {
    onClicked,
    reset,
    isPending() {
      return timer != null;
    },
  };
}
