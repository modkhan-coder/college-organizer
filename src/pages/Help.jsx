import { useState } from 'react';
import { BookOpen, Calendar, Users, Brain, Flame, Target, ChevronDown, ChevronRight, HelpCircle, Globe, BarChart2, PlayCircle } from 'lucide-react';
import { useTour } from '../context/TourContext';

const Help = () => {
    const [activeSection, setActiveSection] = useState('getting-started');
    const { startTour } = useTour();

    const sections = [
        {
            id: 'getting-started',
            title: 'Welcome to the Future of Studying 🚀',
            icon: <BookOpen size={20} />,
            content: (
                <div>
                    <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)', padding: '24px', borderRadius: '12px', color: 'white', marginBottom: '24px' }}>
                        <h3 style={{ marginTop: 0, fontSize: '1.5rem', color: 'white' }}>Your Academic Command Center</h3>
                        <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>College Org isn't just a calendar—it's your personal academic assistant. Let's get you set up to crush this semester.</p>

                        <button
                            onClick={startTour}
                            style={{
                                marginTop: '16px',
                                background: 'white',
                                color: 'var(--primary)',
                                border: 'none',
                                padding: '12px 24px',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                            }}
                        >
                            <PlayCircle size={20} />
                            Start Interactive Tour
                        </button>
                    </div>

                    <h4>🎯 First Steps to Success</h4>
                    <ul style={{ display: 'grid', gap: '12px', padding: 0, listStyle: 'none' }}>
                        <li style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <strong>1. Set Your Goals:</strong> Visit <strong>Profile</strong> to set your Major and GPA scale.
                        </li>
                        <li style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <strong>2. Add Your Courses:</strong> Go to <strong>Courses</strong>. Give each class a color—it makes your dashboard look amazing and helps you organize visually.
                        </li>
                        <li style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <strong>3. Sync or Import:</strong> Don't type manually! Check the <strong>Integrations</strong> guide to sync with Canvas/Blackboard.
                        </li>
                    </ul>
                </div>
            )
        },
        {
            id: 'courses',
            title: 'AI Tutors & Study Tools 🧠',
            icon: <Brain size={20} />,
            content: (
                <div>
                    <h3>Unlock Superhuman Study Speed with PDF Studio</h3>
                    <p>Stop drowning in PDFs. PDF Studio is your all-in-one AI learning center.</p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div className="card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--primary)' }}>
                            <h4 style={{ color: 'var(--primary)' }}>📚 PDF Studio</h4>
                            <p style={{ fontSize: '0.9rem' }}>Go to any Course {'>'} <strong>Docs</strong> tab {'>'} click <strong>"Open Studio"</strong> on any file. This is your command center.</p>
                        </div>
                        <div className="card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent)' }}>
                            <h4 style={{ color: 'var(--accent)' }}>📝 3 Modes</h4>
                            <p style={{ fontSize: '0.9rem' }}>Switch instantly between <strong>Quick Summary</strong>, <strong>Infinite Quiz</strong>, and <strong>Deep Chat</strong>.</p>
                        </div>
                    </div>

                    <h4>What can PDF Studio do?</h4>
                    <ul style={{ display: 'grid', gap: '12px', padding: 0, listStyle: 'none' }}>
                        <li style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                            <strong>📄 The Study Guide:</strong> Get a perfect chapter summary + key terms checklist in seconds.
                        </li>
                        <li style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                            <strong>❓ The Infinite Quiz:</strong> Generate unlimited practice questions from your actual lecture notes.
                        </li>
                        <li style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                            <strong>💬 Chat with Your Books:</strong> Ask specific questions like <em>"Explain quantum entanglement like I'm 5."</em>
                        </li>
                    </ul>

                    <div style={{ marginTop: '24px', background: '#f0fdf4', padding: '24px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                        <h4 style={{ marginTop: 0, color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🔮 Grade Predictor (Simulation Mode)
                        </h4>
                        <p style={{ color: '#14532d' }}><strong>"What do I need to get an A?"</strong> Stop guessing.</p>
                        <ol style={{ margin: '12px 0', paddingLeft: '20px', color: '#15803d' }}>
                            <li style={{ marginBottom: '8px' }}>Go to any <strong>Course Details</strong> page.</li>
                            <li style={{ marginBottom: '8px' }}>Toggle <strong>"Simulation Mode"</strong> to ON.</li>
                            <li>Enter hypothetical scores for your upcoming assignments.</li>
                        </ol>
                        <p style={{ margin: 0, color: '#14532d' }}>Watch as your <strong>Projected Grade</strong> updates in real-time. Plan your semester with precision!</p>
                    </div>
                </div>
            )
        },
        {
            id: 'integrations',
            title: 'Auto-Sync (LMS) 🔌',
            icon: <Globe size={20} />,
            content: (
                <div>
                    <h3>Files & Grades on Autopilot</h3>
                    <p>Connect your school account once, and never manually add an assignment again.</p>

                    <div style={{ background: '#f0f9ff', padding: '20px', borderRadius: '12px', border: '1px solid #bae6fd', color: '#0369a1' }}>
                        <strong>Where to find your "Access Token":</strong>
                        <ul style={{ margin: '12px 0 0 0', paddingLeft: '20px' }}>
                            <li style={{ marginBottom: '8px' }}><strong>Canvas:</strong> Account &rarr; Settings &rarr; "Approved Integrations" &rarr; + New Access Token.</li>
                            <li style={{ marginBottom: '8px' }}><strong>Blackboard:</strong> Tools / Personal Information &rarr; API Keys.</li>
                            <li><strong>Moodle:</strong> User Menu &rarr; Preferences &rarr; Security Keys.</li>
                        </ul>
                    </div>
                    <p style={{ marginTop: '16px', fontSize: '0.9rem' }}><em>Once connected, your assignments, due dates, and grades will magically appear in your Dashboard.</em></p>
                </div>
            )
        },
        {
            id: 'planner',
            title: 'Planner & Calendar 📅',
            icon: <Calendar size={20} />,
            content: (
                <div>
                    <h3>Never Miss a Deadline</h3>
                    <p>Your <strong>Planner</strong> is the master list of everything you need to do.</p>

                    <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <div style={{ padding: '8px', background: 'var(--bg-app)', borderRadius: '50%', marginTop: '4px' }}>🔄</div>
                            <div>
                                <strong>Recurring Tasks:</strong>
                                <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Set tasks to repeat <strong>Daily</strong> or <strong>Weekly</strong>. Perfect for discussion posts, gym sessions, or weekly quizzes.
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <div style={{ padding: '8px', background: 'var(--bg-app)', borderRadius: '50%', marginTop: '4px' }}>🔔</div>
                            <div>
                                <strong>Custom Reminders:</strong>
                                <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Add multiple reminders (e.g., "1 hour before", "1 day before") to any task. You'll get in-app notifications so you never forget.
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <div style={{ padding: '8px', background: 'var(--bg-app)', borderRadius: '50%', marginTop: '4px' }}>📲</div>
                            <div>
                                <strong>Calendar Subscription (Sync):</strong>
                                <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Click the <strong>Sync</strong> button to get your unique <strong>Calendar Feed URL</strong>. Paste this into Google Calendar, Outlook, or Apple Calendar to see your assignments alongside your personal life.
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <div style={{ padding: '8px', background: 'var(--bg-app)', borderRadius: '50%', marginTop: '4px' }}>📧</div>
                            <div>
                                <strong>Daily Email Digest:</strong>
                                <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Enable this in your <strong>Profile</strong> settings to wake up to a customized email summary of everything due today and tomorrow.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'analytics',
            title: 'Analytics & Rewards 📊',
            icon: <BarChart2 size={20} />,
            content: (
                <div>
                    <h3>Visualize Your Success</h3>
                    <p>Go to the <strong>Analytics</strong> tab to see where your time goes.</p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div className="card" style={{ background: 'var(--bg-surface)', textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem' }}>📈</div>
                            <strong>Study Trends</strong>
                            <p style={{ fontSize: '0.85rem' }}>See which days you study the most and track your efficiency.</p>
                        </div>
                        <div className="card" style={{ background: 'var(--bg-surface)', textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem' }}>🧠</div>
                            <strong>Grade Forecast</strong>
                            <p style={{ fontSize: '0.85rem' }}>See how your current grades stack up against your GPA goals.</p>
                        </div>
                    </div>

                    <h4>🏆 XP & Leveling System</h4>
                    <p>Visit the <strong>Dashboard</strong> to track your progress.</p>
                    <ul style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <li style={{ marginBottom: '8px' }}><strong>Complete a Task:</strong> +50 XP ⚡</li>
                        <li style={{ marginBottom: '8px' }}><strong>Grade an Assignment:</strong> +100 XP 📝</li>
                        <li style={{ marginBottom: '8px' }}><strong>Ace Bonus (&gt;90%):</strong> +50 XP Bonus 🌟</li>
                        <li><strong>Level Up:</strong> Every 500 XP unleashes a new badge!</li>
                    </ul>

                    <div style={{ marginTop: '16px', padding: '16px', borderRadius: '12px', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', color: 'black' }}>
                        <strong>🚀 Pro Tip:</strong>
                        <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
                            Upgrade to <strong>Pro</strong> or <strong>Premium</strong> to activate the <strong>2x Multiplier</strong>. You'll earn double XP for every action!
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: 'social',
            title: 'Social & Sharing 🏆',
            icon: <Users size={20} />,
            content: (
                <div>
                    <h3>Make Studying Competitive</h3>
                    <p>Studying doesn't have to be lonely. Gamify your semester!</p>
                    <ul>
                        <li><strong>Invite Friends:</strong> Create a squad in the <strong>Social</strong> tab.</li>
                        <li><strong>Share Schedules:</strong> "Are you free Tuesday?" &rarr; Just send them your Planner link!</li>
                        <li><strong>Streak Wars:</strong> See who can maintain the longest daily study streak.</li>
                    </ul>

                    <div style={{ marginTop: '24px', background: 'var(--bg-app)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📸 Share Your Wins
                        </h4>
                        <p style={{ marginBottom: '12px' }}>
                            Proud of your grades? Go to the <strong>GPA Calculator</strong> or <strong>Dashboard</strong> and click the <strong>"Share"</strong> button.
                        </p>
                        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                            It generates a beautiful, Instagram-ready card of your <strong>GPA</strong> or <strong>Streaks</strong> to show off to friends and family!
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: 'focus',
            title: 'Focus Mode (Pomodoro) ⏱️',
            icon: <Target size={20} />,
            content: (
                <div>
                    <h3>Deep Work, Zero Distractions</h3>
                    <p>When it's crunch time, go to <strong>Focus Mode</strong>.</p>
                    <ul style={{ background: 'var(--bg-app)', padding: '20px', borderRadius: '12px' }}>
                        <li style={{ marginBottom: '10px' }}><strong>The Timer persists</strong> globally. Start it, then navigate to your assignments. It keeps ticking.</li>
                        <li style={{ marginBottom: '10px' }}><strong>Tracks your stats.</strong> Every minute counts towards your "Total Study Time" achievement.</li>
                        <li><strong>Audio Alerts.</strong> You'll hear a satisfying "Beep" when your session is done.</li>
                    </ul>
                </div>
            )
        },
        {
            id: 'panic',
            title: 'The Panic Button 🚨',
            icon: <Flame size={20} color="var(--danger)" />,
            content: (
                <div>
                    <h3 style={{ color: 'var(--danger)' }}>Overwhelmed? Press Here.</h3>
                    <p>We built this for *that* moment when you have 5 assignments due and don't know where to start.</p>

                    <p><strong>What it does:</strong></p>
                    <ol>
                        <li>Scans all your incomplete assignments.</li>
                        <li>Calculates urgency based on <strong>Due Date + Grade Weight</strong>.</li>
                        <li>Generates a <strong>Survival Plan</strong>: A custom list of bite-sized tasks to get you out of the danger zone.</li>
                    </ol>
                    <p><em>It's not magic, but it feels like it.</em></p>
                </div>
            )
        }
    ];

    return (
        <div style={{
            height: 'calc(100vh - 100px)', // Fit within viewport, accounting for banner/padding
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            <div style={{ flexShrink: 0, paddingBottom: '24px' }}>
                <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                    <HelpCircle size={32} color="var(--primary)" />
                    User Guide
                </h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '1.1rem' }}>
                    Everything you need to know to crush your semester.
                </p>
            </div>

            <div style={{ display: 'flex', gap: '32px', flex: 1, overflow: 'hidden' }}>
                {/* Navigation - Independent Scroll */}
                <div style={{
                    width: '280px',
                    flexShrink: 0,
                    overflowY: 'auto',
                    paddingRight: '4px' // prevent scrollbar overlap visually
                }}>
                    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                        {sections.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setActiveSection(s.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    width: '100%',
                                    padding: '16px',
                                    border: 'none',
                                    borderLeft: activeSection === s.id ? '4px solid var(--primary)' : '4px solid transparent',
                                    background: activeSection === s.id ? 'var(--bg-app)' : 'white',
                                    color: activeSection === s.id ? 'var(--primary)' : 'var(--text-primary)',
                                    fontWeight: activeSection === s.id ? 'bold' : 'normal',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.2s',
                                    borderBottom: '1px solid var(--border-light)'
                                }}
                            >
                                {s.icon}
                                <span>{s.title}</span>
                                {activeSection === s.id && <ChevronRight size={16} style={{ marginLeft: 'auto' }} />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content - Independent Scroll */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    paddingRight: '12px', // Space for scrollbar
                    paddingBottom: '40px'
                }}>
                    {sections.map(s => (
                        <div
                            key={s.id}
                            style={{
                                display: activeSection === s.id ? 'block' : 'none',
                            }}
                            className="fade-in"
                        >
                            <div className="card" style={{ padding: '32px', minHeight: '400px', maxWidth: '800px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                                    <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--bg-app)', color: 'var(--primary)' }}>
                                        {s.icon}
                                    </div>
                                    <h2 style={{ margin: 0 }}>{s.title}</h2>
                                </div>
                                <div style={{ lineHeight: '1.6', fontSize: '1.05rem' }}>
                                    {s.content}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Help;
