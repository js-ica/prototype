export const savedProjectsStorageKey = 'prototype-saved-projects'

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isValidPrototype(prototype) {
  return isRecord(prototype) &&
    typeof prototype.name === 'string' &&
    prototype.name.trim().length > 0 &&
    typeof prototype.description === 'string' &&
    Array.isArray(prototype.features) &&
    prototype.features.every((feature) => typeof feature === 'string') &&
    isRecord(prototype.blueprint) &&
    Object.keys(prototype.blueprint).length > 0
}

function normalizeSavedProject(project) {
  if (
    !isRecord(project) ||
    typeof project.id !== 'string' ||
    !project.id ||
    typeof project.title !== 'string' ||
    !project.title.trim() ||
    !isValidPrototype(project.prototype)
  ) {
    return null
  }
  return {
    id: project.id,
    title: project.title.trim(),
    summary: typeof project.summary === 'string' ? project.summary : project.prototype.description,
    savedAt: typeof project.savedAt === 'string' ? project.savedAt : '',
    updatedAt: typeof project.updatedAt === 'string' ? project.updatedAt : '',
    prototype: project.prototype,
  }
}

function readStorage(storage) {
  try {
    return storage.getItem(savedProjectsStorageKey)
  } catch (error) {
    throw new Error(`Saved projects could not be read from this browser: ${error.message}`)
  }
}

export function loadSavedProjects(storage = window.localStorage) {
  let stored
  try {
    stored = readStorage(storage)
  } catch {
    return []
  }
  if (!stored) return []

  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.map(normalizeSavedProject).filter(Boolean) : []
  } catch {
    return []
  }
}

function writeSavedProjects(projects, storage) {
  try {
    storage.setItem(savedProjectsStorageKey, JSON.stringify(projects))
  } catch (error) {
    throw new Error(`Saved projects could not be stored in this browser. Check available local storage and try again. (${error.message})`)
  }
  return projects
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `saved-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function saveProject(prototype, title, existingId, storage = window.localStorage) {
  if (!isValidPrototype(prototype)) {
    throw new Error('A complete project blueprint is required before it can be saved.')
  }
  const projectTitle = typeof title === 'string' ? title.trim() : ''
  if (!projectTitle) throw new Error('Enter a title before saving this project.')

  const projects = loadSavedProjects(storage)
  const now = new Date().toISOString()
  if (existingId) {
    const index = projects.findIndex((project) => project.id === existingId)
    if (index < 0) throw new Error('This saved project could not be found. Save it as a new project instead.')
    const previous = projects[index]
    const updated = {
      ...previous,
      title: projectTitle,
      summary: prototype.description,
      updatedAt: now,
      prototype,
    }
    projects[index] = updated
    writeSavedProjects(projects, storage)
    return updated
  }

  const created = {
    id: createId(),
    title: projectTitle,
    summary: prototype.description,
    savedAt: now,
    updatedAt: now,
    prototype,
  }
  writeSavedProjects([created, ...projects], storage)
  return created
}

export function deleteSavedProject(projectId, storage = window.localStorage) {
  if (typeof projectId !== 'string' || !projectId) throw new Error('A valid saved project is required.')
  const projects = loadSavedProjects(storage)
  if (!projects.some((project) => project.id === projectId)) {
    throw new Error('This saved project could not be found.')
  }
  return writeSavedProjects(projects.filter((project) => project.id !== projectId), storage)
}
