import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Calendar, BookOpen, TrendingUp, Shield, Zap } from 'lucide-react';

const LandingPage = () => {
    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-main)' }}>
            {/* Navbar */}
            <nav style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BookOpen size={28} /> College Organizer
                </div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <Link to="/pricing" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: '500' }}>Pricing</Link>
                    <Link to="/login" className="btn btn-primary" style={{ textDecoration: 'none' }}>Log In</Link>
                </div>
            </nav>

            {/* Hero Section */}
            <header style={{ padding: '80px 20px', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
                <h1 style={{ fontSize: '3.5rem', fontWeight: '900', lineHeight: '1.2', marginBottom: '24px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Your Entire Semester.<br />Organized.
                </h1>
                <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '40px', lineHeight: '1.6' }}>
                    The all-in-one productivity platform for students. Track grades, manage assignments, and sync with Canvas—all in one place.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                    <Link to="/login" className="btn btn-primary" style={{ padding: '16px 32px', fontSize: '1.1rem', borderRadius: '30px' }}>
                        Get Started for Free
                    </Link>
                    <Link to="/pricing" className="btn btn-secondary" style={{ padding: '16px 32px', fontSize: '1.1rem', borderRadius: '30px', background: 'var(--bg-surface)' }}>
                        View Plans
                    </Link>
                </div>
            </header>

            {/* Features Grid */}
            <section style={{ padding: '60px 20px', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                    <FeatureCard
                        icon={<TrendingUp size={32} color="var(--success)" />}
                        title="Grade Forecasting"
                        description="Stop guessing. Our Grade Calculator tells you exactly what you need on the final to keep your A."
                    />
                    <FeatureCard
                        icon={<Calendar size={32} color="var(--primary)" />}
                        title="Smart Calendar"
                        description="Import your syllabus automatically or sync with Canvas to never miss a due date."
                    />
                    <FeatureCard
                        icon={<Zap size={32} color="var(--warning)" />}
                        title="AI Study Tools"
                        description="Chat with your PDFs, generate quizzes, and get instant study plans powered by AI."
                    />
                </div>
            </section>

            {/* Social Proof / Trust */}
            <section style={{ padding: '80px 20px', background: 'var(--bg-surface)', textAlign: 'center' }}>
                <h2 style={{ fontSize: '2rem', marginBottom: '40px' }}>Why Students Love Us</h2>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap' }}>
                    <Stat number="10k+" label="Assignments Tracked" />
                    <Stat number="4.0" label="Goal GPA Support" />
                    <Stat number="24/7" label="AI Availability" />
                </div>
            </section>

            {/* CTA */}
            <section style={{ padding: '80px 20px', textAlign: 'center' }}>
                <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', color: 'white', borderRadius: '24px', padding: '60px 20px', maxWidth: '1000px', margin: '0 auto' }}>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '20px' }}>Ready to Ace This Semester?</h2>
                    <p style={{ fontSize: '1.2rem', opacity: 0.9, marginBottom: '40px' }}>Join thousands of students organizing their academic life today.</p>
                    <Link to="/login" className="btn" style={{ background: 'white', color: 'var(--primary)', padding: '16px 40px', fontSize: '1.1rem', borderRadius: '30px', border: 'none', fontWeight: 'bold' }}>
                        Create Free Account
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', borderTop: '1px solid var(--border)' }}>
                <p>&copy; {new Date().getFullYear()} College Organizer. All rights reserved.</p>
                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
                    <Link to="/privacy" style={{ color: 'var(--text-secondary)' }}>Privacy Policy</Link>
                    <Link to="/help" style={{ color: 'var(--text-secondary)' }}>Support</Link>
                </div>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, description }) => (
    <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start' }}>
        <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px' }}>{icon}</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{title}</h3>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>{description}</p>
    </div>
);

const Stat = ({ number, label }) => (
    <div>
        <div style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--primary)' }}>{number}</div>
        <div style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{label}</div>
    </div>
);

export default LandingPage;
