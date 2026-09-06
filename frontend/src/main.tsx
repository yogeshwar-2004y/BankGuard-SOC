import { Component, StrictMode, Suspense, lazy, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth';
import { queryClient } from './lib/api';
import { Button, Card, Loading } from './components/ui';
import './styles.css';
const AppShell = lazy(() => import('./components/AppShell'));
const Login = lazy(() => import('./pages/Login'));
const Overview = lazy(() => import('./pages/Overview'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Events = lazy(() => import('./pages/EventExplorer'));
const Incidents = lazy(() => import('./pages/Incidents'));
const IncidentDetail = lazy(() => import('./pages/IncidentDetail'));
const Simulation = lazy(() => import('./pages/Simulation'));
const Banking = lazy(() => import('./pages/Banking'));
const Detections = lazy(() => import('./pages/Detections'));
const Operations = lazy(() => import('./pages/Operations'));
function Protected({ role }: { role?: 'soc' | 'admin' }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (role === 'soc' && user.role === 'customer') return <Navigate to="/banking" replace />;
  if (role === 'admin' && user.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="p-10">
        <Card>
          <h1 className="text-xl">This view could not be loaded.</h1>
          <p className="my-4 text-muted">Reload the workspace to reconnect to BankGuard.</p>
          <Button onClick={() => window.location.reload()}>Reload workspace</Button>
        </Card>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<Protected />}>
                  <Route element={<AppShell />}>
                    <Route index element={<Overview />} />
                    <Route path="banking" element={<Banking />} />
                    <Route path="banking/transactions" element={<Banking />} />
                    <Route path="banking/beneficiaries" element={<Banking />} />
                    <Route element={<Protected role="soc" />}>
                      <Route path="soc/dashboard" element={<Dashboard />} />
                      <Route path="soc/events" element={<Events />} />
                      <Route path="soc/hunting" element={<Events />} />
                      <Route path="soc/incidents" element={<Incidents />} />
                      <Route path="soc/incidents/:incidentId" element={<IncidentDetail />} />
                      <Route path="soc/detections" element={<Detections />} />
                      <Route path="simulation" element={<Simulation />} />
                      {[
                        'soc/alerts',
                        'soc/reports',
                        'soc/playbooks',
                        'soc/threat-intel',
                        'response/history',
                        'simulation/history',
                        'system/audit',
                      ].map((p) => (
                        <Route key={p} path={p} element={<Operations key={p} />} />
                      ))}
                    </Route>
                    <Route element={<Protected role="admin" />}>
                      {['system/health', 'system/users'].map((p) => (
                        <Route key={p} path={p} element={<Operations key={p} />} />
                      ))}
                    </Route>
                    <Route
                      path="*"
                      element={
                        <Card>
                          <h1 className="text-xl">Page not found</h1>
                          <a href="/" className="mt-4 inline-block text-brand">
                            Return to overview
                          </a>
                        </Card>
                      }
                    />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
