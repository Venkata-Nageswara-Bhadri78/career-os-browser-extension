import { describe, expect, it } from "vitest";
import { createClickDiscriminator, DOUBLE_MS } from "../src/lib/clicks.js";

describe("click discriminator", () => {
  it("opens UI when two clicks arrive inside 350ms", () => {
    const timeouts = new Map();
    let nextId = 1;
    const disc = createClickDiscriminator({
      doubleMs: DOUBLE_MS,
      setTimeoutFn: (fn) => {
        const id = nextId++;
        timeouts.set(id, fn);
        return id;
      },
      clearTimeoutFn: (id) => {
        timeouts.delete(id);
      },
    });
    const calls = [];
    const handlers = {
      openUi: () => calls.push("openUi"),
      extract: () => calls.push("extract"),
    };
    expect(disc.onClicked(handlers)).toBe("scheduledExtract");
    expect(disc.onClicked(handlers)).toBe("openUi");
    expect(calls).toEqual(["openUi"]);
    expect(timeouts.size).toBe(0);
  });

  it("extracts after a single click timeout", () => {
    const timeouts = new Map();
    let nextId = 1;
    const disc = createClickDiscriminator({
      setTimeoutFn: (fn) => {
        const id = nextId++;
        timeouts.set(id, fn);
        return id;
      },
      clearTimeoutFn: (id) => {
        timeouts.delete(id);
      },
    });
    const calls = [];
    disc.onClicked({
      openUi: () => calls.push("openUi"),
      extract: () => calls.push("extract"),
    });
    [...timeouts.values()][0]();
    expect(calls).toEqual(["extract"]);
  });
});
