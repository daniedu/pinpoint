import { store, subscribeSelector } from './store.ts'
import type { Pin } from './lib.ts'

declare const L: any

let map: any
const markers = new Map<string, any>()
const thumbUrls = new Map<string, string>()
const fullUrls = new Map<string, string>()

export function initMap(containerId: string) {
  map = L.map(containerId).setView([20, 0], 2)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)

  map.on('click', handleMapClick)

  subscribeSelector((s) => s.pins, syncMarkers)
  subscribeSelector((s) => s.selectedNoGpsId, onSelectedNoGpsChange)

  return map
}

function syncMarkers(pins: Pin[]) {
  const currentIds = new Set(pins.map((p) => p.id))

  for (const [id, marker] of markers) {
    if (!currentIds.has(id)) {
      map.removeLayer(marker)
      markers.delete(id)
      const tu = thumbUrls.get(id)
      if (tu) { URL.revokeObjectURL(tu); thumbUrls.delete(id) }
      const fu = fullUrls.get(id)
      if (fu) { URL.revokeObjectURL(fu); fullUrls.delete(id) }
    }
  }

  for (const pin of pins) {
    if (!markers.has(pin.id)) {
      const marker = L.marker([pin.lat, pin.lng]).addTo(map)
      const thumbUrl = URL.createObjectURL(pin.thumbnailBlob)
      const fullUrl = URL.createObjectURL(pin.optimizedBlob)
      thumbUrls.set(pin.id, thumbUrl)
      fullUrls.set(pin.id, fullUrl)
      marker.bindPopup(`
        <div style="min-width:220px">
          <img src="${thumbUrl}" style="width:100%;border-radius:4px;cursor:pointer" onclick="window.open('${fullUrl}')" />
          <p style="margin:4px 0 0;font-size:12px;color:#666">${pin.fileName}</p>
          <p style="margin:0;font-size:11px;color:#999">${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}</p>
          <button onclick="__deletePin('${pin.id}')" style="margin-top:4px;padding:2px 8px;font-size:11px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer">Delete</button>
        </div>
      `)
      markers.set(pin.id, marker)
    }
  }

  if (pins.length > 0) {
    const group = L.featureGroup(Array.from(markers.values()))
    map.fitBounds(group.getBounds().pad(0.1))
  }
}

;(window as any).__deletePin = (id: string) => {
  store.getState().removePin(id)
}

function onSelectedNoGpsChange(id: string | null) {
  map.getContainer().style.cursor = id ? 'crosshair' : ''
}

async function handleMapClick(e: any) {
  const selectedId = store.getState().selectedNoGpsId
  if (!selectedId) return

  const noGpsImages = store.getState().noGpsImages
  const image = noGpsImages.find((i) => i.id === selectedId)
  if (!image) return

  const { lat, lng } = e.latlng
  const pin: Pin = {
    id: crypto.randomUUID(),
    lat,
    lng,
    optimizedBlob: image.optimizedBlob,
    thumbnailBlob: image.optimizedBlob,
    fileName: image.fileName,
  }

  store.getState().addPins([pin])
  store.getState().removeNoGpsImage(selectedId)
  store.getState().setSelectedNoGpsId(null)
}
