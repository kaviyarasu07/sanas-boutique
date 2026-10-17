import { apiClient } from './client'

export interface Outlet { id: number; name: string; ownerName: string; address: string | null; mobileNumber: string; email: string; active: boolean }
export interface OutletPayload { name: string; ownerName: string; address?: string; mobileNumber: string; email: string; serviceIds?: number[] }
export interface OutletCreated extends Outlet { generatedPassword: string }
export interface OutletService { id: number; name: string; description: string | null; priceUnitId: number; priceUnitName: string; active: boolean; itemCount: number; allowed: boolean; module: OutletModuleKey }
export interface OutletServiceItem { id: number; serviceId: number; serviceName: string; priceUnitName: string; name: string; description: string | null; itemCode: string | null; price: number; parentQuantity: number | null; active: boolean; allowed: boolean; allocatedQuantity: number | null; bookingMode: BookingMode; module: OutletModuleKey; replacementValue: number | null; billingModuleId: number | null; billingModuleName: string | null }
export interface OutletServiceItemPage { content: OutletServiceItem[]; number: number; size: number; totalPages: number; totalElements: number }

export interface BillItem { itemName: string; itemCode: string | null; unitPrice: number; quantity: number; lineTotal: number }
export type OutletModuleKey = 'RENTAL' | 'PARLOUR' | 'SALES' | 'STITCHING' | 'CUSTOM'
/** A franchisor-created billing module as an outlet sees it. icon: bag, ring, flower, gift, star or tag. */
export interface OutletBillingModule { id: number; name: string; code: string; icon: string }
/** type CHALLAN = rental hand-over slip with no amount. advancePaid = advance used on this bill (stitching); balance = total - advancePaid. */
export interface Bill { id: number; billNumber: string; shopName: string; shopAddress: string | null; customerName: string; customerMobile: string; discount: number; subtotal: number; total: number; createdAt: string; items: BillItem[]; module: OutletModuleKey; type: 'BILL' | 'CHALLAN'; advancePaid: number; balance: number }
export interface CustomerDetail { id: number; name: string; mobileNumber: string; createdAt: string; billCount: number; totalSpent: number; lastBillAt: string | null }
export interface CustomerPage { content: CustomerDetail[]; page: number; size: number; totalPages: number; totalElements: number }
export interface BillPage { content: Bill[]; page: number; number?: number; size: number; totalPages: number; totalElements: number }

export interface OutletDashboardOutlet { id: number; name: string; ownerName: string; address: string | null; mobileNumber: string; email: string; active: boolean }

export interface AdminOutletSales { outletId: number; name: string; active: boolean; todayTotal: number; monthTotal: number }
export interface AdminSalesSummary { todayTotal: number; todayBills: number; monthTotal: number; totalOutlets: number; activeOutlets: number; outlets: AdminOutletSales[] }
export interface AdminOutletDashboard { outlet: Outlet; todayTotal: number; totalBillsToday: number }
export interface ServiceSales { serviceId: number; name: string; sales: number; units: number }
export interface OutletRank { outletId: number; name: string; sales: number; bills: number }
export interface PeriodSales { total: number; bills: number; topService: ServiceSales | null; services: ServiceSales[] }
export interface ReportCriteria { outletIds: number[]; serviceIds: number[]; from?: string; to?: string }
export interface ReportGroup { name: string; units: number; sales: number }
export interface ReportRow { createdAt: string; billNumber: string; outlet: string; customerName: string; customerMobile: string; service: string; item: string; itemCode: string | null; quantity: number; unitPrice: number; lineTotal: number }
export interface SalesReport { generatedAt: string; from: string | null; to: string | null; billCount: number; units: number; totalSales: number; byService: ReportGroup[]; byOutlet: ReportGroup[]; rows: ReportRow[] }
export interface SalesAnalytics { today: PeriodSales; month: PeriodSales; topOutletsToday: OutletRank[]; topOutletsMonth: OutletRank[] }

