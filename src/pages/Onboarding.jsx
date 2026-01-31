import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User, School, BookOpen, GraduationCap, ArrowRight } from 'lucide-react';

const Onboarding = () => {
    const { user, saveUser, addNotification } = useApp();

    const [formData, setFormData] = useState({
        name: user?.name || '',
        school: user?.school || '',
        major: user?.major || '',
        gpaScale: user?.gpaScale || '4.0'
    });

    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.school || !formData.major) {
            addNotification('Please fill in your School and Major to continue.', 'error');
            return;
        }

        setLoading(true);
        try {
            await saveUser({
                ...user,
                ...formData,
                // Ensure profile is marked as 'started' implicitly by having these fields
            });
            addNotification('Profile Created! Welcome aboard 🚀', 'success');
            // App.jsx will automatically re-render and remove this screen once user updates
        } catch (error) {
            console.error(error);
            addNotification('Error saving profile.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            padding: '20px'
        }}>
            <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '40px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '80px', height: '80px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                        borderRadius: '50%', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', margin: '0 auto 24px', color: 'white',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                    }}>
                        <GraduationCap size={40} />
                    </div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '8px', background: 'linear-gradient(to right, var(--primary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Welcome, {user?.email?.split('@')[0] || 'Student'}!
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                        Let's set up your academic profile so we can help you succeed.
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    <div className="input-group">
                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <User size={16} color="var(--primary)" /> Full Name
                        </label>
                        <input
                            className="input-field"
                            placeholder="e.g. Alex Smith"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <School size={16} color="var(--primary)" /> School / University
                        </label>
                        <input
                            className="input-field"
                            placeholder="e.g. Stanford University"
                            value={formData.school}
                            onChange={e => setFormData({ ...formData, school: e.target.value })}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BookOpen size={16} color="var(--primary)" /> Major
                        </label>
                        <input
                            className="input-field"
                            placeholder="e.g. Computer Science"
                            value={formData.major}
                            onChange={e => setFormData({ ...formData, major: e.target.value })}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TargetIcon /> GPA Goal Scale
                        </label>
                        <select
                            className="input-field"
                            value={formData.gpaScale}
                            onChange={e => setFormData({ ...formData, gpaScale: e.target.value })}
                        >
                            <option value="4.0">4.0 Scale</option>
                            <option value="4.3">4.3 Scale</option>
                            <option value="5.0">5.0 Scale</option>
                            <option value="100">Percentage (0-100)</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{
                            marginTop: '12px',
                            padding: '16px',
                            fontSize: '1.1rem',
                            justifyContent: 'center',
                            opacity: loading ? 0.7 : 1
                        }}
                        disabled={loading}
                    >
                        {loading ? 'Saving Profile...' : 'Start My Journey'} <ArrowRight size={20} />
                    </button>

                </form>
            </div>
        </div>
    );
};

// Helper for icon (since Lucide exports might vary)
const TargetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
);

export default Onboarding;
