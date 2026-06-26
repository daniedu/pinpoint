import { store, subscribeSelector } from './store.ts'
import { processImage, extractGps } from './images.ts'

export function initUI() {
  setupDropzone()
  setupClearButton()
  setupExportButton()
  subscribeSelector((s) => s.noGpsImages, renderNoGpsList)
  subscribeSelector((s) => s.stats, renderStats)
}

function setupDropzone() {
  const dropzone = document.getElementById('dropzone')!
  const input = document.getElementById('file-input')! as HTMLInputElement

  dropzone.addEventListener('click', () => input.click())

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault()
    dropzone.classList.add('border-blue-500', 'bg-blue-50')
  })

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('border-blue-500', 'bg-blue-50')
  })

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault()
    dropzone.classList.remove('border-blue-500', 'bg-blue-50')
    const files = Array.from(e.dataTransfer!.files).filter((f) =>
      f.type.startsWith('image/')
    )
    handleFiles(files)
  })

  input.addEventListener('change', () => {
    const files = Array.from(input.files!).filter((f) =>
      f.type.startsWith('image/')
    )
    handleFiles(files)
    input.value = ''
  })
}

async function handleFiles(files: File[]) {
  for (const file of files) {
    const gps = await extractGps(file)
    const result = await processImage(file, gps)
    if (result.pin) store.getState().addPins([result.pin])
    if (result.noGps) store.getState().addNoGpsImages([result.noGps])
  }
}

function renderNoGpsList(images: any[]) {
  const container = document.getElementById('no-gps-list')!
  if (images.length === 0) {
    container.innerHTML =
      '<p class="text-sm text-gray-400 italic">No images without GPS</p>'
    return
  }
  container.innerHTML = images
    .map(
      (img) => `
      <div class="flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer ${
        store.getState().selectedNoGpsId === img.id
          ? 'bg-blue-50 ring-1 ring-blue-400'
          : ''
      }" data-id="${img.id}">
        <span class="text-sm truncate flex-1">${img.fileName}</span>
        <button class="text-xs text-blue-600 hover:text-blue-800 place-btn" data-id="${img.id}">
          Place
        </button>
      </div>
    `
    )
    .join('')

  container.querySelectorAll('.place-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = (btn as HTMLElement).dataset.id!
      const current = store.getState().selectedNoGpsId
      store.getState().setSelectedNoGpsId(current === id ? null : id)
      renderNoGpsList(store.getState().noGpsImages)
    })
  })
}

function renderStats(stats: { pinCount: number; noGpsCount: number }) {
  const el = document.getElementById('stats')!
  el.textContent = `${stats.pinCount} pin${stats.pinCount !== 1 ? 's' : ''} · ${stats.noGpsCount} without GPS`
}

function setupClearButton() {
  document.getElementById('clear-btn')!.addEventListener('click', () => {
    if (confirm('Clear all pins and images?')) {
      store.getState().clearAll()
    }
  })
}

function setupExportButton() {
  document.getElementById('export-btn')!.addEventListener('click', () => {
    const pins = store.getState().pins
    if (pins.length === 0) {
      alert('No pins to export')
      return
    }
    const geoJson = {
      type: 'FeatureCollection',
      features: pins.map((pin) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
        properties: { fileName: pin.fileName, id: pin.id },
      })),
    }
    const blob = new Blob([JSON.stringify(geoJson, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pinpoint-export.geojson'
    a.click()
    URL.revokeObjectURL(url)
  })
}
