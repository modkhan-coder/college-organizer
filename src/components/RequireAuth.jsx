import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const RequireAuth = ({ children }) => {
    const { user, loading } = useApp();

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default RequireAuth;
