# Advanced Dither Pattern Editor Design

## Purpose

This document covers the advanced pattern authoring workspace: stepped parallelogram repeat cells, construction actions, constraints, side path construction, neighbor rules, and live repeated preview.

Basic swatches, library behavior, and rendering/export integration are covered separately in [pattern-swatches-library.md](pattern-swatches-library.md). Pattern gradients are covered separately in [pattern-gradient-followup.md](pattern-gradient-followup.md).

## Intent

The advanced editor should help artists create useful Playdate dither patterns without trying to exhaustively cover every possible wallpaper group or tiling. Pattern creation starts from an adjustable stepped parallelogram repeat cell, initially a square. The user adjusts bounds and side paths, then adds neighbor relationships such as slide, rotate, reflect, glide-reflect, or invert.

Every construction action can add or reevaluate constraints. The currently active constraints determine which actions remain available.

## Core Principles

- The base repeat cell is a stepped parallelogram.
- Angled side paths are part of pattern geometry, not an implementation detail.
- Neighbor relationships define how generated copies are placed.
- The editor should keep the generated repeated preview live.
- Invalid actions should be unavailable or visibly invalid.
- Pattern construction is separate from swatch sampling.
- The product should optimize for tractable, high-value construction actions rather than exhaustive mathematical coverage.

## Vocabulary

### Pattern Construction State

The current editable definition of a pattern: a stepped parallelogram repeat cell, neighbor relationships, generated-copy rules, and active constraints.

### Stepped Parallelogram Repeat Cell

A grid-cell repeat region whose opposite boundaries are matching stepped edge paths related by translation. Its broad lattice can be described by corner points and vectors, but its actual shape is determined by pixel-edge paths along its sides.

### Construction Action

An operation the user applies to the construction state, such as changing cell bounds, changing an edge path, sliding a neighbor, rotating a neighbor, reflecting a neighbor, or adding inversion.

Actions are filtered by the active constraints implied by the current cell shape, side paths, and existing neighbor relationships.

### Constraint

A rule that must stay true for the pattern to tile and for its construction actions to remain valid. Constraints can be created by geometry, side path construction, neighbor operations, or symmetry choices.

### Motif

The 1-bit marks the user draws inside the editor's editable region. The motif is the visual content that the construction state turns into a generated source pattern.

## Constraint-Driven Model

The primary authoring model is:

```text
stepped parallelogram repeat cell
  -> construction actions
      -> active constraints
          -> available next actions
      -> generated 1-bit source pattern
```

All advanced repetition patterns in this tool start from a stepped parallelogram repeat cell. The cell starts as a square. The user can adjust its bounds and side paths, then add or modify neighboring relationships by sliding, rotating, reflecting, glide-reflecting, or inverting generated copies.

Every action can add constraints or cause existing constraints to be reevaluated. For example:

- A square cell can make quarter-turn actions available.
- A non-square parallelogram can disable 90-degree rotation but still allow translation, sliding, and 180-degree relationships.
- A stepped side path can make only certain slide intervals valid.
- A reflected neighbor can require mirrored side-path compatibility.
- A rotated neighbor can constrain side length, side path, and rotation center behavior.

## Construction Versus Swatch Sampling

Pattern construction describes how the motif becomes a complete periodic source pattern:

- Adjust the stepped parallelogram bounds.
- Change a side path construction mode.
- Slide a neighboring copy by a valid primitive interval.
- Rotate a neighboring copy around a derived placement point.
- Reflect a neighboring copy across a compatible axis.
- Invert generated copies so checker-like alternation emerges.

Swatch sampling belongs to project swatches and only changes how an already-generated pattern is sampled. Swatch sampling never mutates the pattern construction state.

## Data Model

### Pattern Definition

```ts
interface DitherPatternDefinition {
  id: string;
  name: string;
  previewHue: number;
  construction: PatternConstructionState;
  motif: PatternMotif;
}
```

The generated pattern may be cached for preview and rendering, but the motif and construction state remain the source of truth.

### Pattern Construction State

```ts
interface PatternConstructionState {
  cell: SteppedParallelogramCell;
  neighborRules: NeighborRule[];
  constraints: ConstructionConstraint[];
}
```

`constraints` can be stored for inspectability, but should also be derivable from `cell` and `neighborRules` so the app can repair or migrate older projects.

