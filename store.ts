import { createStore } from 'https://esm.sh/zustand@5/vanilla'
import type { AppState, AppActions, Pin, NoGpsImage, ProcessingState, AppError } from './lib.ts'

export type AppStore = AppState & AppActions

let errorId = 0

export const store = createStore<AppStore>((set, get) => ({
  pins: [],
  noGpsImages: [],
  selectedNoGpsId: null,
  selectedPinId: null,
  searchQuery: '',
  processing: null,
  stats: { pinCount: 0, noGpsCount: 0 },
  errors: [],

  addPins: (newPins: Pin[]) =>
    set((state) => {
      const pins = [...state.pins, ...newPins]
      return { pins, stats: { ...state.stats, pinCount: pins.length } }
    }),

  removePin: (id: string) =>
    set((state) => {
      const pins = state.pins.filter((p) => p.id !== id)
      return { pins, stats: { ...state.stats, pinCount: pins.length } }
    }),

  clearPins: () =>
    set((state) => ({ pins: [], stats: { ...state.stats, pinCount: 0 } })),

  addNoGpsImages: (images: NoGpsImage[]) =>
    set((state) => {
      const noGpsImages = [...state.noGpsImages, ...images]
      return {
        noGpsImages,
        stats: { ...state.stats, noGpsCount: noGpsImages.length },
      }
    }),

  removeNoGpsImage: (id: string) =>
    set((state) => {
      const noGpsImages = state.noGpsImages.filter((i) => i.id !== id)
      return {
        noGpsImages,
        stats: { ...state.stats, noGpsCount: noGpsImages.length },
      }
    }),

  clearNoGpsImages: () =>
    set((state) => ({
      noGpsImages: [],
      stats: { ...state.stats, noGpsCount: 0 },
    })),

  setSelectedNoGpsId: (id: string | null) => set({ selectedNoGpsId: id }),

  setProcessing: (p: ProcessingState | null) => set({ processing: p }),

  clearAll: () =>
    set({
      pins: [],
      noGpsImages: [],
      selectedNoGpsId: null,
      selectedPinId: null,
      searchQuery: '',
      processing: null,
      stats: { pinCount: 0, noGpsCount: 0 },
      errors: [],
    }),

  updatePinPosition: (id: string, lat: number, lng: number) =>
    set((state) => ({
      pins: state.pins.map((p) =>
        p.id === id ? { ...p, lat, lng } : p
      ),
    })),

  setSelectedPinId: (id: string | null) => set({ selectedPinId: id }),

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  addError: (message: string) => {
    const id = `err-${++errorId}`
    set((state) => ({ errors: [...state.errors, { message, id }] }))
    setTimeout(() => {
      if (get().errors.some((e) => e.id === id)) {
        set((state) => ({ errors: state.errors.filter((e) => e.id !== id) }))
      }
    }, 5000)
  },

  dismissError: (id: string) =>
    set((state) => ({ errors: state.errors.filter((e) => e.id !== id) })),
}))

export function subscribeSelector<T>(
  selector: (state: AppStore) => T,
  callback: (value: T) => void
): () => void {
  let prev = selector(store.getState())
  return store.subscribe(() => {
    const curr = selector(store.getState())
    if (curr !== prev) {
      prev = curr
      callback(curr)
    }
  })
}
