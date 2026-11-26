const board = document.querySelector(".board");
const viewport = board.querySelector(".board-viewport");
const world = board.querySelector(".world");
const connections = board.querySelector(".connections");
const zoomValue = board.querySelector(".zoom-value");
const zoomIn = board.querySelector('[data-zoom="in"]');
const zoomOut = board.querySelector('[data-zoom="out"]');
const closeButton = board.querySelector(".close-notes");
const resetButton = board.querySelector(".reset-board");
const status = board.querySelector(".board-status");
const compact = matchMedia("(max-width: 640px)");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const storageKey = "laboratorio-layout-v1";
const minZoom = .05;
const maxZoom = 2.6;

function readLayout() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey));
    if (data && typeof data === "object" && !Array.isArray(data)) return data;
  } catch {
    // The board still works when browser storage is unavailable.
  }
  return {};
}

let saved = readLayout();
let camera = { x: 0, y: 0, scale: 1 };
let cameraFrame = 0;
let active;
let suppressClick = false;
let gesture;
const pointers = new Map();
const items = new Map();

function pointFor(key, fallback) {
  const point = saved[key];
  return Number.isFinite(point?.x) && Number.isFinite(point?.y) ? point : fallback;
}

function makeItem(element, key, kind) {
  const home = { x: Number(element.dataset.x), y: Number(element.dataset.y) };
  const mobileHome = { x: Number(element.dataset.mobileX), y: Number(element.dataset.mobileY) };
  const item = { element, key, kind, home, mobileHome };
  items.set(element, item);
  return item;
}

const zones = [...world.querySelectorAll("[data-zone]")].map((element) =>
  makeItem(element, "zone:" + element.dataset.zone, "zone"),
);
const projects = [...world.querySelectorAll(".project")].map((element) => {
  const project = makeItem(element, "project:" + element.id, "project");
  project.tile = element.querySelector(".tile");
  project.tile.setAttribute("aria-controls", "notes-" + element.id);
  project.tile.setAttribute("aria-expanded", "false");
  project.notes = [...element.querySelectorAll(".note")].map((noteElement) => {
    const note = { element: noteElement, kind: "note", project };
    items.set(noteElement, note);
    return note;
  });
  return project;
});
for (const zone of zones) {
  zone.projects = projects.filter((project) => project.element.dataset.group === zone.element.dataset.zone);
}

function layoutKey(item) {
  return compact.matches ? item.key + ":mobile" : item.key;
}

function applyLayout() {
  for (const item of [...zones, ...projects]) {
    const home = compact.matches ? item.mobileHome : item.home;
    item.point = pointFor(layoutKey(item), home);
    place(item);
  }
}

function noteKey(note) {
  const mode = compact.matches ? "mobile" : "desktop";
  return note.project.key + ":note:" + mode + ":" + note.element.dataset.note;
}

function syncResetButton() {
  resetButton.hidden = !Object.keys(saved).length;
}

function saveLayout() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(saved));
  } catch {
    // Keep the current arrangement in memory for this visit.
  }
  syncResetButton();
}

function place(item) {
  const { x, y } = item.point;
  item.element.style.transform = "translate(" + x + "px, " + y + "px)";
}

function box(item, offset = { x: 0, y: 0 }) {
  const x = item.point.x + offset.x;
  const y = item.point.y + offset.y;
  return { x, y, right: x + item.element.offsetWidth, bottom: y + item.element.offsetHeight };
}

function bounds(boxes) {
  return {
    x: Math.min(...boxes.map((rect) => rect.x)),
    y: Math.min(...boxes.map((rect) => rect.y)),
    right: Math.max(...boxes.map((rect) => rect.right)),
    bottom: Math.max(...boxes.map((rect) => rect.bottom)),
  };
}

function overviewBoxes() {
  return [...zones, ...projects].map((item) => box(item));
}

function boundedZoom(value) {
  return Math.min(maxZoom, Math.max(minZoom, value));
}

function renderCamera(next) {
  camera = next;
  const { x, y, scale } = camera;
  world.style.transform = "translate3d(" + x + "px, " + y + "px, 0) scale(" + scale + ")";
  viewport.style.backgroundPosition = x % 22 + "px " + y % 22 + "px";
  const percent = Math.round(scale * 100) + "%";
  if (zoomValue.value !== percent) zoomValue.value = percent;
  zoomIn.disabled = scale >= maxZoom;
  zoomOut.disabled = scale <= minZoom;
}

