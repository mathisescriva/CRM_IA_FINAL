/**
 * Deals Page - Redirects to Projects (Deal = Project)
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Deals: React.FC = () => {
    const navigate = useNavigate();
    useEffect(() => { navigate('/projects', { replace: true }); }, [navigate]);
    return null;
};

export default Deals;
