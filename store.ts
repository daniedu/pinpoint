import { createStore } from 'https://esm.sh/zustand@5/vanilla'
import type { AppState, AppActions, Pin, NoGpsImage, ProcessingState } from './lib.ts'

export type AppStore = AppState & AppActions

export const store = createStore<AppStore>((set) => ({
  pins: [],
  noGpsImages: [],
  selectedNoGpsId: null,
  processing: null,
  stats: { pinCount: 0, noGpsCount: 0 },

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
      processing: null,
      stats: { pinCount: 0, noGpsCount: 0 },
    }),
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