### Pattern Geometry

```ts
interface PatternLattice {
  u: { x: number; y: number };
  v: { x: number; y: number };
}

type GridStep = "N" | "E" | "S" | "W";

interface SteppedEdgePath {
  start: { x: number; y: number };
  steps: GridStep[];
}

interface SteppedParallelogramCell {
  origin: { x: number; y: number };
  uEdge: SteppedEdgePath;
  vEdge: SteppedEdgePath;
}
```

Rectangular repeats are the simplest case:

```ts
{ u: { x: width, y: 0 }, v: { x: 0, y: height } }
```

Stepped parallelogram repeats use two integer vectors plus explicit side paths:

```ts
{ u: { x: 8, y: 0 }, v: { x: 3, y: 5 } }
```

The vectors describe the broad repeat lattice. The side paths describe how angled sides are built from pixel edges. Two repeat cells can have the same corners but different side paths, and those paths can change which slides, rotations, and reflections are valid.

### Pattern Motif

```ts
interface PatternMotif {
  bounds: { left: number; top: number; right: number; bottom: number };
  cells: Array<{ x: number; y: number; value: boolean }>;
}
```

Motif cells are 1-bit. Tools can expose black, white, toggle, erase-to-empty, and invert operations, but generated output should remain a boolean source pattern that current swatches resolve to black or white.

### Neighbor Rules And Constraints

```ts
type NeighborOperation = "translate" | "slide" | "rotate" | "reflect" | "glide-reflect";

interface NeighborRule {
  id: string;
  operation: NeighborOperation;
  direction: { x: number; y: number };
  interval?: number;
  rotation?: 0 | 90 | 180 | 270;
  reflectX?: boolean;
  reflectY?: boolean;
  invert: boolean;
}

type ConstructionConstraintType =
  | "opposite-edges-translate"
  | "side-path-repeat-period"
  | "valid-slide-intervals"
  | "requires-square-cell"
  | "requires-mirrored-side-path"
  | "requires-rotatable-side-path"
  | "requires-half-turn-compatible-boundary";

interface ConstructionConstraint {
  id: string;
  type: ConstructionConstraintType;
  source: string;
  satisfied: boolean;
  message?: string;
}

interface GeneratedCopyRule {
  rotation: 0 | 90 | 180 | 270;
  reflectX: boolean;
  reflectY: boolean;
  translate: { x: number; y: number };
  invert: boolean;
}
```

Neighbor rules compile to generated copy rules for preview and resolution.

## Stepped Edge Construction

Angled sides should be generated by an explicit edge construction algorithm or edited directly. The edge path is part of the saved pattern definition.

Useful edge construction modes include:

- Balanced/Bresenham-style steps.
- Horizontal-first stair steps.
- Vertical-first stair steps.
- Alternating steps.
- Mirrored or palindromic steps for actions that need reflection or rotation compatibility.
- Custom side path editing.

Side construction affects available construction operations:

- Translation needs opposite sides to be translated copies.
- Reflection needs mirrored side-path compatibility.
- Half-turn construction needs reversal compatibility across opposite sides.
- Quarter-turn construction needs square-compatible side lengths and compatible path rotation.
- Slide/offset rows need offsets that land on valid side-path repeat intervals.

## Quantized Slide Intervals

Alternate row and column slides are not arbitrary pixel offsets when the repeat cell has angled stepped sides. Valid slides are based on the primitive repeat interval of the relevant side vector.

For a side vector:

```text
u = (dx, dy)
g = gcd(abs(dx), abs(dy))
primitive = (dx / g, dy / g)
valid interval count = g
```

A slide is valid when it moves by an integer multiple of the primitive vector along that side:

```ts
validSlides = [
  0 * primitive,
  1 * primitive,
  ...,
  (g - 1) * primitive,
];
```

For example, a `1:3` angled side with a 9-pixel horizontal span has:

```text
u = (9, 3)
g = 3
primitive = (3, 1)
valid slides = 0, 1, or 2 primitive intervals
pixel offsets = (0, 0), (3, 1), (6, 2)
```

The UI should expose these as discrete interval choices, not a free numeric slider.

## Pattern Resolution

The advanced editor produces a source pattern resolver:

