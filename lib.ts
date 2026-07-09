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
  thumbnailBlob: Blob
}

export interface ProcessingState {
  current: number
  total: number
}

export interface AppState {
  pins: Pin[]
  noGpsImages: NoGpsImage[]
  selectedNoGpsId: string | null
  processing: ProcessingState | null
  stats: { pinCount: number; noGpsCount: number }
  errors: AppError[]
}

export interface AppActions {
  addPins: (pins: Pin[]) => void
  removePin: (id: string) => void
  clearPins: () => void
  addNoGpsImages: (images: NoGpsImage[]) => void
  removeNoGpsImage: (id: string) => void
  clearNoGpsImages: () => void
  setSelectedNoGpsId: (id: string | null) => void
  setProcessing: (p: ProcessingState | null) => void
  clearAll: () => void
  addError: (message: string) => void
  dismissError: (id: string) => void
}

export interface AppError {
  message: string
  id: string
}

export const MAX_IMAGE_DIMENSION = 1200
export const THUMBNAIL_DIMENSION = 200
export const JPEG_QUALITY = 0.8
