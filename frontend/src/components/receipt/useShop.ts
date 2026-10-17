import { useEffect, useState } from 'react'
import { outletServiceApi } from '../../api/outletApi'
import { brand } from '../../config/brand'
import type { Shop } from './ReceiptParts'

/** Shop header for printed papers: the brand name and this outlet's name and address. */
export function useShop(): Shop {
  const [shop, setShop] = useState<Shop>({ name: brand.name, address: null })
  useEffect(() => {
    outletServiceApi.current().then((o) => setShop({ name: brand.name, address: [o.name, o.address].filter(Boolean).join(' · ') })).catch(() => undefined)
  }, [])
  return shop
}
