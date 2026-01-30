import React from 'react';

const LevelProgress = ({ xp = 0, level = 1, isPro = false }) => {
    const XP_PER_LEVEL = 500;

    // Calculate stats
    const xpIntoLevel = xp % XP_PER_LEVEL;
    const progressPercent = (xpIntoLevel / XP_PER_LEVEL) * 100;
    const xpNeeded = XP_PER_LEVEL - xpIntoLevel;

    return (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem', position: 'relative', overflow: 'hidden' }}>

            {/* 2x Boost Badge for Pros */}
            {isPro && (
                <div style={{
                    position: 'absolute',
                    top: '0',
                    right: '0',
                    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                    color: 'black',
                    padding: '4px 12px',
                    borderBottomLeftRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                    <span>⚡ 2x XP ACTIVE</span>
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>Level {level}</h3>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Scholar
                    </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                        {xpIntoLevel} <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>/ {XP_PER_LEVEL} XP</span>
                    </span>
                </div>
            </div>

            {/* Progress Bar Container */}
            <div style={{
                height: '10px',
                background: 'var(--bg-secondary)',
                borderRadius: '5px',
                overflow: 'hidden',
                position: 'relative'
            }}>
                {/* Fill */}
                <div style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
                    borderRadius: '5px',
                    transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 0 10px rgba(var(--primary-rgb), 0.5)'
                }} />
            </div>

            {/* Subtext */}
            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{xpNeeded} XP to Level {level + 1}</span>
                {!isPro && (
                    <span style={{ color: 'var(--text-secondary)', opacity: 0.8 }}>
                        Upgrade for <span style={{ color: '#FCD34D', fontWeight: 'bold' }}>2x XP</span>
                    </span>
                )}
            </div>
        </div>
    );
};

export default LevelProgress;
