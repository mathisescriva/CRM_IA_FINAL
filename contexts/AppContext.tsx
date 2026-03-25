/**
 * Global App Context - Manages global state and modals
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

interface AppContextType {
    // Task Modal
    isTaskModalOpen: boolean;
    openTaskModal: (companyId?: string, projectId?: string) => void;
    closeTaskModal: () => void;
    taskModalCompanyId?: string;
    taskModalProjectId?: string;

    // Quick Log Modal
    isQuickLogOpen: boolean;
    openQuickLog: () => void;
    closeQuickLog: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [taskModalCompanyId, setTaskModalCompanyId] = useState<string | undefined>();
    const [taskModalProjectId, setTaskModalProjectId] = useState<string | undefined>();
    const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);

    const openTaskModal = useCallback((companyId?: string, projectId?: string) => {
        setTaskModalCompanyId(companyId);
        setTaskModalProjectId(projectId);
        setIsTaskModalOpen(true);
    }, []);

    const closeTaskModal = useCallback(() => {
        setIsTaskModalOpen(false);
        setTaskModalCompanyId(undefined);
        setTaskModalProjectId(undefined);
    }, []);

    const openQuickLog = useCallback(() => setIsQuickLogOpen(true), []);
    const closeQuickLog = useCallback(() => setIsQuickLogOpen(false), []);

    return (
        <AppContext.Provider value={{
            isTaskModalOpen,
            openTaskModal,
            closeTaskModal,
            taskModalCompanyId,
            taskModalProjectId,
            isQuickLogOpen,
            openQuickLog,
            closeQuickLog,
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within AppProvider');
    }
    return context;
};