export const adminBillApi = {
  salesReport: (c: ReportCriteria) => apiClient.post<SalesReport>('/admin/reports/sales', c).then((r) => r.data),
  analytics: () => apiClient.get<SalesAnalytics>('/admin/analytics').then((r) => r.data),
  outletAnalytics: (outletId: number) => apiClient.get<SalesAnalytics>(`/admin/outlets/${outletId}/analytics`).then((r) => r.data),
  summary: () => apiClient.get<AdminSalesSummary>('/admin/sales-summary').then((r) => r.data),
  outletDashboard: (outletId: number) => apiClient.get<AdminOutletDashboard>(`/admin/outlets/${outletId}/dashboard`).then((r) => r.data),
  bills: (params: { outletId?: number; page?: number; search?: string; from?: string; to?: string }) => apiClient.get<BillPage>('/admin/bills', { params: { size: 50, ...params } }).then((r) => r.data),
}

export const outletApi = {
  list: () => apiClient.get<Outlet[]>('/outlets').then((r) => r.data),
  get: (id: number) => apiClient.get<Outlet>(`/outlets/${id}`).then((r) => r.data),
  create: (payload: OutletPayload) => apiClient.post<OutletCreated>('/outlets', payload).then((r) => r.data),
  update: (id: number, payload: OutletPayload) => apiClient.patch<Outlet>(`/outlets/${id}`, payload).then((r) => r.data),
  setActive: (id: number, active: boolean) => apiClient.patch<Outlet>(`/outlets/${id}/active`, { active }).then((r) => r.data),
  regeneratePassword: (id: number) => apiClient.post<OutletCreated>(`/outlets/${id}/regenerate-password`).then((r) => r.data),
}
export type BookingMode = 'RENTAL' | 'APPOINTMENT' | 'DELIVERY' | 'NONE'
export type BookingView = 'UPCOMING' | 'ACTIVE' | 'PAST'
export interface BookingItem { itemId: number; name: string; itemCode: string | null; serviceName: string; unitPrice: number; quantity: number }
export interface Booking { id: number; kind: 'RENTAL' | 'APPOINTMENT' | 'DELIVERY'; status: 'BOOKED' | 'HANDED_OVER' | 'COMPLETED' | 'CANCELLED'; customerName: string; customerMobile: string; startDate: string; startTime: string | null; expectedReturnDate: string | null; handedOverOn: string | null; returnedOn: string | null; notes: string | null; createdAt: string; items: BookingItem[]; estimatedAmount: number; bill: Bill | null; challan: Bill | null }
export interface BookingPage { content: Booking[]; page: number; size: number; totalPages: number; totalElements: number }
export interface BookingPayload { customerName: string; customerMobile: string; startDate: string; startTime?: string; expectedReturnDate?: string; items: { itemId: number; quantity: number }[]; notes?: string }
export interface Availability { available: boolean; reason: string | null; conflicts: { from: string; to: string; customerName: string; status: string }[] }

export const bookingApi = {
  list: (params: { view: BookingView; search?: string; page?: number }) => apiClient.get<BookingPage>('/outlet/me/bookings', { params }).then((r) => r.data),
  create: (payload: BookingPayload) => apiClient.post<Booking>('/outlet/me/bookings', payload).then((r) => r.data),
  availability: (itemId: number, from: string, to: string, quantity = 1) => apiClient.get<Availability>('/outlet/me/bookings/availability', { params: { itemId, from, to, quantity } }).then((r) => r.data),
  day: (date: string) => apiClient.get<Booking[]>('/outlet/me/bookings/day', { params: { date } }).then((r) => r.data),
  overdue: () => apiClient.get<Booking[]>('/outlet/me/bookings/overdue').then((r) => r.data),
  due: (mobile: string) => apiClient.get<Booking[]>('/outlet/me/bookings/due', { params: { mobile } }).then((r) => r.data),
  reschedule: (id: number, payload: { startDate: string; startTime?: string; expectedReturnDate?: string }) => apiClient.post<Booking>(`/outlet/me/bookings/${id}/reschedule`, payload).then((r) => r.data),
  handOver: (id: number, date?: string) => apiClient.post<Booking>(`/outlet/me/bookings/${id}/hand-over`, { date }).then((r) => r.data),
  returnRental: (id: number, date?: string, discount?: number) => apiClient.post<Booking>(`/outlet/me/bookings/${id}/return`, { date, discount }).then((r) => r.data),
  complete: (id: number, discount?: number) => apiClient.post<Booking>(`/outlet/me/bookings/${id}/complete`, { discount }).then((r) => r.data),
  cancel: (id: number) => apiClient.post<Booking>(`/outlet/me/bookings/${id}/cancel`).then((r) => r.data),
}

