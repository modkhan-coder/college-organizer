import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from './context/AppContext';
import { useEffect } from 'react';
import { setPushNavigate } from './utils/push';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import CourseDetails from './pages/CourseDetails';
import Assignments from './pages/Assignments';
import Planner from './pages/Planner';
import GPA from './pages/GPA';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';
import Integrations from './pages/Integrations';
import Achievements from './pages/Achievements';
import Wrapped from './pages/Wrapped';
import Invite from './pages/Invite';
import SocialNotifications from './pages/SocialNotifications';
import Social from './pages/Social';
import Focus from './pages/Focus';
import Calendar from './pages/Calendar';
import Help from './pages/Help';
import Feedback from './pages/Feedback';
import Admin from './pages/Admin';
import Privacy from './pages/Privacy';
import PricingPage from './pages/PricingPage';
import StudyStudio from './pages/StudyStudio';
import CourseHub from './pages/CourseHub';
import { TourProvider } from './context/TourContext';

import Onboarding from './pages/Onboarding';

import LandingPage from './pages/LandingPage';
import RequireAuth from './components/RequireAuth';
import PaymentSync from './components/PaymentSync';


function App() {
  const { user, loading, courses, assignments } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  // Register navigate with push notification handler for deep-link taps
  useEffect(() => {
    setPushNavigate(navigate);
  }, [navigate]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Loading...</div>;
  }

  // FORCE ONBOARDING: Check account metadata, context state, OR local cache fallback
  const localProfile = JSON.parse(localStorage.getItem('cached_student_profile') || '{}');
  const isSetupDone = user?.user_metadata?.onboarding_completed || user?.onboardingComplete || localProfile.onboardingComplete;

  if (user && !loading && !isSetupDone) {
    return <Onboarding />;
  }

  return (
    <TourProvider>
      <div className="app-container">
        <PaymentSync />
        <Routes>
          {/* Public Routes - NO SIDEBAR/LAYOUT */}
          <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />
          <Route path="/pricing" element={<PricingPage />} />

          {/* Protected Routes - WITH SIDEBAR/LAYOUT */}
          <Route path="/dashboard" element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><Layout><Admin /></Layout></RequireAuth>} />
          <Route path="/feedback" element={<RequireAuth><Layout><Feedback /></Layout></RequireAuth>} />
          <Route path="/help" element={<RequireAuth><Layout><Help /></Layout></RequireAuth>} />
          <Route path="/privacy" element={<RequireAuth><Layout><Privacy /></Layout></RequireAuth>} />
          <Route path="/courses" element={<RequireAuth><Layout><Courses /></Layout></RequireAuth>} />
          <Route path="/courses/:courseId" element={<RequireAuth><Layout><CourseDetails /></Layout></RequireAuth>} />
          <Route path="/courses/:courseId/hub" element={<RequireAuth><Layout><CourseHub /></Layout></RequireAuth>} />
          <Route path="/courses/:courseId/studio" element={<RequireAuth><Layout><StudyStudio /></Layout></RequireAuth>} />
          <Route path="/assignments" element={<RequireAuth><Layout><Assignments /></Layout></RequireAuth>} />
          <Route path="/planner" element={<RequireAuth><Layout><Planner /></Layout></RequireAuth>} />
          <Route path="/gpa" element={<RequireAuth><Layout><GPA /></Layout></RequireAuth>} />
          <Route path="/analytics" element={<RequireAuth><Layout><Analytics /></Layout></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Layout><Profile /></Layout></RequireAuth>} />
          <Route path="/integrations" element={<RequireAuth><Layout><Integrations /></Layout></RequireAuth>} />
          <Route path="/achievements" element={<RequireAuth><Layout><Achievements /></Layout></RequireAuth>} />
          <Route path="/wrapped" element={<RequireAuth><Layout><Wrapped /></Layout></RequireAuth>} />
          <Route path="/social" element={<RequireAuth><Layout><Social /></Layout></RequireAuth>} />
          <Route path="/focus" element={<RequireAuth><Layout><Focus /></Layout></RequireAuth>} />
          <Route path="/calendar" element={<RequireAuth><Layout><Calendar /></Layout></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><Layout><SocialNotifications /></Layout></RequireAuth>} />
          <Route path="/invite/:inviteId" element={<RequireAuth><Layout><Invite /></Layout></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </TourProvider>
  );
}

export default App;
