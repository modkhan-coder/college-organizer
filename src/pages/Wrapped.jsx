import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Award, Flame, Target, Clock, Timer, Moon, ChevronRight, ChevronLeft, X, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Wrapped = () => {
    const { user, courses, assignments, tasks, userStats } = useApp();
    const [currentSlide, setCurrentSlide] = useState(0);
    const navigate = useNavigate();

    const slides = [
        {
            title: "Your Academic Journey",
            content: `Hey ${user?.name?.split(' ')[0]}, let's look back at everything you accomplished this semester.`,
            icon: <Star size={100} color="var(--warning)" />,
            bg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
        },
        {
            title: "The Consistency King",
            content: `You maintained a peak streak of ${userStats?.best_streak || 0} days. Consistency is the secret to success.`,
            icon: <Flame size={100} color="#FF8E53" />,
            bg: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)'
        },
        {
            title: "Task Slayer",
            content: `You completed a total of ${userStats?.total_tasks_completed || 0} tasks. That's a lot of focus!`,
            icon: <Target size={100} color="#10b981" />,
            bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
        },
        {
            title: "The Overachiever",
            content: `With ${courses.length} courses on your plate, you didn't just survive—you thrived.`,
            icon: <Award size={100} color="#6366f1" />,
            bg: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
        },
        {
            title: "The Finish Line",
            content: `You're wrapping up with a ${userStats?.gpa || 'strong'} presence. Keep that momentum going.`,
            icon: <Trophy size={100} color="#fbbf24" />,
            bg: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)'
        }
    ];

    const nextSlide = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(currentSlide + 1);
        } else {
            navigate('/');
        }
    };

    const prevSlide = () => {
        if (currentSlide > 0) {
            setCurrentSlide(currentSlide - 1);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: slides[currentSlide].bg,
            zIndex: 9999, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', color: 'white',
            padding: '20px', transition: 'background 0.5s ease'
        }}>
            {/* Close */}
            <button onClick={() => navigate('/')} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.7 }}>
                <X size={32} />
            </button>

            {/* Progress Bar */}
            <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', height: '4px', display: 'flex', gap: '4px' }}>
                {slides.map((_, i) => (
                    <div key={i} style={{
                        flex: 1, background: i <= currentSlide ? 'white' : 'rgba(255,255,255,0.2)',
                        borderRadius: '2px', height: '100%'
                    }}></div>
                ))}
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.1, y: -20 }}
                    transition={{ duration: 0.5 }}
                    style={{ textAlign: 'center', maxWidth: '500px' }}
                >
                    <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'center' }}>
                        {slides[currentSlide].icon}
                    </div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '16px' }}>{slides[currentSlide].title}</h1>
                    <p style={{ fontSize: '1.25rem', opacity: 0.9, lineHeight: '1.6' }}>{slides[currentSlide].content}</p>
                </motion.div>
            </AnimatePresence>

            {/* Navigation Areas */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '30%', height: '100%', cursor: 'pointer' }} onClick={prevSlide}></div>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '70%', height: '100%', cursor: 'pointer' }} onClick={nextSlide}></div>

            <div style={{ position: 'absolute', bottom: '40px', display: 'flex', gap: '16px' }}>
                <button onClick={() => navigate('/')} className="btn" style={{ padding: '12px 32px', background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                    Skip Recap
                </button>
                {currentSlide === slides.length - 1 && (
                    <button onClick={() => navigate('/')} className="btn" style={{ padding: '12px 32px', background: 'white', color: 'black', fontWeight: 'bold' }}>
                        Back to Dashboard
                    </button>
                )}
            </div>
        </div>
    );
};

export default Wrapped;
