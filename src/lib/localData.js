// ── Lightweight localStorage helpers for Phase 2 data ────────
// Falls back gracefully when Supabase tables don't exist yet.

const get = (key, fallback = []) => {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback }
  catch { return fallback }
}
const set = (key, val) => localStorage.setItem(key, JSON.stringify(val))
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

// ── Projects ────────────────────────────────────────────────
export const projectsKey = id => `wb_projects_${id}`
export const getProjects  = id => get(projectsKey(id))
export const saveProject  = (id, p) => {
  const list = getProjects(id)
  const idx  = list.findIndex(x => x.id === p.id)
  if (idx >= 0) list[idx] = p; else list.push({ ...p, id: uid() })
  set(projectsKey(id), list)
  return list
}
export const deleteProject = (id, pid) => {
  const list = getProjects(id).filter(p => p.id !== pid)
  set(projectsKey(id), list)
  return list
}

// ── Workers / Subs ──────────────────────────────────────────
export const workersKey  = id => `wb_workers_${id}`
export const wageLgsKey  = id => `wb_wagelogs_${id}`
export const getWorkers  = id => get(workersKey(id))
export const getWageLogs = id => get(wageLgsKey(id))

export const saveWorker  = (id, w) => {
  const list = getWorkers(id)
  const idx  = list.findIndex(x => x.id === w.id)
  if (idx >= 0) list[idx] = w; else list.push({ ...w, id: uid() })
  set(workersKey(id), list)
  return list
}
export const deleteWorker = (id, wid) => {
  set(workersKey(id), getWorkers(id).filter(w => w.id !== wid))
  set(wageLgsKey(id), getWageLogs(id).filter(l => l.workerId !== wid))
}
export const addWageLog  = (id, log) => {
  const list = getWageLogs(id)
  list.push({ ...log, id: uid() })
  set(wageLgsKey(id), list)
  return list
}
export const deleteWageLog = (id, lid) => {
  const list = getWageLogs(id).filter(l => l.id !== lid)
  set(wageLgsKey(id), list)
  return list
}

// ── Budgets ─────────────────────────────────────────────────
export const budgetsKey = id => `wb_budgets_${id}`
export const getBudgets = id => get(budgetsKey(id), {})
export const saveBudget = (id, cat, amount) => {
  const b = getBudgets(id)
  if (!amount || amount <= 0) delete b[cat]; else b[cat] = amount
  set(budgetsKey(id), b)
  return b
}

// ── Templates ────────────────────────────────────────────────
export const templatesKey  = id => `wb_templates_${id}`
export const getTemplates  = id => get(templatesKey(id))
export const saveTemplate  = (id, t) => {
  const list = getTemplates(id)
  const idx  = list.findIndex(x => x.id === t.id)
  if (idx >= 0) list[idx] = t; else list.push({ ...t, id: uid() })
  set(templatesKey(id), list)
  return list
}
export const deleteTemplate = (id, tid) => {
  const list = getTemplates(id).filter(t => t.id !== tid)
  set(templatesKey(id), list)
  return list
}
