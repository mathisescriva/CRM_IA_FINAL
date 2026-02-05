import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AppProvider, useApp } from './contexts/AppContext';
import { QuickTaskModal } from './components/QuickTaskModal';
import Dashboard from './pages/Index';
import { Kanban } from './pages/Kanban';
import { Directory } from './pages/Directory';
import { CompanyDetail } from './pages/CompanyDetail';
import { PeopleDirectory } from './pages/PeopleDirectory';
import { Inbox } from './pages/Inbox';
import { Toolbox } from './pages/Toolbox';
import { Login } from './pages/Login';
import { Settings } from './pages/Settings';
import { Calendar } from './pages/Calendar';
import Tasks from './pages/Tasks';
import { authService } from './services/auth';

// --- Auth Guard ---
const ProtectedRoute = () => {
    const user = authService.getCurrentUser();
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    return (
        <AppLayout>
            <Outlet />
        </AppLayout>
    );
};

// Global Modals Component
const GlobalModals = () => {
    const { isTaskModalOpen, closeTaskModal, taskModalCompanyId } = useApp();
    
    return (
        <>
            <QuickTaskModal 
                open={isTaskModalOpen} 
                onClose={closeTaskModal} 
                defaultCompanyId={taskModalCompanyId}
            />
        </>
    );
};

// Fallback component for Work In Progress routes
const WIP = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
    <h2 className="text-2xl font-bold mb-2">Construction Zone</h2>
    <p>The {title} module is coming soon.</p>
  </div>
);

const AppRoutes: React.FC = () => {
    return (
        <>
            <Routes>
                <Route path="/login" element={<Login />} />
                
                {/* Protected Routes */}
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
                    <Route path="/settings" element={<Settings />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <GlobalModals />
        </>
    );
};

const App: React.FC = () => {
    return (
        <HashRouter>
            <AppProvider>
                <AppRoutes />
            </AppProvider>
        </HashRouter>
    );
};

export default App;
