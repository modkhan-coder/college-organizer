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
import { TourProvider } from './context/TourContext';

import Onboarding from './pages/Onboarding';

function App() {
  const { user, loading } = useApp();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Loading...</div>;
  }

  if (!user) {
    return <Auth />;
  }

  // FORCE ONBOARDING: Check if profile is complete
  // logic: if school or major is missing, force Onboarding page.
  const isProfileComplete = user.school && user.major;
  if (!isProfileComplete) {
    return <Onboarding />;
  }

  return (
    <TourProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:courseId" element={<CourseDetails />} />
          <Route path="/assignments" element={<Assignments />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/gpa" element={<GPA />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/wrapped" element={<Wrapped />} />
          <Route path="/social" element={<Social />} />
          <Route path="/focus" element={<Focus />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/help" element={<Help />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/notifications" element={<SocialNotifications />} />
          <Route path="/invite/:inviteId" element={<Invite />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </TourProvider>
  );
}

export default App;