/** OWN: customer's own fabric; IN_HOUSE: in-house purchase (bought at the shop, optionally linked to that shop bill). */
export type FabricSource = 'OWN' | 'IN_HOUSE'
/** OPEN: has garments still to deliver; READY: open with at least one finished garment. */
export type StitchView = 'OPEN' | 'READY' | 'DELIVERED' | 'CANCELLED'
export type StitchItemStatus = 'NOT_STARTED' | 'STARTED' | 'FINISHED' | 'DELIVERED' | 'CANCELLED'
export interface StitchItem { id: number; garment: string; measurements: string | null; notes: string | null; amount: number | null; status: StitchItemStatus; deliveryDate: string; measuredOn: string | null; startedAt: string | null; finishedAt: string | null; deliveredAt: string | null; cancelledAt: string | null; cancelReason: string | null; billNumber: string | null }
export interface StitchPayment { id: number; kind: 'ADVANCE' | 'REFUND'; amount: number; keptAmount: number | null; refundNumber: string | null; reason: string | null; authorName: string; createdAt: string }
/** estimatedDeliveryDate = next delivery date. advanceAvailable = advancePaid - advanceUsed - refunded - kept. */
export interface StitchOrder { id: number; orderNumber: string; status: 'OPEN' | 'DELIVERED' | 'CANCELLED'; customerName: string; customerMobile: string; estimatedDeliveryDate: string; notes: string | null; createdAt: string; items: StitchItem[]; total: number; unpricedCount: number; advancePaid: number; advanceUsed: number; refunded: number; kept: number; advanceAvailable: number; bills: Bill[]; payments: StitchPayment[]; fabricSource: FabricSource; fabricBill: { id: number; billNumber: string; total: number; summary: string } | null }
export interface StitchPage { content: StitchOrder[]; page: number; size: number; totalPages: number; totalElements: number }
export interface StitchLogEntry { id: number; kind: 'CREATED' | 'STATUS' | 'EDIT' | 'ADVANCE' | 'DATE' | 'DELIVERED' | 'CANCELLED' | 'REFUND' | 'COMMENT'; message: string; garment: string | null; authorName: string; createdAt: string }
export interface StitchMeasurement { itemId: number; garment: string; measurements: string; measuredOn: string | null; orderNumber: string }
export interface StitchFabricBill { id: number; billNumber: string; total: number; summary: string; createdAt: string }
/** authorName: optional "Your name" shown in the order log. */
export interface StitchItemPayload { garment: string; measurements?: string; notes?: string; deliveryDate: string; amount?: number | null; copiedFromItemId?: number | null; authorName?: string }
export interface StitchPayload { customerName: string; customerMobile: string; notes?: string; items: StitchItemPayload[]; advance?: number; fabricSource?: FabricSource; fabricBillId?: number | null; authorName?: string }