1. The sampled coordinate is reduced into the stepped parallelogram repeat cell.
2. Neighbor rules and generated-copy rules determine which motif cell is sampled.
3. Construction-level inversion may flip the generated value.
4. The resulting boolean pattern value is returned to the swatch resolver.

The current swatch resolver maps that boolean value directly to black or white.

## Authoring Experience

### New Pattern Flow

1. Start with a square stepped parallelogram repeat cell.
2. Adjust bounds, side paths, or size.
3. Add or modify neighbor rules such as slide, rotate, reflect, glide-reflect, or invert.
4. Reevaluate constraints and update the available actions.
5. Draw or edit motif pixels while the generated pattern updates live.
6. Save the generated pattern definition into the open project as a custom pattern.
7. Optionally create one or more swatches from the new pattern.

The first construction state is intentionally simple. Complexity emerges as the user adds relationships to neighboring repeats and the system constrains later choices.

### Pattern Editor

The pattern editor should feel like a focused extension of the existing pixel editor:

- Familiar pencil, eraser, fill, line, rectangle, ellipse, selection, move, copy, paste, and mirror-like gestures where they make sense.
- Editable motif region.
- Repeated preview around the motif in every direction.
- Overlay for tile boundaries, lattice vectors, edge pairings, symmetry axes, derived rotation centers, copy labels, and repeat boundaries.
- Toggleable overlays for raw pixels versus construction scaffolding.
- Immediate preview of the generated periodic pattern.
- Density and tile metadata visible as compact status information.

The user should be able to draw normally while construction constraints update around them. Geometry edits and neighbor edits should keep the repeated preview live.

### Construction Actions

Pattern creation should expose available actions based on the current construction state. Actions can be presented as buttons, menus, or contextual handles on neighboring repeats.

Actions include:

- Rectangular repeat.
- Stepped parallelogram repeat.
- Mirror repeat.
- Half-turn repeat.
- Quarter-turn square repeat.
- Offset rows or columns.
- Alternating inversion.
- Direct bitmap mask repeat.

Each action should show a tiny animated or static preview using square pixels. Grouping should be based on user-comprehensible construction behavior:

- Repeats only.
- Rotates.
- Reflects.
- Reflects and rotates.
- Glides.
- Alternates/inverts.

Advanced names such as wallpaper group labels can exist as secondary metadata where they are helpful, but the primary UI should describe what the artist will see.

### Construction Controls

As constraints allow, the user should be able to adjust:

- Size.
- Orientation.
- Lattice vectors.
- Stepped edge construction mode.
- Side path editing for advanced angled repeats.
- Motif bounds.
- Derived rotation center behavior where active constraints require it.
- Reflection axes.
- Row or column offset.
- Quantized slide interval where angled sides constrain valid offsets.
- Alternating inversion rules.

Invalid square-grid operations should be impossible or visibly invalid.

## Preview Modes

The pattern editor needs multiple preview scales:

- Motif only.
- Generated key repeat.
- Repeated field.
- Swatch preview size.
- In-canvas preview over the current artwork.

Preview should support both black/white output and colorized construction overlays, since color helps distinguish generated copies without changing final output.

## Validation Rules

The advanced editor should reject or repair:

- Empty or degenerate lattice vectors.
- Lattices with zero area.
- Invalid side paths.
- Broken opposite-edge translation.
- Slide intervals that do not match primitive side-vector intervals.
- Reflections with incompatible side paths.
- Rotations with incompatible cell geometry.
- Neighbor rules that create unresolved overlaps.
- Pattern definitions with missing IDs.

The user-facing UI should explain invalid pattern geometry visually rather than only with text.

## Open Questions

- Which construction actions are needed first for useful Playdate art?
- Which side path construction modes are worth exposing initially?
- Should custom side path editing be allowed immediately or added later?
- Which constraints should be visible as badges, warnings, or disabled controls?
- How large can a repeat cell be before preview/resolution feels too heavy?
- Should pattern editing support layers inside a motif, or only one binary motif surface?

## Success Criteria

The advanced editor succeeds when an artist can:

- Start from a square stepped parallelogram cell.
- Adjust its bounds and side paths.
- Add valid neighbor relationships.
- See constraints update available actions.
- Draw motif pixels while the repeated preview updates live.
- Save the generated pattern into the open project as a custom pattern.
