import { describe, expect, it } from "vitest";
import {
  isDesktopMenuCommandBlockedDuringGesture,
  isRendererShortcutBlockedDuringGesture,
  type RendererShortcut,
} from "./gestureShortcutGuards";

describe("gesture shortcut guards", () => {
  it.each([
    { key: "z", primaryModifier: true, shiftKey: false, textEditing: false },
    { key: "y", primaryModifier: true, shiftKey: false, textEditing: false },
    { key: "s", primaryModifier: true, shiftKey: false, textEditing: false },
    { key: "d", primaryModifier: true, shiftKey: false, textEditing: false },
    { key: "k", primaryModifier: true, shiftKey: false, textEditing: false },
    { key: "n", primaryModifier: true, shiftKey: true, textEditing: false },
    { key: "x", primaryModifier: true, shiftKey: false, textEditing: false },
    { key: "v", primaryModifier: true, shiftKey: false, textEditing: false },
  ] satisfies RendererShortcut[])("blocks renderer shortcut $key", (shortcut) => {
    expect(isRendererShortcutBlockedDuringGesture(shortcut)).toBe(true);
  });

  it.each([
    { key: "z", primaryModifier: false, shiftKey: false, textEditing: false },
    { key: "c", primaryModifier: true, shiftKey: false, textEditing: false },
    { key: "x", primaryModifier: true, shiftKey: false, textEditing: true },
    { key: "v", primaryModifier: true, shiftKey: false, textEditing: true },
  ] satisfies RendererShortcut[])("allows non-conflicting renderer shortcut $key", (shortcut) => {
    expect(isRendererShortcutBlockedDuringGesture(shortcut)).toBe(false);
  });

  it.each([
    "project:new",
    "project:save",
    "project:open-recent",
    "project:import",
    "project:export-png",
    "project:export-json",
    "project:export-bundle",
    "edit:undo",
    "edit:redo",
    "edit:cut",
    "edit:paste",
    "edit:clear-selection",
    "edit:clear-layer",
    "edit:invert-layer",
  ] as const)("blocks desktop menu command %s", (id) => {
    expect(isDesktopMenuCommandBlockedDuringGesture({ id })).toBe(true);
  });

  it.each(["edit:copy", "view:toggle-grid", "view:toggle-colorized-patterns", "view:set-grid-size"] as const)(
    "allows desktop menu command %s",
    (id) => {
      expect(isDesktopMenuCommandBlockedDuringGesture({ id })).toBe(false);
    },
  );
});
