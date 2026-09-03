import React, { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { DisclaimerGate } from './components/DisclaimerGate';
import { disclaimerAcknowledged } from './lib/corporate';
import { CartProvider } from './lib/cart';
import { I18nProvider } from './lib/i18n';
import { RequireAuth } from './components/RequireAuth';
import { LandingPage } from './pages/Landing';
import { CorporateCompanies } from './pages/corporate/Companies';
import { CorporateCompanyDetail } from './pages/corporate/CompanyDetail';
import { CorporateProfile } from './pages/corporate/Profile';
import { CorporateBoard } from './pages/corporate/Board';
import { CorporateGroupOverview } from './pages/corporate/GroupOverview';
import { CorporateNews } from './pages/corporate/News';
import { CorporateContacts } from './pages/corporate/Contacts';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { ForgotPasswordPage } from './pages/ForgotPassword';
import { ResetPasswordPage } from './pages/ResetPassword';
import { HomePage } from './pages/Home';
import { ShopPage } from './pages/Shop';
import { SubsidiariesPage } from './pages/Subsidiaries';
import { ProductDetailPage } from './pages/ProductDetail';
import { CartPage } from './pages/Cart';
import { OrdersPage } from './pages/Orders';
import { ConfirmDeliveryPage } from './pages/ConfirmDelivery';
import { InvoicesPage } from './pages/Invoices';
import { MakePaymentPage } from './pages/MakePayment';
import { SupportPage } from './pages/Support';
import { AccountPage } from './pages/Account';
import { ContentPage } from './pages/Page';

// "/" is the one route that behaves differently by auth state rather than
// being wholesale gated: a signed-in customer sees their dashboard; a
// signed-out visitor sees the full-page demonstration-disclaimer gate
// FIRST (a ~10-second hold + "I Understand, Continue", statements managed
// by admin staff — 30 August 2026), and only then the public Landing page.
// The acknowledgement is remembered per browser so a return visitor goes
// straight to the Landing page.
function RootPage() {
  const { customer } = useAuth();
  const [acked, setAcked] = useState(disclaimerAcknowledged);
  if (customer) return <HomePage />;
  if (!acked) return <DisclaimerGate onAccept={() => setAcked(true)} />;
  return <LandingPage />;
}

// The deep-link corporate marketing routes (/companies, /profile, …) send a
// signed-out, un-acknowledged visitor back through the disclaimer gate at
// "/" first; a signed-in customer and an acknowledged visitor pass through.
function CorporateRoute({ children }) {
  const { customer } = useAuth();
  if (!customer && !disclaimerAcknowledged()) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <I18nProvider>
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/page/:slug" element={<ContentPage />} />
            {/* Public corporate mini-site (29 August 2026) — no auth, but
                the disclaimer gate at "/" comes first for a new visitor. */}
            <Route path="/companies" element={<CorporateRoute><CorporateCompanies /></CorporateRoute>} />
            <Route path="/companies/:id" element={<CorporateRoute><CorporateCompanyDetail /></CorporateRoute>} />
            <Route path="/profile" element={<CorporateRoute><CorporateProfile /></CorporateRoute>} />
            <Route path="/governance/board" element={<CorporateRoute><CorporateBoard /></CorporateRoute>} />
            <Route path="/investors/overview" element={<CorporateRoute><CorporateGroupOverview /></CorporateRoute>} />
            <Route path="/investors/news" element={<CorporateRoute><CorporateNews /></CorporateRoute>} />
            <Route path="/contacts" element={<CorporateRoute><CorporateContacts /></CorporateRoute>} />
            <Route path="/" element={<RootPage />} />
            <Route
              path="/shop"
              element={
                <RequireAuth>
                  <ShopPage />
                </RequireAuth>
              }
            />
            <Route
              path="/subsidiaries"
              element={
                <RequireAuth>
                  <SubsidiariesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/shop/:id"
              element={
                <RequireAuth>
                  <ProductDetailPage />
                </RequireAuth>
              }
            />
            <Route
              path="/cart"
              element={
                <RequireAuth>
                  <CartPage />
                </RequireAuth>
              }
            />
            <Route
              path="/orders"
              element={
                <RequireAuth>
                  <OrdersPage />
                </RequireAuth>
              }
            />
            <Route
              path="/orders/:id/confirm"
              element={
                <RequireAuth>
                  <ConfirmDeliveryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/invoices"
              element={
                <RequireAuth>
                  <InvoicesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/invoices/pay"
              element={
                <RequireAuth>
                  <MakePaymentPage />
                </RequireAuth>
              }
            />
            <Route
              path="/support"
              element={
                <RequireAuth>
                  <SupportPage />
                </RequireAuth>
              }
            />
            <Route
              path="/account"
              element={
                <RequireAuth>
                  <AccountPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
    </I18nProvider>
  );
}
