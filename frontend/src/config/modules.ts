import { useCallback, useEffect, useState } from 'react'
import { IconBuildingStore, IconCircleDot, IconDiamond, IconFlower, IconGift, IconScissors, IconShoppingBag, IconSparkles, IconStar, IconTag, type Icon } from '@tabler/icons-react'
import { outletServiceApi, type OutletBillingModule, type OutletModuleKey } from '../api/outletApi'

/**
 * The outlet modules in one place: menu name, icon, page and order. An outlet sees only the modules
 * of the services the franchisor gave it (GET /outlet/me/modules and /outlet/me/billing-modules);
 * the server refuses the others.
 */
export const MODULES: { key: OutletModuleKey; label: string; path: string; icon: Icon }[] = [
  { key: 'RENTAL', label: 'Jewellery rental', path: '/outlet/rental', icon: IconDiamond },
  { key: 'PARLOUR', label: 'Parlour', path: '/outlet/parlour', icon: IconSparkles },
  { key: 'STITCHING', label: 'Stitching', path: '/outlet/stitching', icon: IconScissors },
  { key: 'SALES', label: 'Shop sales', path: '/outlet/billing', icon: IconBuildingStore },
]
export const moduleLabel = (key: OutletModuleKey) => MODULES.find((m) => m.key === key)?.label ?? key

/** Icons the franchisor can pick for a billing module (names stored on the server). */
export const BILLING_ICONS: { value: string; label: string; icon: Icon }[] = [
  { value: 'bag', label: 'Bag', icon: IconShoppingBag },
  { value: 'ring', label: 'Ring', icon: IconCircleDot },
  { value: 'flower', label: 'Flower', icon: IconFlower },
  { value: 'gift', label: 'Gift', icon: IconGift },
  { value: 'star', label: 'Star', icon: IconStar },
  { value: 'tag', label: 'Tag', icon: IconTag },
]
export const billingIcon = (name: string): Icon => BILLING_ICONS.find((i) => i.value === name)?.icon ?? IconTag
export const billingModulePath = (id: number) => `/outlet/m/${id}`

interface Loaded { modules: OutletModuleKey[]; billing: OutletBillingModule[] }

// One request pair per login, shared by the menu, the dashboard and the module pages. Keyed by the
// login token, so signing in as another outlet always loads that outlet's modules. A failed request
// is not kept: the next use (or "Try again") asks again.
let cached: { token: string | null; promise: Promise<Loaded> } | null = null
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fetchAll = () => Promise.all([outletServiceApi.modules(), outletServiceApi.billingModules()]).then(([modules, billing]) => ({ modules, billing }))

function load(): Promise<Loaded> {
  const token = localStorage.getItem('accessToken')
  if (cached?.token !== token) {
    // One automatic retry covers a backend that is just restarting.
    const promise = fetchAll().catch(() => sleep(1500).then(fetchAll))
    cached = { token, promise }
    promise.catch(() => { if (cached?.promise === promise) cached = null })
  }
  return cached!.promise
}

export interface OutletModulesState {
  /** Built-in modules; null while loading */
  modules: OutletModuleKey[] | null
  /** Franchisor-created billing modules; null while loading */
  billingModules: OutletBillingModule[] | null
  /** true when the lists could not be loaded (show an error with "Try again", never an empty menu) */
  failed: boolean
  retry: () => void
}

/** This outlet's modules, with loading and error states. */
export function useOutletModulesState(): OutletModulesState {
  const [data, setData] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setFailed(false)
    load().then((d) => { if (!cancelled) setData(d) }).catch(() => { if (!cancelled) { setData(null); setFailed(true) } })
    return () => { cancelled = true }
  }, [attempt])
  const retry = useCallback(() => { cached = null; setData(null); setAttempt((n) => n + 1) }, [])
  return { modules: data?.modules ?? null, billingModules: data?.billing ?? null, failed, retry }
}

/** Just the built-in list (null while loading or after an error). */
export function useOutletModules(): OutletModuleKey[] | null {
  return useOutletModulesState().modules
}

/** Forget the cached lists (after logout). */
export function resetOutletModules() {
  cached = null
}
