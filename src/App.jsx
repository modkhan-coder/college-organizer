import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext';
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
import Privacy from './pages/Privacy';
import PricingPage from './pages/PricingPage';
import StudyStudio from './pages/StudyStudio';
import CourseHub from './pages/CourseHub';
import { TourProvider } from './context/TourContext';

import Onboarding from './pages/Onboarding';

import LandingPage from './pages/LandingPage';
import RequireAuth from './components/RequireAuth';

function App() {
  const { user, loading } = useApp();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Loading...</div>;
  }

  // FORCE ONBOARDING: Check if profile is complete (only if user logged in)
  if (user) {
    const isProfileComplete = user.school && user.major;
    if (!isProfileComplete) {
      return <Onboarding />;
    }
  }

  return (
    <TourProvider>
      <Layout>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/help" element={<Help />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/courses" element={<RequireAuth><Courses /></RequireAuth>} />
          <Route path="/courses/:courseId" element={<RequireAuth><CourseDetails /></RequireAuth>} />
          <Route path="/courses/:courseId/hub" element={<RequireAuth><CourseHub /></RequireAuth>} />
          <Route path="/courses/:courseId/studio" element={<RequireAuth><StudyStudio /></RequireAuth>} />
          <Route path="/assignments" element={<RequireAuth><Assignments /></RequireAuth>} />
          <Route path="/planner" element={<RequireAuth><Planner /></RequireAuth>} />
          <Route path="/gpa" element={<RequireAuth><GPA /></RequireAuth>} />
          <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/integrations" element={<RequireAuth><Integrations /></RequireAuth>} />
          <Route path="/achievements" element={<RequireAuth><Achievements /></RequireAuth>} />
          <Route path="/wrapped" element={<RequireAuth><Wrapped /></RequireAuth>} />
          <Route path="/social" element={<RequireAuth><Social /></RequireAuth>} />
          <Route path="/focus" element={<RequireAuth><Focus /></RequireAuth>} />
          <Route path="/calendar" element={<RequireAuth><Calendar /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><SocialNotifications /></RequireAuth>} />
          <Route path="/invite/:inviteId" element={<RequireAuth><Invite /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </TourProvider>
  );
}

export default App;