const stitchUrl = '/outlet/me/stitching'
export const stitchApi = {
  list: (params: { view: StitchView; search?: string; page?: number }) => apiClient.get<StitchPage>(stitchUrl, { params }).then((r) => r.data),
  get: (id: number) => apiClient.get<StitchOrder>(`${stitchUrl}/${id}`).then((r) => r.data),
  lookup: (code: string) => apiClient.get<StitchOrder>(`${stitchUrl}/lookup`, { params: { code: code.trim() } }).then((r) => r.data),
  create: (payload: StitchPayload) => apiClient.post<StitchOrder>(stitchUrl, payload).then((r) => r.data),
  updateOrder: (id: number, payload: { notes?: string; fabricSource?: FabricSource; fabricBillId?: number | null; authorName?: string }) => apiClient.put<StitchOrder>(`${stitchUrl}/${id}`, payload).then((r) => r.data),
  addItem: (id: number, payload: StitchItemPayload) => apiClient.post<StitchOrder>(`${stitchUrl}/${id}/items`, payload).then((r) => r.data),
  updateItem: (id: number, itemId: number, payload: StitchItemPayload) => apiClient.put<StitchOrder>(`${stitchUrl}/${id}/items/${itemId}`, payload).then((r) => r.data),
  setStatus: (id: number, itemId: number, status: StitchItemStatus, authorName?: string) => apiClient.post<StitchOrder>(`${stitchUrl}/${id}/items/${itemId}/status`, { status, authorName }).then((r) => r.data),
  addAdvance: (id: number, amount: number, authorName?: string) => apiClient.post<StitchOrder>(`${stitchUrl}/${id}/advances`, { amount, authorName }).then((r) => r.data),
  deliver: (id: number, payload: { itemIds: number[]; prices?: { itemId: number; amount: number }[]; discount?: number; authorName?: string }) => apiClient.post<StitchOrder>(`${stitchUrl}/${id}/deliver`, payload).then((r) => r.data),
  cancel: (id: number, payload: { itemIds?: number[]; reason: string; comment?: string; authorName?: string }) => apiClient.post<StitchOrder>(`${stitchUrl}/${id}/cancel`, payload).then((r) => r.data),
  refund: (id: number, payload: { amount: number; reason?: string; authorName?: string }) => apiClient.post<StitchOrder>(`${stitchUrl}/${id}/refunds`, payload).then((r) => r.data),
  log: (id: number) => apiClient.get<StitchLogEntry[]>(`${stitchUrl}/${id}/log`).then((r) => r.data),
  comment: (id: number, text: string, authorName?: string) => apiClient.post<StitchLogEntry[]>(`${stitchUrl}/${id}/comments`, { text, authorName }).then((r) => r.data),
  measurements: (mobile: string) => apiClient.get<StitchMeasurement[]>(`${stitchUrl}/measurements`, { params: { mobile } }).then((r) => r.data),
  fabricBills: (mobile: string) => apiClient.get<StitchFabricBill[]>(`${stitchUrl}/fabric-bills`, { params: { mobile } }).then((r) => r.data),
  due: (date: string) => apiClient.get<StitchOrder[]>(`${stitchUrl}/due`, { params: { date } }).then((r) => r.data),
  day: (date: string) => apiClient.get<StitchOrder[]>(`${stitchUrl}/day`, { params: { date } }).then((r) => r.data),
  overdue: () => apiClient.get<StitchOrder[]>(`${stitchUrl}/overdue`).then((r) => r.data),
  upcoming: () => apiClient.get<StitchOrder[]>(`${stitchUrl}/upcoming`).then((r) => r.data),
}

// ---- Parlour (docs/features/parlour.md): services only, fixed prices, discount only.
export interface ParlourServiceGroup { serviceId: number; serviceName: string; items: { id: number; name: string; price: number; itemCode: string | null }[] }
/** status DONE = billed. autoCancelled = cancelled by the system ("Not done by end of day"). rescheduledTo / rescheduledFrom: booking numbers linked by "Cancel & reschedule". */
export interface ParlourAppointment { id: number; bookingNumber: string; status: 'BOOKED' | 'DONE' | 'CANCELLED'; autoCancelled: boolean; customerName: string; customerMobile: string; date: string; time: string | null; notes: string | null; createdAt: string; items: { itemId: number; name: string; serviceName: string; price: number; quantity: number }[]; estimate: number; bill: Bill | null; cancelReason: string | null; cancelledAt: string | null; rescheduledTo: string | null; rescheduledFrom: string | null }
export interface ParlourAppointmentPage { content: ParlourAppointment[]; page: number; size: number; totalPages: number; totalElements: number }
export type ParlourFilter = 'ALL' | 'BOOKED' | 'DONE' | 'CANCELLED' | 'NOT_DONE'
export interface BookingLogEntry { id: number; kind: 'CREATED' | 'EDIT' | 'DONE' | 'CANCELLED' | 'RESCHEDULED' | 'AUTO_CANCELLED' | 'COMMENT' | 'HANDED_OVER' | 'RETURNED' | 'REPAIR'; message: string; authorName: string; createdAt: string }
export interface ParlourLine { itemId: number; quantity: number }

