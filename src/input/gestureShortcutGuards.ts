import type { DesktopMenuCommand } from "../desktop/desktopApi";

export interface RendererShortcut {
  key: string;
  primaryModifier: boolean;
  shiftKey: boolean;
  textEditing: boolean;
}

const BLOCKED_DESKTOP_MENU_COMMANDS = new Set<DesktopMenuCommand["id"]>([
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
]);

export function isRendererShortcutBlockedDuringGesture(shortcut: RendererShortcut): boolean {
  if (!shortcut.primaryModifier) return false;
  if (shortcut.key === "z" || shortcut.key === "y" || shortcut.key === "s" || shortcut.key === "d") return true;
  if (shortcut.shiftKey && shortcut.key === "n") return true;
  return !shortcut.textEditing && (shortcut.key === "x" || shortcut.key === "v");
}

export function isDesktopMenuCommandBlockedDuringGesture(command: DesktopMenuCommand): boolean {
  return BLOCKED_DESKTOP_MENU_COMMANDS.has(command.id);
}
