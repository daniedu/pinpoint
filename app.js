var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined")
    return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// db.ts
import { get, set } from "https://esm.sh/idb-keyval@6";

// store.ts
import { createStore } from "https://esm.sh/zustand@5/vanilla";
var store = createStore((set) => ({
  pins: [],
  noGpsImages: [],
  selectedNoGpsId: null,
  stats: { pinCount: 0, noGpsCount: 0 },
  addPins: (newPins) => set((state) => {
    const pins = [...state.pins, ...newPins];
    return { pins, stats: { ...state.stats, pinCount: pins.length } };
  }),
  removePin: (id) => set((state) => {
    const pins = state.pins.filter((p) => p.id !== id);
    return { pins, stats: { ...state.stats, pinCount: pins.length } };
  }),
  clearPins: () => set((state) => ({ pins: [], stats: { ...state.stats, pinCount: 0 } })),
  addNoGpsImages: (images) => set((state) => {
    const noGpsImages = [...state.noGpsImages, ...images];
    return {
      noGpsImages,
      stats: { ...state.stats, noGpsCount: noGpsImages.length }
    };
  }),
  removeNoGpsImage: (id) => set((state) => {
    const noGpsImages = state.noGpsImages.filter((i) => i.id !== id);
    return {
      noGpsImages,
      stats: { ...state.stats, noGpsCount: noGpsImages.length }
    };
  }),
  clearNoGpsImages: () => set((state) => ({
    noGpsImages: [],
    stats: { ...state.stats, noGpsCount: 0 }
  })),
  setSelectedNoGpsId: (id) => set({ selectedNoGpsId: id }),
  clearAll: () => set({
    pins: [],
    noGpsImages: [],
    selectedNoGpsId: null,
    stats: { pinCount: 0, noGpsCount: 0 }
  })
}));
function subscribeSelector(selector, callback) {
  let prev = selector(store.getState());
  return store.subscribe(() => {
    const curr = selector(store.getState());
    if (curr !== prev) {
      prev = curr;
      callback(curr);
    }
  });
}

// db.ts
var PINS_KEY = "pinpoint-pins";
var NO_GPS_KEY = "pinpoint-no-gps";
async function loadFromDb() {
  const pins = await get(PINS_KEY) ?? [];
  const noGpsImages = await get(NO_GPS_KEY) ?? [];
  store.getState().addPins(pins);
  store.getState().addNoGpsImages(noGpsImages);
}
function savePins(pins) {
  set(PINS_KEY, pins);
}
function saveNoGps(images) {
  set(NO_GPS_KEY, images);
}
function initDbPersistence() {
  subscribeSelector((s) => s.pins, savePins);
  subscribeSelector((s) => s.noGpsImages, saveNoGps);
}

// map.ts
var map;
var markers = new Map;
function initMap(containerId) {
  map = L.map(containerId).setView([20, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19
  }).addTo(map);
  map.on("click", handleMapClick);
  subscribeSelector((s) => s.pins, syncMarkers);
  subscribeSelector((s) => s.selectedNoGpsId, onSelectedNoGpsChange);
  return map;
}
function syncMarkers(pins) {
  const currentIds = new Set(pins.map((p) => p.id));
  for (const [id, marker] of markers) {
    if (!currentIds.has(id)) {
      map.removeLayer(marker);
      markers.delete(id);
    }
  }
  for (const pin of pins) {
    if (!markers.has(pin.id)) {
      const marker = L.marker([pin.lat, pin.lng]).addTo(map);
      const imgUrl = URL.createObjectURL(pin.thumbnailBlob);
      marker.bindPopup(`
        <div style="min-width:200px">
          <img src="${imgUrl}" style="width:100%;border-radius:4px" />
          <p style="margin:4px 0 0;font-size:12px;color:#666">${pin.fileName}</p>
          <p style="margin:0;font-size:11px;color:#999">${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}</p>
        </div>
      `);
      marker.on("popupclose", () => URL.revokeObjectURL(imgUrl));
      markers.set(pin.id, marker);
    }
  }
  if (pins.length > 0) {
    const group = L.featureGroup(Array.from(markers.values()));
    map.fitBounds(group.getBounds().pad(0.1));
  }
}
function onSelectedNoGpsChange(id) {
  map.getContainer().style.cursor = id ? "crosshair" : "";
}
async function handleMapClick(e) {
  const selectedId = store.getState().selectedNoGpsId;
  if (!selectedId)
    return;
  const noGpsImages = store.getState().noGpsImages;
  const image = noGpsImages.find((i) => i.id === selectedId);
  if (!image)
    return;
  const { lat, lng } = e.latlng;
  const pin = {
    id: crypto.randomUUID(),
    lat,
    lng,
    optimizedBlob: image.optimizedBlob,
    thumbnailBlob: image.optimizedBlob,
    fileName: image.fileName
  };
  store.getState().addPins([pin]);
  store.getState().removeNoGpsImage(selectedId);
  store.getState().setSelectedNoGpsId(null);
}