function stopCamera() {
  cancelAnimationFrame(cameraFrame);
  cameraFrame = 0;
}

function goTo(destination, animate = true) {
  stopCamera();
  if (!animate || reduced.matches) {
    renderCamera(destination);
    return;
  }
  const from = camera;
  const start = performance.now();
  function frame(now) {
    const progress = Math.min(1, (now - start) / 320);
    const amount = 1 - (1 - progress) ** 3;
    renderCamera({
      x: from.x + (destination.x - from.x) * amount,
      y: from.y + (destination.y - from.y) * amount,
      scale: from.scale + (destination.scale - from.scale) * amount,
    });
    cameraFrame = progress < 1 ? requestAnimationFrame(frame) : 0;
  }
  cameraFrame = requestAnimationFrame(frame);
}

function fitted(rect, max = 1.18) {
  const padding = compact.matches ? 24 : 56;
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  const scale = boundedZoom(Math.min(max,
    (width - padding) / Math.max(1, rect.right - rect.x),
    (height - padding) / Math.max(1, rect.bottom - rect.y),
  ));
  return {
    x: width / 2 - (rect.x + rect.right) * scale / 2,
    y: height / 2 - (rect.y + rect.bottom) * scale / 2,
    scale,
  };
}

function focusOverview(animate = true) {
  goTo(fitted(bounds(overviewBoxes())), animate);
}

function focusGroup(zone) {
  goTo(fitted(bounds([zone, ...zone.projects].map((item) => box(item))), 1.3));
}

function drawConnections() {
  if (!active) return;
  const source = box(active);
  const x = (source.x + source.right) / 2;
  const y = (source.y + source.bottom) / 2;
  active.notes.forEach((note, index) => {
    const target = box(note, active.point);
    const dx = (target.x + target.right) / 2 - x;
    const dy = (target.y + target.bottom) / 2 - y;
    const line = connections.children[index];
    line.style.width = Math.hypot(dx, dy) + "px";
    line.style.transform = "translate(" + x + "px, " + y + "px) rotate(" + Math.atan2(dy, dx) + "rad)";
  });
}

function layoutNotes(project) {
  const width = project.element.offsetWidth;
  const height = project.element.offsetHeight;
  let stackY = height + 24;
  project.notes.forEach((note, index) => {
    const desktop = [
      { x: -note.element.offsetWidth - 46, y: -26 },
      { x: width + 46, y: -12 },
      { x: width / 2 - note.element.offsetWidth / 2 + 38, y: height + 35 },
    ];
    const home = compact.matches ? { x: 0, y: stackY } : desktop[index];
    note.point = pointFor(noteKey(note), home);
    place(note);
    stackY += note.element.offsetHeight + 20;
  });
  drawConnections();
}

function focusProject(project, animate = true) {
  if (compact.matches) {
    const rect = box(project);
    const scale = boundedZoom(Math.min(1.28, (viewport.clientWidth - 38) / (rect.right - rect.x)));
    goTo({
      x: viewport.clientWidth / 2 - (rect.x + rect.right) * scale / 2,
      y: 31 - rect.y * scale,
      scale,
    }, animate);
    return;
  }
  const detailBounds = [box(project), ...project.notes.map((note) => box(note, project.point))];
  goTo(fitted(bounds(detailBounds), 1.28), animate);
}

function syncProject(animate = true) {
  const project = projects.find((item) => "#" + item.element.id === location.hash);
  if (project === active) {
    if (!project) focusOverview(animate);
    return;
  }

  if (active) {
    active.element.classList.remove("is-open");
    active.tile.setAttribute("aria-expanded", "false");
    active.tile.querySelector(".expand").textContent = "+";
  }
  active = project;
  connections.replaceChildren();
  closeButton.hidden = !active;
  world.classList.toggle("has-notes", Boolean(active));

  if (!active) {
    status.textContent = "Panoramica della lavagna";
    focusOverview(animate);
    return;
  }
  active.element.classList.add("is-open");
  active.tile.setAttribute("aria-expanded", "true");
  active.tile.querySelector(".expand").textContent = "−";
  for (const note of active.notes) {
    const line = document.createElement("div");
    line.className = "connection";
    connections.append(line);
  }
  connections.style.setProperty("--connection-color",
    getComputedStyle(active.element).getPropertyValue("--project-color"));
  layoutNotes(active);
  focusProject(active, animate);
  status.textContent = "Appunti aperti: " + active.tile.querySelector("h2").textContent;
}

