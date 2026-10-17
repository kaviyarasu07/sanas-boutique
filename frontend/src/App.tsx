import { Navigate, Route, Routes } from 'react-router-dom'

import { LandingPage } from './pages/landing/LandingPage'
import { LoginPage } from './pages/auth/LoginPage'
import { SetupPage } from './pages/auth/SetupPage'
import { ChangePasswordPage } from './pages/auth/ChangePasswordPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { OverviewPage } from './pages/admin/OverviewPage'
import { OutletsPage } from './pages/admin/OutletsPage'
import { ServicesPage } from './pages/admin/catalog/ServicesPage'
import { BillingModulesPage } from './pages/admin/BillingModulesPage'
import { ServiceDetailPage } from './pages/admin/catalog/ServiceDetailPage'
import { OutletDetailPage } from './pages/admin/outlets/OutletDetailPage'
import { ReportsPage } from './pages/admin/ReportsPage'
import { SettingsPage } from './pages/admin/SettingsPage'
import { RequireRole } from './routes/RequireRole'
import { OutletLayout } from './pages/outlet/OutletLayout'
import { OutletDashboardPage } from './pages/outlet/OutletDashboardPage'
import { BillingPage } from './pages/outlet/BillingPage'
import { PriceCheckPage } from './pages/outlet/PriceCheckPage'
import { OutletServicesPage } from './pages/outlet/OutletServicesPage'
import { OutletProductsPage } from './pages/outlet/OutletProductsPage'
import { OutletReportsPage } from './pages/outlet/OutletReportsPage'
import { CustomersPage } from './pages/outlet/CustomersPage'
import { OutletAnalyticsPage } from './pages/outlet/OutletAnalyticsPage'
import { StitchingPage } from './pages/outlet/StitchingPage'
import { ParlourPage } from './pages/outlet/ParlourPage'
import { RentalPage } from './pages/outlet/RentalPage'
import { BillingModuleRoute, RequireModule } from './routes/RequireModule'
import { CustomerDetailPage } from './pages/outlet/CustomerDetailPage'
import { AdminBillsPage } from './pages/admin/AdminBillsPage'
import { AnalyticsPage } from './pages/admin/AnalyticsPage'
import { AdminOutletDashboardPage } from './pages/admin/outlets/AdminOutletDashboardPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireRole role="FRANCHISOR">
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="bills" element={<AdminBillsPage />} />
        <Route path="outlets" element={<OutletsPage />} />
        <Route path="outlets/:outletId" element={<OutletDetailPage />} />
        <Route path="outlets/:outletId/dashboard" element={<AdminOutletDashboardPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="services/:serviceId" element={<ServiceDetailPage />} />
        <Route path="billing-modules" element={<BillingModulesPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="/outlet" element={<RequireRole role="OUTLET"><OutletLayout /></RequireRole>}>
        <Route index element={<OutletDashboardPage />} />
        <Route path="services" element={<OutletServicesPage />} />
        <Route path="services/:serviceId/products" element={<OutletProductsPage />} />
        <Route path="billing" element={<RequireModule module="SALES"><BillingPage /></RequireModule>} />
        <Route path="price-check" element={<PriceCheckPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:customerId" element={<CustomerDetailPage />} />
        <Route path="reports" element={<OutletReportsPage />} />
        <Route path="analytics" element={<OutletAnalyticsPage />} />
        <Route path="stitching" element={<RequireModule module="STITCHING"><StitchingPage /></RequireModule>} />
        <Route path="parlour" element={<RequireModule module="PARLOUR"><ParlourPage /></RequireModule>} />
        <Route path="rental" element={<RequireModule module="RENTAL"><RentalPage /></RequireModule>} />
        <Route path="m/:moduleId" element={<BillingModuleRoute render={(m) => <BillingPage key={m.id} billingModule={m} />} />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