// lib.ts
var MAX_IMAGE_DIMENSION = 1200;
var THUMBNAIL_DIMENSION = 200;
var JPEG_QUALITY = 0.8;

// images.ts
function generateId() {
  return crypto.randomUUID();
}
function optimizeImage(file, maxDim) {
  return new Promise((resolve, reject) => {
    const img = new Image;
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob)
          resolve(blob);
        else
          reject(new Error("Failed to encode blob"));
      }, "image/jpeg", JPEG_QUALITY);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}
async function processImage(file, gps) {
  const [optimizedBlob, thumbnailBlob] = await Promise.all([
    optimizeImage(file, MAX_IMAGE_DIMENSION),
    optimizeImage(file, THUMBNAIL_DIMENSION)
  ]);
  const id = generateId();
  if (gps) {
    return {
      pin: {
        id,
        lat: gps.latitude,
        lng: gps.longitude,
        optimizedBlob,
        thumbnailBlob,
        fileName: file.name
      }
    };
  }
  return {
    noGps: {
      id,
      fileName: file.name,
      optimizedBlob
    }
  };
}
async function extractGps(file) {
  try {
    const exifr = await import("https://esm.sh/exifr@7");
    const gps = await exifr.gps(file);
    if (gps && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
      return { latitude: gps.latitude, longitude: gps.longitude };
    }
  } catch {}
  return null;
}

// ui.ts
function initUI() {
  setupDropzone();
  setupClearButton();
  setupExportButton();
  subscribeSelector((s) => s.noGpsImages, renderNoGpsList);
  subscribeSelector((s) => s.stats, renderStats);
}
function setupDropzone() {
  const dropzone = document.getElementById("dropzone");
  const input = document.getElementById("file-input");
  dropzone.addEventListener("click", () => input.click());
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("border-blue-500", "bg-blue-50");
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("border-blue-500", "bg-blue-50");
  });
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("border-blue-500", "bg-blue-50");
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    handleFiles(files);
  });
  input.addEventListener("change", () => {
    const files = Array.from(input.files).filter((f) => f.type.startsWith("image/"));
    handleFiles(files);
    input.value = "";
  });
}
async function handleFiles(files) {
  for (const file of files) {
    const gps = await extractGps(file);
    const result = await processImage(file, gps);
    if (result.pin)
      store.getState().addPins([result.pin]);
    if (result.noGps)
      store.getState().addNoGpsImages([result.noGps]);
  }
}
function renderNoGpsList(images) {
  const container = document.getElementById("no-gps-list");
  if (images.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-400 italic">No images without GPS</p>';
    return;
  }
  container.innerHTML = images.map((img) => `
      <div class="flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer ${store.getState().selectedNoGpsId === img.id ? "bg-blue-50 ring-1 ring-blue-400" : ""}" data-id="${img.id}">
        <span class="text-sm truncate flex-1">${img.fileName}</span>
        <button class="text-xs text-blue-600 hover:text-blue-800 place-btn" data-id="${img.id}">
          Place
        </button>
      </div>
    `).join("");
  container.querySelectorAll(".place-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const current = store.getState().selectedNoGpsId;
      store.getState().setSelectedNoGpsId(current === id ? null : id);
      renderNoGpsList(store.getState().noGpsImages);
    });
  });
}
function renderStats(stats) {
  const el = document.getElementById("stats");
  el.textContent = `${stats.pinCount} pin${stats.pinCount !== 1 ? "s" : ""} · ${stats.noGpsCount} without GPS`;
}
function setupClearButton() {
  document.getElementById("clear-btn").addEventListener("click", () => {
    if (confirm("Clear all pins and images?")) {
      store.getState().clearAll();
    }
  });
}
function setupExportButton() {
  document.getElementById("export-btn").addEventListener("click", () => {
    const pins = store.getState().pins;
    if (pins.length === 0) {
      alert("No pins to export");
      return;
    }
    const geoJson = {
      type: "FeatureCollection",
      features: pins.map((pin) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [pin.lng, pin.lat] },
        properties: { fileName: pin.fileName, id: pin.id }
      }))
    };
    const blob = new Blob([JSON.stringify(geoJson, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pinpoint-export.geojson";
    a.click();
    URL.revokeObjectURL(url);
  });
}

// app.ts
async function main() {
  initDbPersistence();
  await loadFromDb();
  initMap("map");
  initUI();
}
main();
