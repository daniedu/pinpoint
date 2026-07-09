import { store, subscribeSelector } from './store.ts'
import { processImage, extractGps } from './images.ts'
import type { Pin, NoGpsImage } from './lib.ts'

const CONCURRENCY = 5

export function initUI() {
  setupDropzone()
  setupClearButton()
  setupExportButton()
  subscribeSelector((s) => s.pins, renderPinList)
  subscribeSelector((s) => s.noGpsImages, renderNoGpsList)
  subscribeSelector((s) => s.stats, renderStats)
  subscribeSelector((s) => s.processing, renderProcessing)
  subscribeSelector((s) => s.errors, renderErrors)
  document.getElementById('loading')?.classList.add('hidden')
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
  const total = files.length
  if (total === 0) return
  store.getState().setProcessing({ current: 0, total })
  let completed = 0

  async function worker() {
    while (queue.length > 0) {
      const file = queue.shift()!
      try {
        const gps = await extractGps(file)
        const result = await processImage(file, gps)
        if (result.pin) store.getState().addPins([result.pin])
        if (result.noGps) store.getState().addNoGpsImages([result.noGps])
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        store.getState().addError(`Failed to process ${file.name}: ${msg}`)
      }
      completed++
      store.getState().setProcessing({ current: completed, total })
    }
  }

  const queue = [...files]
  const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, worker)
  await Promise.all(workers)
  store.getState().setProcessing(null)
}

function renderPinList(pins: Pin[]) {
  const container = document.getElementById('pin-list')!
  if (pins.length === 0) {
    container.innerHTML = ''
    return
  }
  container.innerHTML = pins
    .map(
      (pin) => `
      <div class="flex items-center gap-2 px-4 py-1.5 text-sm hover:bg-gray-50">
        <span class="truncate flex-1">${pin.fileName}</span>
        <button class="text-red-500 hover:text-red-700 text-xs font-medium delete-pin" data-id="${pin.id}">Delete</button>
      </div>
    `
    )
    .join('')

  container.querySelectorAll('.delete-pin').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!
      store.getState().removePin(id)
    })
  })
}

function renderNoGpsList(images: NoGpsImage[]) {
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
      }">
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
    })
  })
}

function renderStats(stats: { pinCount: number; noGpsCount: number }) {
  const el = document.getElementById('stats')!
  el.textContent = `${stats.pinCount} pin${stats.pinCount !== 1 ? 's' : ''} · ${stats.noGpsCount} without GPS`
}

function renderErrors(errors: { id: string; message: string }[]) {
  const container = document.getElementById('errors')!
  if (errors.length === 0) {
    container.innerHTML = ''
    return
  }
  container.innerHTML = errors
    .map(
      (e) => `
      <div class="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
        <span class="flex-1">${e.message}</span>
        <button class="text-red-500 hover:text-red-700 dismiss-error" data-id="${e.id}">&times;</button>
      </div>
    `
    )
    .join('')
  container.querySelectorAll('.dismiss-error').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.getState().dismissError((btn as HTMLElement).dataset.id!)
    })
  })
}

function renderProcessing(p: { current: number; total: number } | null) {
  const el = document.getElementById('processing')!
  if (!p || p.current >= p.total) {
    el.classList.add('hidden')
    return
  }
  el.classList.remove('hidden')
  el.textContent = `Processing ${p.current}/${p.total}...`
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