function showOverview(restoreFocus = false) {
  const tile = active?.tile;
  if (active) history.replaceState(null, "", location.pathname + location.search);
  syncProject();
  if (restoreFocus) tile?.focus({ preventScroll: true });
}

function worldPoint(point, view = camera) {
  return { x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale };
}

function zoomAt(scale, point, anchor = worldPoint(point)) {
  const next = boundedZoom(scale);
  renderCamera({ x: point.x - anchor.x * next, y: point.y - anchor.y * next, scale: next });
}

function viewportPoint(event) {
  const rect = viewport.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function zoomBy(factor) {
  stopCamera();
  zoomAt(camera.scale * factor, { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 });
}

function moveItem(item, next) {
  const previous = item.point;
  item.point = next;
  place(item);
  saved[item.kind === "note" ? noteKey(item) : layoutKey(item)] = next;
  if (item.kind === "zone") {
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    for (const project of item.projects) {
      project.point = { x: project.point.x + dx, y: project.point.y + dy };
      place(project);
      saved[layoutKey(project)] = project.point;
    }
  }
  drawConnections();
}

function draggable(target) {
  const tile = target.closest(".tile");
  if (tile) return items.get(tile.closest(".project"));
  const handle = target.closest(".zone-handle");
  if (handle) return items.get(handle.closest(".zone"));
  if (target.closest("a, button, summary, input, video")) return;
  return items.get(target.closest(".note"));
}

function pinchMetrics() {
  const [first, second] = pointers.values();
  return {
    midpoint: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    distance: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)),
  };
}

function beginDrag(event) {
  if (event.button !== 0 || pointers.size >= 2) return;
  if (!pointers.size) {
    suppressClick = false;
    if (event.target.closest(".note a, .note summary, .note button")) return;
  }
  stopCamera();
  const point = viewportPoint(event);
  pointers.set(event.pointerId, point);
  if (pointers.size === 2) {
    if (gesture.item && gesture.moved) saveLayout();
    gesture.item?.element.classList.remove("is-dragging");
    const { midpoint, distance } = pinchMetrics();
    gesture = { kind: "pinch", distance, scale: camera.scale, anchor: worldPoint(midpoint), moved: true };
    pointers.forEach((_, id) => viewport.setPointerCapture(id));
    suppressClick = true;
    return;
  }
  const target = draggable(event.target);
  const panFromNote = event.pointerType === "touch" && target?.kind === "note" && !event.target.closest(".note h3");
  const item = panFromNote ? undefined : target;
  gesture = { kind: "drag", start: point, view: camera, item, origin: item?.point, moved: false };
}

function continueDrag(event) {
  if (!pointers.has(event.pointerId)) return;
  const point = viewportPoint(event);
  pointers.set(event.pointerId, point);
  if (gesture.kind === "pinch") {
    const { midpoint, distance } = pinchMetrics();
    zoomAt(gesture.scale * distance / gesture.distance, midpoint, gesture.anchor);
    return;
  }
  const dx = point.x - gesture.start.x;
  const dy = point.y - gesture.start.y;
  if (!gesture.moved && Math.hypot(dx, dy) < 5) return;
  if (!gesture.moved) {
    gesture.moved = true;
    suppressClick = true;
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add("is-pointer-dragging");
    gesture.item?.element.classList.add("is-dragging");
  }
  if (gesture.item) {
    moveItem(gesture.item, {
      x: gesture.origin.x + dx / gesture.view.scale,
      y: gesture.origin.y + dy / gesture.view.scale,
    });
  } else {
    renderCamera({ x: gesture.view.x + dx, y: gesture.view.y + dy, scale: gesture.view.scale });
  }
}

function endDrag(event) {
  if (!pointers.delete(event.pointerId)) return;
  if (gesture.kind === "pinch" && pointers.size) {
    gesture = { kind: "drag", start: pointers.values().next().value, view: camera, moved: true };
    return;
  }
  if (gesture.item && gesture.moved) saveLayout();
  gesture.item?.element.classList.remove("is-dragging");
  viewport.classList.remove("is-pointer-dragging");
  gesture = undefined;
}

