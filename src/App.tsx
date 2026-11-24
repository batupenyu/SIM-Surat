/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CorrespondenceDashboard } from './components/CorrespondenceDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function AppShell() {
  const { user, authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-base font-semibold font-display text-slate-900">
            TataSurat
          </p>
          <p className="text-xs text-slate-500">
            Memuat sesi persuratan digital...
          </p>
        </div>
      </div>
    );
  }

  return user ? <CorrespondenceDashboard /> : <LoginScreen />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ErrorBoundary>
  );
}
