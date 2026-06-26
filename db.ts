import { get, set } from 'https://esm.sh/idb-keyval@6'
import { store, subscribeSelector } from './store.ts'
import type { Pin, NoGpsImage } from './lib.ts'

const PINS_KEY = 'pinpoint-pins'
const NO_GPS_KEY = 'pinpoint-no-gps'

export async function loadFromDb() {
  const pins = (await get<Pin[]>(PINS_KEY)) ?? []
  const noGpsImages = (await get<NoGpsImage[]>(NO_GPS_KEY)) ?? []
  store.getState().addPins(pins)
  store.getState().addNoGpsImages(noGpsImages)
}

function savePins(pins: Pin[]) {
  set(PINS_KEY, pins)
}

function saveNoGps(images: NoGpsImage[]) {
  set(NO_GPS_KEY, images)
}

export function initDbPersistence() {
  subscribeSelector((s) => s.pins, savePins)
  subscribeSelector((s) => s.noGpsImages, saveNoGps)
}
