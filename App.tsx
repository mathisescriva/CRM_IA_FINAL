import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AppProvider, useApp } from './contexts/AppContext';
import { QuickTaskModal } from './components/QuickTaskModal';
import { Loader2 } from 'lucide-react';
import { authService } from './services/auth';

// Code splitting - lazy load pages
const Dashboard = React.lazy(() => import('./pages/Index'));
const Kanban = React.lazy(() => import('./pages/Kanban').then(m => ({ default: m.Kanban })));
const Directory = React.lazy(() => import('./pages/Directory').then(m => ({ default: m.Directory })));
const CompanyDetail = React.lazy(() => import('./pages/CompanyDetail').then(m => ({ default: m.CompanyDetail })));
const PeopleDirectory = React.lazy(() => import('./pages/PeopleDirectory').then(m => ({ default: m.PeopleDirectory })));
const Inbox = React.lazy(() => import('./pages/Inbox').then(m => ({ default: m.Inbox })));
const Toolbox = React.lazy(() => import('./pages/Toolbox').then(m => ({ default: m.Toolbox })));
const Login = React.lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Settings = React.lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Calendar = React.lazy(() => import('./pages/Calendar').then(m => ({ default: m.Calendar })));
const Tasks = React.lazy(() => import('./pages/Tasks'));
const Deals = React.lazy(() => import('./pages/Deals'));
const Projects = React.lazy(() => import('./pages/Projects'));
const Analytics = React.lazy(() => import('./pages/Analytics'));
const EmailTemplates = React.lazy(() => import('./pages/EmailTemplates'));

// Loading fallback with skeleton
const PageLoader = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
    </div>
);

// Auth Guard
const ProtectedRoute = () => {
    const user = authService.getCurrentUser();
    if (!user) return <Navigate to="/login" replace />;
    return (
        <AppLayout>
            <Suspense fallback={<PageLoader />}>
                <Outlet />
            </Suspense>
        </AppLayout>
    );
};

// Global Modals
const GlobalModals = () => {
    const { isTaskModalOpen, closeTaskModal, taskModalCompanyId, taskModalProjectId } = useApp();
    return <QuickTaskModal open={isTaskModalOpen} onClose={closeTaskModal} defaultCompanyId={taskModalCompanyId} defaultProjectId={taskModalProjectId} />;
};

const AppRoutes: React.FC = () => (
    <>
        <Routes>
            <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
            
            <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/kanban" element={<Kanban />} />
                <Route path="/directory" element={<Directory />} />
                <Route path="/annuaire" element={<PeopleDirectory />} />
                <Route path="/company/:id" element={<CompanyDetail />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/toolbox" element={<Toolbox />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/deals" element={<Deals />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/templates" element={<EmailTemplates />} />
                <Route path="/settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <GlobalModals />
    </>
);

const App: React.FC = () => (
    <HashRouter>
        <AppProvider>
            <AppRoutes />
        </AppProvider>
    </HashRouter>
);

export default App;
