# Playdate Pixel Studio Architecture

## Stack

- Vite 8, React 19, and TypeScript for the app shell.
- Zustand for editor session state.
- Plain TypeScript domain modules for pixels, layers, commands, project schemas, and exports.
- Canvas 2D for the editor surface and Playdate preview rendering.
- Radix/shadcn-style local UI primitives for buttons, dialogs, sliders, switches, labels, and tooltips.
- Dexie/IndexedDB for local project persistence.
- Vitest, ESLint, and Prettier for guardrails.

## Boundaries

- `src/domain`: Framework-free editor model, dimension-aware pixel surfaces, typed layers, and pixel operations.
- `src/rendering`: DOM-free frame flattening plus Canvas compositing, thumbnails, and editor preview rendering.
- `src/state`: Zustand orchestration and command history.
- `src/persistence`: Versioned project schema and local database.
- `src/export`: Playdate-oriented PNG, metadata, and bundle exports.
- `src/companion`: Physical preview frame packing, wire protocol helpers, and Electron stream client.
- `src/components`: React UI shell and reusable UI primitives.
- `src/hooks`: Browser/editor services such as canvas input and autosave.
- `companion/stream`: Local Node TCP stream service that receives Electron IPC frames and streams the newest packet to Playdate.
- `companion/playdate-preview`: Playdate SDK companion app source, with Lua networking/UI and a native C bitmap update helper.

## Undo and Redo

Document mutations are represented as commands with immutable `before` and `after` snapshots. Drawing tools capture a command at pointer down and commit it at pointer up. Layer, object, and project actions use the same command boundary. This keeps future operations such as selection transforms, paste, tile edits, and animation frame edits on one undo model.

## Persistence

Projects are stored locally in IndexedDB using a versioned Playdate project document. Layer pixel buffers are serialized as base64 so the same schema can be used for database storage, JSON import/export, and zipped project bundles. Schema v2 stores a root Playdate artboard, arbitrary-sized reusable object definitions, and linked object instance layers. Autosave is debounced at the app layer so command execution stays independent of persistence.

## Rendering

The editor canvas renders through a requestAnimationFrame scheduler. Domain pixel buffers remain 1-bit per pixel layer, and preview/export paths flatten the root artboard into true Playdate-sized 400 x 240 outputs. Object definitions render as linked object instance layers when they are placed on the root artboard. Preview modes are post-processing passes over device image data.

Editor invalidation separates document changes from view-only changes. `documentRevision` advances when saved project data changes and drives autosave plus physical streaming; `viewRevision` advances when the editor display should repaint, including transient previews and grid changes. Per-layer `contentRevision` remains the cache key for thumbnails and other content-derived previews.

## Physical Preview

Physical preview is intentionally experimental and local-first. The Electron renderer packs the visible layer stack into a fixed 12,000-byte, MSB-first, 1-bit Playdate frame using native Playdate bitmap polarity, where set bits are white and cleared bits are black. Electron main owns the TCP stream service, keeps only the newest frame in memory, exposes stream health/info/device/frame operations over IPC, and streams binary packets to any connected companion apps over LAN TCP. The Playdate app validates packet shape and CRC before a C extension copies payload rows into an `LCDBitmap`.

## Extension Points

- Add new tools by implementing pure domain operations and committing them as document commands.
- Add new exports in `src/export` without touching React UI internals.
- Improve physical preview by adding delta frames, animation frame streaming, or HTTP polling behind the same packet format.
- Move expensive rendering/export work into a worker by preserving the current domain/rendering boundary.
- Add cloud sync by swapping persistence adapters while preserving the project schema.
