import { initDbPersistence, loadFromDb } from './db.ts'
import { initMap } from './map.ts'
import { initUI } from './ui.ts'

async function main() {
  initDbPersistence()
  await loadFromDb()
  initMap('map')
  initUI()
}

main()