const parlourUrl = '/outlet/me/parlour'
export const parlourApi = {
  services: () => apiClient.get<ParlourServiceGroup[]>(`${parlourUrl}/services`).then((r) => r.data),
  /** Walk-in (customer) or today's booked customer (bookingId). */
  bill: (payload: { customerName?: string; customerMobile?: string; lines: ParlourLine[]; discount?: number; bookingId?: number; authorName?: string }) => apiClient.post<Bill>(`${parlourUrl}/bills`, payload).then((r) => r.data),
  bills: (params: { search?: string; page?: number; from?: string; to?: string } = {}) => apiClient.get<BillPage>(`${parlourUrl}/bills`, { params: { page: 0, ...params } }).then((r) => r.data),
  book: (payload: { customerName: string; customerMobile: string; date: string; time: string; lines: ParlourLine[]; notes?: string; authorName?: string }) => apiClient.post<ParlourAppointment>(`${parlourUrl}/appointments`, payload).then((r) => r.data),
  day: (date: string) => apiClient.get<ParlourAppointment[]>(`${parlourUrl}/appointments/day`, { params: { date } }).then((r) => r.data),
  search: (params: { status: ParlourFilter; search?: string; page?: number }) => apiClient.get<ParlourAppointmentPage>(`${parlourUrl}/appointments`, { params }).then((r) => r.data),
  lookup: (code: string) => apiClient.get<ParlourAppointment>(`${parlourUrl}/appointments/lookup`, { params: { code: code.trim() } }).then((r) => r.data),
  get: (id: number) => apiClient.get<ParlourAppointment>(`${parlourUrl}/appointments/${id}`).then((r) => r.data),
  cancel: (id: number, payload: { reason: string; comment?: string; authorName?: string }) => apiClient.post<ParlourAppointment>(`${parlourUrl}/appointments/${id}/cancel`, payload).then((r) => r.data),
  /** Returns the new booking. */
  cancelAndReschedule: (id: number, payload: { date: string; time: string; authorName?: string }) => apiClient.post<ParlourAppointment>(`${parlourUrl}/appointments/${id}/cancel-and-reschedule`, payload).then((r) => r.data),
  log: (id: number) => apiClient.get<BookingLogEntry[]>(`${parlourUrl}/appointments/${id}/log`).then((r) => r.data),
  comment: (id: number, text: string, authorName?: string) => apiClient.post<BookingLogEntry[]>(`${parlourUrl}/appointments/${id}/comments`, { text, authorName }).then((r) => r.data),
}

// ---- Jewellery rental (docs/features/jewellery-rental-flow.md): price per day, days = return − take-away (min 1).
export interface RentalProduct { id: number; name: string; itemCode: string | null; serviceName: string; pricePerDay: number; inStock: number | null; replacementValue: number | null }
export interface RentalItem { itemId: number; name: string; itemCode: string | null; pricePerDay: number; quantity: number; addedQty: number; okQty: number | null; damagedQty: number | null; repairQty: number | null; missingQty: number | null; damageCharge: number | null; damageNote: string | null; missingCharge: number | null; replacementValue: number | null }
/** status: BOOKED (pre-booked), WITH_CUSTOMER, RETURNED (billed), CANCELLED; autoCancelled = not collected by the booked date. */
export interface RentalBooking { id: number; bookingNumber: string; status: 'BOOKED' | 'WITH_CUSTOMER' | 'RETURNED' | 'CANCELLED'; autoCancelled: boolean; customerName: string; customerMobile: string; startDate: string; returnDate: string; handedOverOn: string | null; returnedOn: string | null; notes: string | null; createdAt: string; items: RentalItem[]; days: number; estimate: number; challan: Bill | null; bill: Bill | null; cancelReason: string | null; rescheduledTo: string | null; rescheduledFrom: string | null }
export interface RentalBookingPage { content: RentalBooking[]; page: number; size: number; totalPages: number; totalElements: number }
export interface RentalDashboard { toCollect: RentalBooking[]; dueBack: RentalBooking[]; late: RentalBooking[]; underRepair: number }
export interface RentalRepair { id: number; itemId: number; itemName: string; itemCode: string | null; quantity: number; note: string | null; sentOn: string; bookingNumber: string | null; customerName: string | null }
export type RentalFilter = 'ALL' | 'BOOKED' | 'WITH_CUSTOMER' | 'RETURNED' | 'CANCELLED' | 'NOT_COLLECTED'
export interface RentalLine { itemId: number; quantity: number }
export interface RentalPiece { itemId: number; okQty: number; damagedQty: number; repairQty: number; missingQty: number; damageCharge?: number | null; damageNote?: string; missingCharge?: number | null }
export interface RentalBookPayload { customerName: string; customerMobile: string; startDate?: string; returnDate: string; lines: RentalLine[]; notes?: string; authorName?: string }

