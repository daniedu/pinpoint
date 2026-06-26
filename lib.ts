export interface Pin {
  id: string
  lat: number
  lng: number
  optimizedBlob: Blob
  thumbnailBlob: Blob
  fileName: string
}

export interface NoGpsImage {
  id: string
  fileName: string
  optimizedBlob: Blob
}

export interface AppState {
  pins: Pin[]
  noGpsImages: NoGpsImage[]
  selectedNoGpsId: string | null
  stats: { pinCount: number; noGpsCount: number }
}

export interface AppActions {
  addPins: (pins: Pin[]) => void
  removePin: (id: string) => void
  clearPins: () => void
  addNoGpsImages: (images: NoGpsImage[]) => void
  removeNoGpsImage: (id: string) => void
  clearNoGpsImages: () => void
  setSelectedNoGpsId: (id: string | null) => void
  clearAll: () => void
}

export const MAX_IMAGE_DIMENSION = 1200
export const THUMBNAIL_DIMENSION = 200
export const JPEG_QUALITY = 0.8
