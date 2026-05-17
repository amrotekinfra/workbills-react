import { useStore } from '../store'
import { SYS_CATS, getCatInfo } from '../lib/supabase'

export function useCategoryInfo() {
  const { customCats } = useStore()

  const ci = (name) => getCatInfo(name, customCats)

  const allCats = () => {
    const custom = customCats.filter(c => !SYS_CATS.find(sc => sc.n === c.n))
    return [...SYS_CATS, ...custom]
  }

  return { ci, allCats }
}