const rentalUrl = '/outlet/me/rental'
export const rentalApi = {
  products: (search = '') => apiClient.get<RentalProduct[]>(`${rentalUrl}/products`, { params: { search } }).then((r) => r.data),
  availability: (itemId: number, from: string, to: string, quantity = 1) => apiClient.get<Availability>(`${rentalUrl}/availability`, { params: { itemId, from, to, quantity } }).then((r) => r.data),
  dashboard: () => apiClient.get<RentalDashboard>(`${rentalUrl}/dashboard`).then((r) => r.data),
  book: (payload: RentalBookPayload) => apiClient.post<RentalBooking>(`${rentalUrl}/bookings`, payload).then((r) => r.data),
  /** Book for today and hand over at once; returns the booking with its challan. */
  rentNow: (payload: RentalBookPayload) => apiClient.post<RentalBooking>(`${rentalUrl}/bookings/rent-now`, payload).then((r) => r.data),
  day: (date: string) => apiClient.get<RentalBooking[]>(`${rentalUrl}/bookings/day`, { params: { date } }).then((r) => r.data),
  search: (params: { status: RentalFilter; search?: string; page?: number }) => apiClient.get<RentalBookingPage>(`${rentalUrl}/bookings`, { params }).then((r) => r.data),
  lookup: (code: string) => apiClient.get<RentalBooking>(`${rentalUrl}/bookings/lookup`, { params: { code: code.trim() } }).then((r) => r.data),
  get: (id: number) => apiClient.get<RentalBooking>(`${rentalUrl}/bookings/${id}`).then((r) => r.data),
  handOver: (id: number, payload: { returnDate: string; removeItemIds?: number[]; addItems?: RentalLine[]; authorName?: string }) => apiClient.post<RentalBooking>(`${rentalUrl}/bookings/${id}/hand-over`, payload).then((r) => r.data),
  returnRental: (id: number, payload: { discount?: number; items: RentalPiece[]; authorName?: string }) => apiClient.post<RentalBooking>(`${rentalUrl}/bookings/${id}/return`, payload).then((r) => r.data),
  cancel: (id: number, payload: { reason: string; comment?: string; authorName?: string }) => apiClient.post<RentalBooking>(`${rentalUrl}/bookings/${id}/cancel`, payload).then((r) => r.data),
  /** Returns the new booking. */
  cancelAndReschedule: (id: number, payload: { startDate: string; returnDate: string; authorName?: string }) => apiClient.post<RentalBooking>(`${rentalUrl}/bookings/${id}/cancel-and-reschedule`, payload).then((r) => r.data),
  log: (id: number) => apiClient.get<BookingLogEntry[]>(`${rentalUrl}/bookings/${id}/log`).then((r) => r.data),
  comment: (id: number, text: string, authorName?: string) => apiClient.post<BookingLogEntry[]>(`${rentalUrl}/bookings/${id}/comments`, { text, authorName }).then((r) => r.data),
  repairs: () => apiClient.get<RentalRepair[]>(`${rentalUrl}/repairs`).then((r) => r.data),
  backInStock: (id: number, authorName?: string) => apiClient.post<RentalRepair>(`${rentalUrl}/repairs/${id}/back-in-stock`, { authorName }).then((r) => r.data),
  bills: (params: { search?: string; page?: number; from?: string; to?: string } = {}) => apiClient.get<BillPage>(`${rentalUrl}/bills`, { params: { page: 0, ...params } }).then((r) => r.data),
}

