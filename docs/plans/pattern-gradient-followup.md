# Pattern Gradient Follow-Up Design

## Purpose

This document holds follow-up planning for pattern gradients. Gradients are intentionally separated from the basic swatches/library plan so the first swatch workflow can stay focused.

See [pattern-swatches-library.md](pattern-swatches-library.md) for core swatch behavior.

## Core Idea

A gradient is an ordered group of existing project swatches presented as a single interaction unit. It is not a pattern definition and not a special kind of swatch.

Under the hood, each gradient level is just a normal project swatch.

## Conceptual Data Model

A gradient needs:

- Stable ID.
- Ordered swatch IDs.
- Optional display metadata if we decide gradients should have names.

The active gradient can initially be editor UI state. It can become a saved project preference later if that proves useful.

## Workflow

Gradient selection should be fast enough to use while drawing:

- A dedicated gradient strip shows the active ordered swatch group.
- The strip can contain 2 to 16 levels.
- Each level previews its underlying project swatch.
- Clicking a level selects that swatch.
- Keyboard controls step to previous/next level.
- Jump controls select first/last level.
- A gradient menu switches among embedded project gradients.

The order is artist-defined. The UI should not assume the ramp is always light-to-dark, though built-in tonal ramps can use that convention.

## Shortcuts

Recommended shortcuts:

- `[` and `]`: previous/next level in the active gradient.
- `Shift+[`, `Shift+]`: first/last level.
- `Alt+[`, `Alt+]`: previous/next gradient.
- `D`: select the current/default gradient level, preserving the existing dither-oriented shortcut idea.

Keyboard stepping should never trigger while focus is inside text fields, dialogs, or numeric inputs.

## Creation

Gradient creation can happen through the same add/edit swatch modal or through a later dedicated gradient workflow.

Potential creation paths:

- Create a gradient from selected existing swatches.
- Add multiple swatches from a built-in gradient template.
- Create a gradient from newly added swatches.

## Deletion And References

If a swatch appears in one or more gradients and the user deletes that swatch, the app should warn the user and either:

- Remove the swatch from those gradients.
- Cancel the deletion.

More elaborate options, such as deleting the whole gradient or replacing the swatch with another, can be considered later.

## Open Questions

- Should active gradient selection persist in the project or stay as session/UI state?
- Should gradient creation live inside the add/edit swatch modal or in a dedicated workflow?
- Should gradients have names, or should they be identified visually like swatches?
- Should gradient templates create new swatches automatically, bind to existing swatches, or support both?
- Should deleting a swatch remove it from gradients by default or block deletion?

## Success Criteria

Gradient work succeeds when an artist can:

- Group existing swatches into an ordered ramp.
- Select a gradient level and paint with its underlying swatch.
- Step through levels from the keyboard while drawing.
- Use gradients for arbitrary ordered families, not only light-to-dark tone ramps.
