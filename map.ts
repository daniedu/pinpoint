import { store, subscribeSelector } from './store.ts'
import type { Pin } from './lib.ts'

declare const L: any

let map: any
const markers = new Map<string, any>()
const thumbUrls = new Map<string, string>()
const fullUrls = new Map<string, string>()

export function initMap(containerId: string) {
  map = L.map(containerId).setView([20, 0], 2)

  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  })

  const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: '&copy; Esri',
      maxZoom: 19,
    }
  )

  osm.addTo(map)

  L.control.layers({ Street: osm, Satellite: satellite }).addTo(map)

  map.on('click', handleMapClick)

  subscribeSelector((s) => s.pins, syncMarkers)
  subscribeSelector((s) => s.selectedNoGpsId, onSelectedNoGpsChange)

  initLightbox()
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
    let marker = markers.get(pin.id)
    if (marker) {
      marker.setLatLng([pin.lat, pin.lng])
      continue
    }

    marker = L.marker([pin.lat, pin.lng], { draggable: true }).addTo(map)
    const thumbUrl = URL.createObjectURL(pin.thumbnailBlob)
    const fullUrl = URL.createObjectURL(pin.optimizedBlob)
    thumbUrls.set(pin.id, thumbUrl)
    fullUrls.set(pin.id, fullUrl)

    function buildPopupContent(lat: number, lng: number) {
      return `
        <div style="min-width:220px">
          <img src="${thumbUrl}" style="width:100%;border-radius:4px;cursor:pointer" onclick="__openLightbox('${pin.id}')" />
          <p style="margin:4px 0 0;font-size:12px;color:#666">${pin.fileName}</p>
          <p style="margin:0;font-size:11px;color:#999">${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
          <button onclick="__deletePin('${pin.id}')" style="margin-top:4px;padding:2px 8px;font-size:11px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer">Delete</button>
        </div>
      `
    }

    marker.bindPopup(buildPopupContent(pin.lat, pin.lng))

    marker.on('dragend', () => {
      const pos = marker.getLatLng()
      store.getState().updatePinPosition(pin.id, pos.lat, pos.lng)
      marker.setPopupContent(buildPopupContent(pos.lat, pos.lng))
    })

    marker.on('click', () => {
      store.getState().setSelectedPinId(pin.id)
    })

    markers.set(pin.id, marker)
  }

  if (pins.length === 1 && markers.size === 1) {
    map.setView([pins[0].lat, pins[0].lng], 13)
  } else if (pins.length > 1) {
    const group = L.featureGroup(Array.from(markers.values()))
    map.fitBounds(group.getBounds().pad(0.1))
  }
}

;(window as any).__deletePin = (id: string) => {
  store.getState().removePin(id)
}

;(window as any).__openLightbox = (id: string) => {
  const url = fullUrls.get(id)
  if (!url) return
  const img = document.getElementById('lightbox-img')! as HTMLImageElement
  const box = document.getElementById('lightbox')!
  img.src = url
  box.classList.remove('hidden')
  box.classList.add('flex')
}

function initLightbox() {
  const box = document.getElementById('lightbox')!
  document.getElementById('lightbox-close')!.addEventListener('click', closeLightbox)
  box.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeLightbox()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox()
  })
}

function closeLightbox() {
  const box = document.getElementById('lightbox')!
  box.classList.add('hidden')
  box.classList.remove('flex')
}

export function centerOnPin(id: string) {
  const marker = markers.get(id)
  if (marker) {
    map.setView(marker.getLatLng(), 13)
    marker.openPopup()
  }
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
    thumbnailBlob: image.thumbnailBlob,
    fileName: image.fileName,
  }

  store.getState().addPins([pin])
  store.getState().removeNoGpsImage(selectedId)
  store.getState().setSelectedNoGpsId(null)
}
