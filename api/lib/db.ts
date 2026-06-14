import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.resolve(__dirname, '../../data/db.json')

let cache: Record<string, unknown> | null = null

function readDB(): Record<string, unknown> {
  if (!cache) {
    const raw = fs.readFileSync(DB_PATH, 'utf-8')
    cache = JSON.parse(raw)
  }
  return cache as Record<string, unknown>
}

function writeDB(data: Record<string, unknown>): void {
  cache = data
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

export function getCollection<T>(name: string): T[] {
  const db = readDB()
  return (db[name] as T[]) || []
}

export function setCollection<T>(name: string, data: T[]): void {
  const db = readDB()
  db[name] = data
  writeDB(db)
}

export function addToCollection<T extends Record<string, unknown>>(name: string, item: T): T {
  const collection = getCollection<T>(name)
  collection.push(item)
  setCollection(name, collection)
  return item
}

export function updateInCollection(name: string, id: string, updates: Record<string, unknown>): Record<string, unknown> | null {
  const collection = getCollection<Record<string, unknown>>(name)
  const index = collection.findIndex((item) => item.id === id)
  if (index === -1) return null
  collection[index] = { ...collection[index], ...updates }
  setCollection(name, collection)
  return collection[index]
}

export function findInCollection<T extends { id: string }>(name: string, id: string): T | null {
  const collection = getCollection<T>(name)
  return collection.find((item) => item.id === id) || null
}

export function filterCollection<T>(name: string, predicate: (item: T) => boolean): T[] {
  const collection = getCollection<T>(name)
  return collection.filter(predicate)
}

export function generateId(): string {
  return crypto.randomUUID()
}
