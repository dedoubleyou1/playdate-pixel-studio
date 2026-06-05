# Pattern Swatches And Library Design

## Purpose

This document covers the everyday pattern system: pattern definitions, project swatches, swatch management, the pattern library, and how patterns resolve during painting, preview, export, and physical streaming.

Advanced pattern authoring and custom project patterns are covered separately in [advanced-dither-pattern-editor.md](advanced-dither-pattern-editor.md).
Pattern gradients are deferred follow-up work covered in [pattern-gradient-followup.md](pattern-gradient-followup.md).

## Core Ideas

- Patterns are reusable 1-bit definitions. The initial pattern library is app-provided.
- Swatches are the paintable project entries artists use with tools.
- A predefined pattern can exist in the app's pattern library without being loaded into the active swatch area.
- Multiple swatches can reference the same pattern with different sampling settings.
- Drawing tools continue to store palette/swatch indexes; pattern resolution happens late during preview/export/rendering.

## Scope

The initial swatches/library work should focus on app-provided predefined patterns and project swatches that reference them. Custom dither pattern authoring, project-embedded custom patterns, and gradient/ramp workflows are deferred follow-up work.

## Vocabulary

### Pattern

A reusable definition that describes a periodic 1-bit source pattern. The initial system should ship with a large app-provided library of predefined patterns. Future custom dither patterns can be created in the advanced editor and stored inside the open project.

### Project Swatch

A paintable palette entry in the current project. A pattern swatch references a pattern from the app library or, later, a custom pattern embedded in the project. It also supplies swatch sampling settings. Pattern swatches do not need user-editable names; their preview and position are the primary identifiers.

### Swatch Area

The active working set of swatches visible to the artist while painting. This is deliberately smaller than the full pattern library.

### Pattern Library

The browsable collection of reusable pattern definitions. Initially, this should be a large predefined library bundled with the app.

## Conceptual Data Model

### Project Data Requirements

For the initial swatch/library feature, predefined pattern definitions can live in the app and be referenced by stable IDs. Future custom dither patterns created with the advanced editor should be embedded in the project snapshot.

The project needs to track:

- Permanent solid entries or their stable system indexes.
- Project pattern swatches.

It does not need to copy every predefined app pattern into the project.

### Pattern Definition

The swatch/library system only needs pattern definitions to provide:

- Stable ID.
- Preview metadata.
- A way to resolve the pattern at an integer pixel coordinate.

For predefined app patterns, this can be static app data. Future custom patterns will add project-embedded definitions owned by the advanced editor.

### Pattern Swatch

A pattern swatch needs to store:

- Stable swatch ID.
- Palette index used by painted pixels.
- Referenced pattern ID.
- Sampling settings: x/y offset, 90-degree-interval rotation, and reflection.

Swatch sampling is distinct from pattern construction. It changes how one swatch samples an already-generated source pattern. It does not mutate the pattern definition and does not affect other swatches.

## Pattern Resolution

Pattern swatches resolve late, just like current dither palette entries:

1. A layer pixel stores a palette index.
2. Rendering asks the palette to resolve that index at world coordinate `(x, y)`.
3. Solid entries resolve to transparent, black, or white.
4. Pattern swatches apply swatch sampling to the coordinate.
5. The sampled coordinate is resolved through the referenced pattern definition.
6. The pattern value resolves directly to black or white.

This preserves the current architecture: brushes and fills do not need to know how a pattern works.

## Swatch Management

The swatch area has two kinds of entries:

- **Permanent solid entries**: transparent, black, and white. These are predefined system entries and cannot be added or removed.
- **Project pattern swatches**: user-managed paintable entries that reference app-provided patterns or future project-embedded custom patterns.

Pattern swatches should support:

- Add swatch through a single `+` button.
- Edit swatch through the same modal used for creation.
- Duplicate swatch.
- Remove swatch.

Swatches should be identified primarily by their preview and position, not user-editable names. Pattern definitions can have names for library display, but ordinary project swatches should stay lightweight.

Pattern swatches resolve to black and white for now. Alternate uses can be composed through layer masks rather than making every swatch carry foreground/background configuration.

Swatch order should remain stable for now. If manual reordering becomes important, add it later as UI-only ordering metadata rather than changing palette identity.

Removing a pattern swatch that is used by pixels should rasterize those pixels before deleting the swatch:

- Resolve each painted use of that swatch at its document coordinate across project pixel surfaces.
- Replace the swatch index with ordinary black or white pixel values.
- Preserve the visible artwork exactly for the current black/white pattern behavior.
- Offer cancel if the user does not want to rasterize and delete.

Because pattern swatches currently resolve only to black and white, rasterization is simpler and safer than asking the user to remap the deleted swatch to another palette entry.

Removing a swatch does not remove the referenced pattern. App-provided patterns remain available in the library; future custom project patterns can have their own cleanup flow.

### Add/Edit Swatch Modal

The swatch area should have one `+` button. Activating it opens a modal that can create a single pattern swatch. Opening an existing pattern swatch should use the same modal in edit mode.

The modal should support:

- Select a pattern from the pattern library.
- Edit an existing swatch's sampling offset, 90-degree-interval rotation, and reflection.

For the first version, pattern library browsing should live inside this add/edit modal rather than in a separate library dialog.

This keeps the main swatch UI simple while supporting single-swatch creation and existing-swatch edits through one surface.

## Pattern Library

The first version of the pattern library should include predefined app patterns. Future custom project patterns can appear alongside predefined patterns when that feature exists. Search, tags, and filtering can be added later if the library becomes large enough to need them.

Starter pattern families should include:

- Ordered checker densities.
- Bayer-like ordered dither structures.
- Horizontal, vertical, and diagonal hatches.
- Crosshatch families.
- Dots and stipple-like periodic textures.
- Brick, weave, scale, stair-step, and tile-like textures.
- Shadow and highlight ramps for common Playdate art use.
- Alternating inverted textures that exploit 1-bit contrast.

## Swatch Sampling Edits

Offset, 90-degree-interval rotation, and reflection exist at the swatch layer. These sampling settings are applied after the source pattern has been generated from its construction state.

Positive offsets should behave visually:

- Positive X moves the displayed pattern right.
- Positive Y moves the displayed pattern down.

## UI Shape

### Left Tools Panel

The existing tools panel can continue owning paint tools and active swatches. The swatches section should grow into:

- Solids.
- Pattern swatches.
- Add/edit buttons.

## Rendering And Export Requirements

Every output path must use the same resolver:

- Editor canvas.
- Layer thumbnails.
- Object thumbnails.
- Swatch previews.
- Project preview.
- PNG export.
- Bundle export.
- Physical Playdate preview.

Cache keys must include:

- Pattern ID and app-library pattern version.
- Future custom pattern definition/construction state.
- Swatch sampling settings.
- Colorized preview mode.

## Validation Rules

The app should reject or repair:

- Pattern definitions with missing IDs.
- Swatches referencing missing patterns.
- Duplicate swatch indexes.

## Success Criteria

The swatch/library system succeeds when an artist can:

- Add patterns from the library to project swatches.
- Paint with pattern swatches like ordinary colors.
- Create multiple swatches from the same pattern with different sampling settings.
- Export or preview on Playdate and see the same deterministic 1-bit result.
