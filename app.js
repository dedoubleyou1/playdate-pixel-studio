const WIDTH = 400;
const HEIGHT = 240;
const PIXELS = WIDTH * HEIGHT;
const MAX_HISTORY = 48;

const canvas = document.querySelector("#artCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const previewCanvas = document.querySelector("#previewCanvas");
const previewCtx = previewCanvas.getContext("2d");
const canvasWrap = document.querySelector("#canvasWrap");
const layerList = document.querySelector("#layerList");

const ui = {
  toolGrid: document.querySelector("#toolGrid"),
  brushSize: document.querySelector("#brushSize"),
  brushSizeValue: document.querySelector("#brushSizeValue"),
  zoomLevel: document.querySelector("#zoomLevel"),
  zoomValue: document.querySelector("#zoomValue"),
  gridToggle: document.querySelector("#gridToggle"),
  mirrorX: document.querySelector("#mirrorX"),
  mirrorY: document.querySelector("#mirrorY"),
  activeLayerName: document.querySelector("#activeLayerName"),
  statusText: document.querySelector("#statusText"),
  cursorReadout: document.querySelector("#cursorReadout"),
  addLayerBtn: document.querySelector("#addLayerBtn"),
  duplicateLayerBtn: document.querySelector("#duplicateLayerBtn"),
  deleteLayerBtn: document.querySelector("#deleteLayerBtn"),
  moveLayerUpBtn: document.querySelector("#moveLayerUpBtn"),
  moveLayerDownBtn: document.querySelector("#moveLayerDownBtn"),
  layerOpacity: document.querySelector("#layerOpacity"),
  layerOpacityValue: document.querySelector("#layerOpacityValue"),
  undoBtn: document.querySelector("#undoBtn"),
  redoBtn: document.querySelector("#redoBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  previewBtn: document.querySelector("#previewBtn"),
  previewOverlay: document.querySelector("#previewOverlay"),
  closePreviewBtn: document.querySelector("#closePreviewBtn"),
};

let nextLayerId = 1;
let layers = [makeLayer("Layer 1")];
let activeLayerIndex = 0;
let activeTool = "pencil";
let brushSize = 1;
let isDrawing = false;
let dragStart = null;
let tempShape = null;
let actionChanged = false;
let history = [];
let future = [];

function makeLayer(name) {
  return {
    id: nextLayerId++,
    name,
    visible: true,
    locked: false,
    opacity: 100,
    data: new Uint8Array(PIXELS),
  };
}

function activeLayer() {
  return layers[activeLayerIndex];
}

function layerSnapshot() {
  return {
    nextLayerId,
    activeLayerIndex,
    layers: layers.map((layer) => ({
      ...layer,
      data: new Uint8Array(layer.data),
    })),
  };
}

function restoreSnapshot(snapshot) {
  nextLayerId = snapshot.nextLayerId;
  activeLayerIndex = snapshot.activeLayerIndex;
  layers = snapshot.layers.map((layer) => ({
    ...layer,
    data: new Uint8Array(layer.data),
  }));
  clampActiveLayer();
  renderEverything();
}

function pushHistory() {
  history.push(layerSnapshot());
  if (history.length > MAX_HISTORY) {
    history.shift();
  }
  future = [];
  updateHistoryButtons();
}

function updateHistoryButtons() {
  ui.undoBtn.disabled = history.length <= 1;
  ui.redoBtn.disabled = future.length === 0;
}

function undo() {
  if (history.length <= 1) return;
  future.push(history.pop());
  restoreSnapshot(history[history.length - 1]);
  updateHistoryButtons();
  setStatus("Undo");
}

function redo() {
  if (!future.length) return;
  const snapshot = future.pop();
  history.push(snapshot);
  restoreSnapshot(snapshot);
  updateHistoryButtons();
  setStatus("Redo");
}

function clampActiveLayer() {
  activeLayerIndex = Math.max(0, Math.min(activeLayerIndex, layers.length - 1));
}

function indexFor(x, y) {
  return y * WIDTH + x;
}

function inBounds(x, y) {
  return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT;
}

function mirroredPoints(x, y) {
  const points = [[x, y]];
  if (ui.mirrorX.checked) points.push([WIDTH - 1 - x, y]);
  if (ui.mirrorY.checked) points.push([x, HEIGHT - 1 - y]);
  if (ui.mirrorX.checked && ui.mirrorY.checked) {
    points.push([WIDTH - 1 - x, HEIGHT - 1 - y]);
  }
  const seen = new Set();
  return points.filter(([px, py]) => {
    const key = `${px},${py}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function setPixel(layer, x, y, value) {
  if (!inBounds(x, y)) return false;
  const i = indexFor(x, y);
  if (layer.data[i] === value) return false;
  layer.data[i] = value;
  return true;
}

function drawBrushAt(layer, x, y, mode) {
  const half = Math.floor(brushSize / 2);
  let changed = false;
  for (const [mx, my] of mirroredPoints(x, y)) {
    for (let yy = 0; yy < brushSize; yy += 1) {
      for (let xx = 0; xx < brushSize; xx += 1) {
        const px = mx + xx - half;
        const py = my + yy - half;
        let value = mode === "eraser" ? 0 : 1;
        if (mode === "dither") {
          value = (px + py) % 2 === 0 ? 1 : 0;
        }
        changed = setPixel(layer, px, py, value) || changed;
      }
    }
  }
  return changed;
}

function walkLine(x0, y0, x1, y1, callback) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    callback(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function drawLine(layer, start, end, mode = "pencil") {
  let changed = false;
  walkLine(start.x, start.y, end.x, end.y, (x, y) => {
    changed = drawBrushAt(layer, x, y, mode) || changed;
  });
  return changed;
}

function drawRect(layer, start, end, mode = "pencil") {
  let changed = false;
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);

  for (let x = left; x <= right; x += 1) {
    changed = drawBrushAt(layer, x, top, mode) || changed;
    changed = drawBrushAt(layer, x, bottom, mode) || changed;
  }
  for (let y = top; y <= bottom; y += 1) {
    changed = drawBrushAt(layer, left, y, mode) || changed;
    changed = drawBrushAt(layer, right, y, mode) || changed;
  }
  return changed;
}

function floodFill(layer, x, y, value) {
  if (!inBounds(x, y)) return false;
  const startIndex = indexFor(x, y);
  const target = layer.data[startIndex];
  if (target === value) return false;

  const stack = [[x, y]];
  let changed = false;

  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (!inBounds(cx, cy)) continue;
    const i = indexFor(cx, cy);
    if (layer.data[i] !== target) continue;
    layer.data[i] = value;
    changed = true;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }

  return changed;
}

function composeImage({ device = false } = {}) {
  const image = ctx.createImageData(WIDTH, HEIGHT);
  const pixels = image.data;

  for (let i = 0; i < PIXELS; i += 1) {
    let shade = 255;
    for (const layer of layers) {
      if (!layer.visible || layer.data[i] === 0) continue;
      const alpha = Math.max(0, Math.min(1, layer.opacity / 100));
      shade = Math.round(shade * (1 - alpha));
    }
    const output = device ? (shade < 224 ? 0 : 255) : shade;
    const p = i * 4;
    pixels[p] = output;
    pixels[p + 1] = output;
    pixels[p + 2] = output;
    pixels[p + 3] = 255;
  }

  return image;
}

function renderCanvas() {
  ctx.putImageData(composeImage(), 0, 0);
  if (tempShape) {
    ctx.save();
    ctx.fillStyle = "rgba(40, 87, 184, 0.78)";
    const half = Math.floor(brushSize / 2);
    const plot = (x, y) => {
      for (const [mx, my] of mirroredPoints(x, y)) {
        for (let yy = 0; yy < brushSize; yy += 1) {
          for (let xx = 0; xx < brushSize; xx += 1) {
            const px = mx + xx - half;
            const py = my + yy - half;
            if (inBounds(px, py)) ctx.fillRect(px, py, 1, 1);
          }
        }
      }
    };
    if (tempShape.type === "line") {
      walkLine(tempShape.start.x, tempShape.start.y, tempShape.end.x, tempShape.end.y, plot);
    }
    if (tempShape.type === "rect") {
      const left = Math.min(tempShape.start.x, tempShape.end.x);
      const right = Math.max(tempShape.start.x, tempShape.end.x);
      const top = Math.min(tempShape.start.y, tempShape.end.y);
      const bottom = Math.max(tempShape.start.y, tempShape.end.y);
      for (let x = left; x <= right; x += 1) {
        plot(x, top);
        plot(x, bottom);
      }
      for (let y = top; y <= bottom; y += 1) {
        plot(left, y);
        plot(right, y);
      }
    }
    ctx.restore();
  }
}

function renderPreview() {
  previewCtx.putImageData(composeImage({ device: true }), 0, 0);
}

function renderLayerList() {
  layerList.innerHTML = "";
  layers
    .map((layer, index) => ({ layer, index }))
    .reverse()
    .forEach(({ layer, index }) => {
      const item = document.createElement("div");
      item.className = `layer-item${index === activeLayerIndex ? " is-active" : ""}`;
      item.dataset.index = index;

      const thumb = document.createElement("canvas");
      thumb.className = "layer-thumb";
      thumb.width = WIDTH;
      thumb.height = HEIGHT;
      renderLayerThumb(thumb, layer);

      const name = document.createElement("input");
      name.className = "layer-name";
      name.value = layer.name;
      name.ariaLabel = "Layer name";
      name.addEventListener("change", () => {
        layer.name = name.value.trim() || `Layer ${index + 1}`;
        renderInterface();
        pushHistory();
      });
      name.addEventListener("click", (event) => event.stopPropagation());

      const visible = document.createElement("button");
      visible.className = `layer-toggle${layer.visible ? "" : " is-off"}`;
      visible.title = layer.visible ? "Hide layer" : "Show layer";
      visible.textContent = layer.visible ? "V" : "-";
      visible.addEventListener("click", (event) => {
        event.stopPropagation();
        layer.visible = !layer.visible;
        renderEverything();
        pushHistory();
      });

      const locked = document.createElement("button");
      locked.className = `layer-toggle${layer.locked ? " is-locked" : ""}`;
      locked.title = layer.locked ? "Unlock layer" : "Lock layer";
      locked.textContent = layer.locked ? "L" : "U";
      locked.addEventListener("click", (event) => {
        event.stopPropagation();
        layer.locked = !layer.locked;
        renderInterface();
        pushHistory();
      });

      item.append(thumb, name, visible, locked);
      item.addEventListener("click", () => {
        activeLayerIndex = index;
        renderInterface();
      });
      layerList.append(item);
    });
}

function renderLayerThumb(thumb, layer) {
  const thumbCtx = thumb.getContext("2d");
  const image = thumbCtx.createImageData(WIDTH, HEIGHT);
  const pixels = image.data;
  for (let i = 0; i < PIXELS; i += 1) {
    const p = i * 4;
    const value = layer.data[i] ? 0 : 255;
    pixels[p] = value;
    pixels[p + 1] = value;
    pixels[p + 2] = value;
    pixels[p + 3] = layer.data[i] ? 255 : 0;
  }
  thumbCtx.clearRect(0, 0, WIDTH, HEIGHT);
  thumbCtx.putImageData(image, 0, 0);
}

function renderInterface() {
  const layer = activeLayer();
  ui.activeLayerName.textContent = layer.name;
  ui.layerOpacity.value = String(layer.opacity);
  ui.layerOpacityValue.textContent = `${layer.opacity}%`;
  ui.deleteLayerBtn.disabled = layers.length <= 1;
  ui.moveLayerUpBtn.disabled = activeLayerIndex >= layers.length - 1;
  ui.moveLayerDownBtn.disabled = activeLayerIndex <= 0;
  renderLayerList();
  updateHistoryButtons();
}

function renderEverything() {
  renderCanvas();
  renderPreview();
  renderInterface();
}

function setTool(tool) {
  activeTool = tool;
  document.querySelectorAll(".tool-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tool === tool);
  });
  setStatus(`${tool[0].toUpperCase()}${tool.slice(1)} ready`);
}

function setStatus(message) {
  ui.statusText.textContent = message;
}

function pointerToPixel(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(WIDTH - 1, Math.floor(((event.clientX - rect.left) / rect.width) * WIDTH))),
    y: Math.max(0, Math.min(HEIGHT - 1, Math.floor(((event.clientY - rect.top) / rect.height) * HEIGHT))),
  };
}

function canEditActiveLayer() {
  const layer = activeLayer();
  if (layer.locked) {
    setStatus("Active layer is locked");
    return false;
  }
  return true;
}

function beginStroke(event) {
  if (!canEditActiveLayer()) return;
  canvas.setPointerCapture(event.pointerId);
  const point = pointerToPixel(event);
  const layer = activeLayer();
  isDrawing = true;
  dragStart = point;
  actionChanged = false;

  if (activeTool === "pencil" || activeTool === "eraser" || activeTool === "dither") {
    actionChanged = drawBrushAt(layer, point.x, point.y, activeTool);
    renderCanvas();
  }

  if (activeTool === "fill") {
    actionChanged = floodFill(layer, point.x, point.y, 1);
    isDrawing = false;
    if (actionChanged) {
      renderEverything();
      pushHistory();
    }
  }

  if (activeTool === "line" || activeTool === "rect") {
    tempShape = { type: activeTool, start: point, end: point };
    renderCanvas();
  }
}

function continueStroke(event) {
  const point = pointerToPixel(event);
  ui.cursorReadout.textContent = `x: ${point.x} y: ${point.y}`;
  if (!isDrawing) return;

  const layer = activeLayer();
  if (activeTool === "pencil" || activeTool === "eraser" || activeTool === "dither") {
    actionChanged = drawBrushAt(layer, point.x, point.y, activeTool) || actionChanged;
    renderCanvas();
  }

  if (tempShape) {
    tempShape.end = point;
    renderCanvas();
  }
}

function finishStroke(event) {
  if (!isDrawing) return;
  const point = pointerToPixel(event);
  const layer = activeLayer();

  if (activeTool === "line") {
    actionChanged = drawLine(layer, dragStart, point, "pencil");
  }
  if (activeTool === "rect") {
    actionChanged = drawRect(layer, dragStart, point, "pencil");
  }

  isDrawing = false;
  dragStart = null;
  tempShape = null;

  if (actionChanged) {
    renderEverything();
    pushHistory();
  } else {
    renderCanvas();
  }
}

function addLayer() {
  const layer = makeLayer(`Layer ${layers.length + 1}`);
  layers.splice(activeLayerIndex + 1, 0, layer);
  activeLayerIndex += 1;
  renderEverything();
  pushHistory();
  setStatus("Layer added");
}

function duplicateLayer() {
  const source = activeLayer();
  const layer = makeLayer(`${source.name} copy`);
  layer.data = new Uint8Array(source.data);
  layer.opacity = source.opacity;
  layers.splice(activeLayerIndex + 1, 0, layer);
  activeLayerIndex += 1;
  renderEverything();
  pushHistory();
  setStatus("Layer duplicated");
}

function deleteLayer() {
  if (layers.length <= 1) return;
  layers.splice(activeLayerIndex, 1);
  clampActiveLayer();
  renderEverything();
  pushHistory();
  setStatus("Layer deleted");
}

function moveLayer(direction) {
  const target = activeLayerIndex + direction;
  if (target < 0 || target >= layers.length) return;
  const [layer] = layers.splice(activeLayerIndex, 1);
  layers.splice(target, 0, layer);
  activeLayerIndex = target;
  renderEverything();
  pushHistory();
}

function setLayerOpacity(value) {
  const layer = activeLayer();
  layer.opacity = Number(value);
  ui.layerOpacityValue.textContent = `${layer.opacity}%`;
  renderEverything();
}

function exportPng() {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = WIDTH;
  exportCanvas.height = HEIGHT;
  const exportCtx = exportCanvas.getContext("2d");
  exportCtx.putImageData(composeImage({ device: true }), 0, 0);
  const link = document.createElement("a");
  link.download = "playdate-pixel-art.png";
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
  setStatus("PNG exported");
}

function showPreview() {
  renderPreview();
  ui.previewOverlay.hidden = false;
}

function hidePreview() {
  ui.previewOverlay.hidden = true;
}

function bindEvents() {
  ui.toolGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tool]");
    if (!button) return;
    setTool(button.dataset.tool);
  });

  ui.brushSize.addEventListener("input", () => {
    brushSize = Number(ui.brushSize.value);
    ui.brushSizeValue.textContent = String(brushSize);
  });

  ui.zoomLevel.addEventListener("input", () => {
    const zoom = ui.zoomLevel.value;
    document.documentElement.style.setProperty("--zoom", zoom);
    ui.zoomValue.textContent = `${zoom}x`;
  });

  ui.gridToggle.addEventListener("change", () => {
    canvasWrap.classList.toggle("has-grid", ui.gridToggle.checked);
  });

  ui.layerOpacity.addEventListener("input", () => setLayerOpacity(ui.layerOpacity.value));
  ui.layerOpacity.addEventListener("change", pushHistory);

  ui.addLayerBtn.addEventListener("click", addLayer);
  ui.duplicateLayerBtn.addEventListener("click", duplicateLayer);
  ui.deleteLayerBtn.addEventListener("click", deleteLayer);
  ui.moveLayerUpBtn.addEventListener("click", () => moveLayer(1));
  ui.moveLayerDownBtn.addEventListener("click", () => moveLayer(-1));

  ui.undoBtn.addEventListener("click", undo);
  ui.redoBtn.addEventListener("click", redo);
  ui.exportBtn.addEventListener("click", exportPng);
  ui.previewBtn.addEventListener("click", showPreview);
  ui.closePreviewBtn.addEventListener("click", hidePreview);
  ui.previewOverlay.addEventListener("click", (event) => {
    if (event.target === ui.previewOverlay) hidePreview();
  });

  canvas.addEventListener("pointerdown", beginStroke);
  canvas.addEventListener("pointermove", continueStroke);
  canvas.addEventListener("pointerup", finishStroke);
  canvas.addEventListener("pointercancel", finishStroke);
  canvas.addEventListener("pointerleave", () => {
    if (!isDrawing) ui.cursorReadout.textContent = "x: -- y: --";
  });

  window.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
    }
    if (event.key === "Escape") hidePreview();
    if (event.target.matches("input")) return;
    const shortcuts = {
      p: "pencil",
      b: "pencil",
      e: "eraser",
      l: "line",
      r: "rect",
      f: "fill",
      d: "dither",
    };
    const tool = shortcuts[event.key.toLowerCase()];
    if (tool) setTool(tool);
  });
}

function init() {
  bindEvents();
  pushHistory();
  renderEverything();
  setTool("pencil");
}

init();
