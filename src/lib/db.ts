import type { AppState } from '../types'

const DB_NAME = 'dandori-chef'
const STORE = 'app'
const KEY = 'state'
const VERSION = 1

export const defaultState: AppState = {
  pantry: [
    { id: 'p-chicken', name: '鶏むね肉', quantity: 550, unit: 'g', category: '肉・魚' },
    { id: 'p-tofu', name: '木綿豆腐', quantity: 150, unit: 'g', category: '豆・卵' },
    { id: 'p-cabbage', name: 'キャベツ', quantity: 0.5, unit: '玉', category: '野菜' },
    { id: 'p-egg', name: '卵', quantity: 4, unit: '個', category: '豆・卵' }
  ],
  favoriteRecipeIds: [],
  shoppingChecked: []
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadState(): Promise<AppState> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(KEY)
      request.onsuccess = () => resolve((request.result as AppState | undefined) ?? defaultState)
      request.onerror = () => reject(request.error)
    })
  } catch {
    return defaultState
  }
}

export async function saveState(state: AppState): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(state, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Storage failure should not block cooking mode.
  }
}