viewport.addEventListener("pointerdown", beginDrag);
viewport.addEventListener("pointermove", continueDrag);
window.addEventListener("pointerup", endDrag);
window.addEventListener("pointercancel", endDrag);
viewport.addEventListener("dragstart", (event) => event.preventDefault());
viewport.addEventListener("wheel", (event) => {
  event.preventDefault();
  stopCamera();
  const delta = event.deltaMode === 1 ? 16 : 1;
  if (!event.ctrlKey && Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    renderCamera({ ...camera, x: camera.x - event.deltaX * delta });
    return;
  }
  zoomAt(camera.scale * Math.exp(-event.deltaY * delta * .0025), viewportPoint(event));
}, { passive: false });

viewport.addEventListener("click", (event) => {
  if (suppressClick && event.detail) {
    event.preventDefault();
    return;
  }
  const tile = event.target.closest(".tile");
  if (tile && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    if (location.hash === tile.hash) {
      showOverview();
      return;
    }
    history.pushState(null, "", tile.hash);
    syncProject();
    return;
  }
  const handle = event.target.closest(".zone-handle");
  if (handle) focusGroup(items.get(handle.closest(".zone")));
});

const arrows = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

board.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && active) {
    event.preventDefault();
    showOverview(true);
    return;
  }
  const direction = arrows[event.key];
  if (event.target === viewport) {
    if (direction && !event.altKey) {
      event.preventDefault();
      stopCamera();
      renderCamera({ ...camera, x: camera.x - 55 * direction.x, y: camera.y - 55 * direction.y });
    } else if (["+", "=", "-"].includes(event.key)) {
      event.preventDefault();
      zoomBy(event.key === "-" ? 1 / 1.2 : 1.2);
    }
    return;
  }
  if (!event.altKey || !direction) return;
  const item = draggable(event.target);
  if (!item) return;
  event.preventDefault();
  stopCamera();
  moveItem(item, { x: item.point.x + direction.x * 18, y: item.point.y + direction.y * 18 });
  saveLayout();
  status.textContent = "Elemento spostato";
});

viewport.addEventListener("focusin", (event) => {
  if (event.target === viewport || !event.target.matches(":focus-visible")) return;
  const target = event.target.getBoundingClientRect();
  const frame = viewport.getBoundingClientRect();
  if (target.left >= frame.left && target.right <= frame.right &&
      target.top >= frame.top && target.bottom <= frame.bottom) return;
  goTo({
    ...camera,
    x: camera.x + frame.left + frame.width / 2 - target.left - target.width / 2,
    y: camera.y + frame.top + frame.height / 2 - target.top - target.height / 2,
  });
});

world.addEventListener("toggle", (event) => {
  if (active?.element.contains(event.target)) layoutNotes(active);
}, true);
board.querySelectorAll("[data-focus-zone]").forEach((button) => {
  button.addEventListener("click", () => {
    const zone = zones.find((item) => item.element.dataset.zone === button.dataset.focusZone);
    focusGroup(zone);
  });
});
zoomIn.addEventListener("click", () => zoomBy(1.24));
zoomOut.addEventListener("click", () => zoomBy(1 / 1.24));
closeButton.addEventListener("click", () => showOverview(true));
board.querySelector(".fit-board").addEventListener("click", () => showOverview());
resetButton.addEventListener("click", () => {
  saved = {};
  applyLayout();
  saveLayout();
  showOverview();
  board.querySelector(".fit-board").focus();
  status.textContent = "Posizioni iniziali ripristinate";
});

document.documentElement.classList.add("enhanced");
applyLayout();
syncResetButton();
syncProject(false);

let boardWidth = viewport.clientWidth;
let boardHeight = viewport.clientHeight;
let wasCompact = compact.matches;
new ResizeObserver(() => {
  const changedLayout = wasCompact !== compact.matches;
  if (!changedLayout && boardWidth === viewport.clientWidth && boardHeight === viewport.clientHeight) return;
  wasCompact = compact.matches;
  if (changedLayout) applyLayout();
  boardWidth = viewport.clientWidth;
  boardHeight = viewport.clientHeight;
  if (active) {
    layoutNotes(active);
    focusProject(active, false);
  } else {
    focusOverview(false);
  }
}).observe(viewport);
window.addEventListener("hashchange", () => syncProject());
