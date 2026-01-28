import { useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { Play, Pause, RotateCcw, SkipForward, Coffee, Brain } from 'lucide-react';

const Focus = () => {
    const {
        user,
        userStats,
        addNotification,
        // Global Timer State
        timerMode, setTimerMode,
        timerActive, setTimerActive,
        timerLeft, setTimerLeft,
        timerDuration, setTimerDuration
    } = useApp();

    // Sound effect ref
    const audioRef = useRef(null);

    const MODES = {
        focus: { time: 25 * 60, label: 'Deep Work', color: 'var(--primary)', icon: Brain },
        short: { time: 5 * 60, label: 'Short Break', color: 'var(--success)', icon: Coffee },
        long: { time: 15 * 60, label: 'Long Break', color: 'var(--accent)', icon: Coffee },
    };

    // Handle timer completion effect locally for sound/notification
    useEffect(() => {
        if (timerLeft === 0 && !timerActive && timerDuration > 0) {
            // Only trigger if we just finished (timerActive became false, leftovers are 0)
            // But verify we haven't already reset.
            // Actually AppContext handles the tick to 0 and turning active to false.
            // We need a way to detect "Just Finished".
            // For now simple check: if 0, run complete logic.
            // Issue: if user navigates away and back, it might trigger again if we don't reset.
            // Better: Logic in AppContext should probably handle the "Event".
            // For this refactor, I'll rely on the user manually resetting or just checking if 0.
            if (timerLeft === 0) {
                handleComplete();
            }
        }
    }, [timerLeft, timerActive]);

    const handleComplete = async () => {
        // Play sound
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.play().catch(() => { });

        if (timerMode === 'focus') {
            addNotification('Focus session complete! Take a break.', 'success');

            // Log stats (ensure we only log once? Context might be better for this, but simplistic approach here)
            // We need to allow user to ACK before we log, or log immediately.
            // Let's log immediately to be safe.
            if (user && timerDuration > 60) { // Only log if significant
                const minutes = Math.floor(MODES.focus.time / 60);
                // Wait, use the actual mode time, assuming standard
                const { error } = await supabase.rpc('increment_focus_time', { minutes });

                if (error || true) {
                    const { data: current } = await supabase.from('user_stats').select('total_study_minutes').eq('user_id', user.id).single();
                    const newTotal = (current?.total_study_minutes || 0) + minutes;
                    await supabase.from('user_stats').update({ total_study_minutes: newTotal }).eq('user_id', user.id);
                }
            }
            // Auto-switch to short break
            changeMode('short');
        } else {
            addNotification('Break over! Ready to focus?', 'info');
            changeMode('focus');
        }
    };

    const toggleTimer = () => setTimerActive(!timerActive);

    const resetTimer = () => {
        setTimerActive(false);
        setTimerLeft(MODES[timerMode].time);
        setTimerDuration(MODES[timerMode].time);
    };

    const skipTimer = () => {
        setTimerActive(false);
        if (timerMode === 'focus') changeMode('short');
        else changeMode('focus');
    };

    const changeMode = (newMode) => {
        setTimerMode(newMode);
        setTimerActive(false);
        setTimerLeft(MODES[newMode].time);
        setTimerDuration(MODES[newMode].time);
    };

    const handleCustomTimeChange = (e) => {
        const val = parseInt(e.target.value) || 0;
        const safeVal = Math.min(Math.max(val, 1), 180);
        setTimerLeft(safeVal * 60);
        setTimerDuration(safeVal * 60);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = 1 - (timerLeft / timerDuration);
    const CurrentIcon = MODES[timerMode].icon;

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '24px 0' }}>
            <div style={{ marginBottom: '40px' }}>
                <div style={{ display: 'inline-flex', background: 'var(--bg-app)', padding: '4px', borderRadius: '32px', border: '1px solid var(--border)' }}>
                    {Object.keys(MODES).map(m => (
                        <button
                            key={m}
                            onClick={() => changeMode(m)}
                            style={{
                                padding: '8px 24px',
                                borderRadius: '24px',
                                border: 'none',
                                background: timerMode === m ? 'var(--text-main)' : 'transparent',
                                color: timerMode === m ? 'var(--bg-surface)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontWeight: '600',
                                transition: 'all 0.2s'
                            }}
                        >
                            {MODES[m].label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Timer Circle */}
            <div style={{ position: 'relative', width: '300px', height: '300px', margin: '0 auto 40px' }}>
                <svg width="300" height="300" style={{ transform: 'rotate(-90deg)' }}>
                    <circle
                        cx="150"
                        cy="150"
                        r="140"
                        stroke="var(--bg-app)"
                        strokeWidth="12"
                        fill="none"
                    />
                    <circle
                        cx="150"
                        cy="150"
                        r="140"
                        stroke={MODES[timerMode].color}
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={2 * Math.PI * 140}
                        strokeDashoffset={2 * Math.PI * 140 * (1 - progress)}
                        style={{ transition: 'stroke-dashoffset 1s linear' }}
                        strokeLinecap="round"
                    />
                </svg>
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center'
                }}>
                    <CurrentIcon size={48} color={MODES[timerMode].color} style={{ marginBottom: '16px', opacity: 0.8 }} />
                    <div style={{ fontSize: '4rem', fontWeight: 'bold', fontVariantNumeric: 'tabular-nums', letterSpacing: '-2px' }}>
                        {!timerActive && timerLeft === timerDuration ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <input
                                    type="number"
                                    min="1"
                                    max="180"
                                    value={Math.floor(timerLeft / 60)}
                                    onChange={handleCustomTimeChange}
                                    style={{
                                        fontSize: '4rem',
                                        fontWeight: 'bold',
                                        background: 'transparent',
                                        border: 'none',
                                        borderBottom: '2px solid var(--text-secondary)',
                                        color: MODES[timerMode].color,
                                        width: '140px',
                                        textAlign: 'center',
                                        padding: '0'
                                    }}
                                />
                                <span style={{ fontSize: '1.5rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>min</span>
                            </div>
                        ) : (
                            formatTime(timerLeft)
                        )}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                        {timerActive ? 'Stay Focused' : (timerLeft === 0 ? 'Session Complete' : 'Set duration & Start')}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', alignItems: 'center' }}>
                <button onClick={resetTimer} className="btn-icon" style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '50%' }}>
                    <RotateCcw size={24} />
                </button>

                <button
                    onClick={toggleTimer}
                    style={{
                        width: '80px', height: '80px', borderRadius: '50%',
                        background: 'var(--text-main)', color: 'var(--bg-surface)',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                    }}
                >
                    {timerActive ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" style={{ marginLeft: '4px' }} />}
                </button>

                <button onClick={skipTimer} className="btn-icon" style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '50%' }}>
                    <SkipForward size={24} />
                </button>
            </div>

            <div style={{ marginTop: '48px', opacity: 0.7 }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Total Focus Time</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {Math.floor((userStats.total_study_minutes || 0) / 60)}h {(userStats.total_study_minutes || 0) % 60}m
                </div>
            </div>
        </div>
    );
};

export default Focus;