export const outletServiceApi = {
  current: () => apiClient.get<OutletDashboardOutlet>('/outlet/me').then((r) => r.data),
  /** Modules this outlet may use (the services the franchisor gave it); drives the menu. */
  modules: () => apiClient.get<OutletModuleKey[]>('/outlet/me/modules').then((r) => r.data),
  /** Franchisor-created billing modules this outlet may use (each is its own menu item and bill list). */
  billingModules: () => apiClient.get<OutletBillingModule[]>('/outlet/me/billing-modules').then((r) => r.data),
  updateCurrent: (payload: { ownerName: string; address?: string; email: string }) => apiClient.patch<OutletDashboardOutlet>('/outlet/me', payload).then((r) => r.data),
  currentServices: () => apiClient.get<OutletService[]>('/outlet/me/services').then((r) => r.data),
  listCurrentItems: (serviceId: number, search = '', page = 0, size = 50) => apiClient.get<OutletServiceItemPage>(`/outlet/me/services/${serviceId}/items`, { params: { search, page, size } }).then((r) => r.data),
  createCurrentItem: (serviceId: number, payload: { name: string; description?: string; price: number; quantity?: number; replacementValue?: number | null }) => apiClient.post(`/outlet/me/services/${serviceId}/items`, payload).then((r) => r.data),
  updateCurrentItem: (serviceId: number, itemId: number, payload: { name: string; description?: string; price: number; quantity?: number; replacementValue?: number | null }) => apiClient.patch(`/outlet/me/services/${serviceId}/items/${itemId}`, payload).then((r) => r.data),
  setCurrentItemActive: (serviceId: number, itemId: number, active: boolean) => apiClient.patch(`/outlet/me/services/${serviceId}/items/${itemId}/active`, { active }).then((r) => r.data),
  searchItems: (search: string) => apiClient.get<OutletServiceItem[]>('/outlet/me/items', { params: { search } }).then((r) => r.data),
  /** Current details of one product from its scanned code (always fresh; 404 when it is not this outlet's product). */
  itemByCode: (code: string) => apiClient.get<OutletServiceItem>('/outlet/me/items/by-code', { params: { code: code.trim() } }).then((r) => r.data),
  customers: (params: { page?: number; search?: string } = {}) => apiClient.get<CustomerPage>('/outlet/me/bills/customer-list', { params: { page: 0, ...params } }).then((r) => r.data),
  customer: (id: number) => apiClient.get<CustomerDetail>(`/outlet/me/bills/customer-list/${id}`).then((r) => r.data),
  customerBills: (id: number, params: { page?: number; search?: string } = {}) => apiClient.get<BillPage>(`/outlet/me/bills/customer-list/${id}/bills`, { params: { page: 0, ...params } }).then((r) => r.data),
  salesReport: (c: ReportCriteria) => apiClient.post<SalesReport>('/outlet/me/bills/report', c).then((r) => r.data),
  analytics: () => apiClient.get<SalesAnalytics>('/outlet/me/bills/analytics').then((r) => r.data),
  todayTotal: () => apiClient.get<number>('/outlet/me/bills/today-total').then((r) => r.data),
  bills: (params: { page?: number; search?: string; from?: string; to?: string } = {}) => apiClient.get<BillPage>('/outlet/me/bills', { params: { page: 0, size: 50, ...params } }).then((r) => r.data),
  list: (outletId: number) => apiClient.get<OutletService[]>(`/outlets/${outletId}/services`).then((r) => r.data),
  setAllowed: (outletId: number, serviceId: number, allowed: boolean) => apiClient.patch<OutletService>(`/outlets/${outletId}/services/${serviceId}`, { allowed }).then((r) => r.data),
  listItems: (outletId: number, serviceId: number, search = '', page = 0, size = 10) => apiClient.get<OutletServiceItemPage>(`/outlets/${outletId}/services/${serviceId}/items`, { params: { search, page, size } }).then((r) => r.data),
}
