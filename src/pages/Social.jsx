import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { Users, UserPlus, Trophy, Activity, Clock, CheckCircle, Search, UserCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const Social = () => {
    const { user, connections, friendRequests, sendFriendRequest, respondToRequest, activities } = useApp();
    const [activeTab, setActiveTab] = useState('feed'); // feed, leaderboard, friends
    const [searchEmail, setSearchEmail] = useState('');
    const [friendsProfiles, setFriendsProfiles] = useState({});

    // Fetch profiles for connections
    useEffect(() => {
        const fetchProfiles = async () => {
            if (!connections || connections.length === 0) return;

            const friendIds = connections.map(c =>
                c.user_id === user.id ? c.target_user_id : c.user_id
            );
            const uniqueIds = [...new Set(friendIds)];

            if (uniqueIds.length === 0) return;

            const { data } = await supabase
                .from('profiles')
                .select('id, display_name, avatar_url, school, major')
                .in('id', uniqueIds);

            if (data) {
                const map = {};
                data.forEach(p => map[p.id] = p);
                setFriendsProfiles(map);
            }
        };

        fetchProfiles();
    }, [connections, user]);


    const handleSendRequest = async (e) => {
        e.preventDefault();
        if (!searchEmail) return;
        await sendFriendRequest(searchEmail);
        setSearchEmail('');
    };

    // Calculate Leaderboard (Mock logic since we don't aggregate study_activity fully in DB yet)
    // In a real app, we'd have a view or edge function to aggregate this.
    // Here we'll process the "activities" we have loaded (last 50).
    const leaderboard = (() => {
        const scores = {};
        // Initialize user
        scores[user.id] = { name: 'You', avatar: user.user_metadata?.avatar_url, minutes: 0, tasks: 0 };

        // Initialize friends
        Object.values(friendsProfiles).forEach(p => {
            scores[p.id] = { name: p.display_name, avatar: p.avatar_url, minutes: 0, tasks: 0 };
        });

        activities.forEach(act => {
            // Only count if user or friend
            if (scores[act.user_id]) {
                if (act.type === 'study_session') {
                    scores[act.user_id].minutes += (act.metadata?.minutes || 0);
                } else if (act.type === 'task') {
                    scores[act.user_id].tasks += 1;
                    scores[act.user_id].minutes += 30; // Estimate 30 mins per task for score
                }
            }
        });

        return Object.values(scores).sort((a, b) => b.minutes - a.minutes);
    })();

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '80px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Users size={28} className="text-primary" />
                    <h1 className="page-title" style={{ margin: 0 }}>Social</h1>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '4px', borderRadius: '12px' }}>
                    <button
                        onClick={() => setActiveTab('feed')}
                        style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeTab === 'feed' ? 'var(--bg-app)' : 'transparent', color: activeTab === 'feed' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: '500', cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center' }}
                    >
                        <Activity size={16} /> Feed
                    </button>
                    <button
                        onClick={() => setActiveTab('leaderboard')}
                        style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeTab === 'leaderboard' ? 'var(--bg-app)' : 'transparent', color: activeTab === 'leaderboard' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: '500', cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center' }}
                    >
                        <Trophy size={16} /> Rankings
                    </button>
                    <button
                        onClick={() => setActiveTab('friends')}
                        style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeTab === 'friends' ? 'var(--bg-app)' : 'transparent', color: activeTab === 'friends' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: '500', cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center' }}
                    >
                        <Users size={16} /> Friends
                    </button>
                </div>
            </div>

            {/* Content */}

            {activeTab === 'feed' && (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {activities.length === 0 ? (
                        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <Activity size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                            <p>No recent activity. Start studying or add friends!</p>
                        </div>
                    ) : (
                        activities.map(act => (
                            <div key={act.id} className="card" style={{ padding: '16px', display: 'flex', gap: '16px' }}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-app)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0
                                }}>
                                    {act.profiles?.avatar_url ? (
                                        <img src={act.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%' }} />
                                    ) : (
                                        <Users size={20} />
                                    )}
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                        <span style={{ fontWeight: '600' }}>{act.user_id === user.id ? 'You' : act.profiles?.display_name || 'Someone'}</span>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            {new Date(act.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p style={{ margin: '4px 0 0 0' }}>
                                        {act.type === 'task' && "Completed a task: "}
                                        {act.type === 'study_session' && "Finished a study session: "}
                                        {act.type === 'course_added' && "Started a new course: "}
                                        {act.type === 'assignment_completed' && "Ace! "}
                                        {act.details}
                                    </p>
                                    {act.metadata?.minutes && (
                                        <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', background: 'var(--bg-app)', padding: '2px 8px', borderRadius: '4px' }}>
                                            <Clock size={12} /> {act.metadata.minutes} mins
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'leaderboard' && (
                <div className="card" style={{ padding: '0' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', fontWeight: 'bold' }}>
                        This Week's Top Scholars
                    </div>
                    {leaderboard.map((entry, idx) => (
                        <div key={idx} style={{
                            padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            borderBottom: idx === leaderboard.length - 1 ? 'none' : '1px solid var(--border)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <span style={{
                                    width: '24px', height: '24px', borderRadius: '50%', background: idx < 3 ? 'var(--primary)' : 'var(--bg-app)',
                                    color: idx < 3 ? 'white' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 'bold', fontSize: '0.85rem'
                                }}>
                                    {idx + 1}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-app)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                                    }}>
                                        {entry.avatar ? <img src={entry.avatar} style={{ width: '100%' }} /> : <Users size={16} />}
                                    </div>
                                    <span style={{ fontWeight: '500' }}>{entry.name}</span>
                                </div>
                            </div>
                            <div style={{ fontWeight: '600', color: 'var(--primary)' }}>
                                {entry.minutes} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>pts</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'friends' && (
                <div style={{ display: 'grid', gap: '24px' }}>

                    {/* Add Friend */}
                    <div className="card" style={{ padding: '20px' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1.1rem' }}>Add Friend</h3>
                        <form onSubmit={handleSendRequest} style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type="email"
                                    placeholder="Enter friend's email..."
                                    value={searchEmail}
                                    onChange={e => setSearchEmail(e.target.value)}
                                    className="input-field"
                                    style={{ paddingLeft: '40px' }}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={!searchEmail}>
                                Send Request
                            </button>
                        </form>
                    </div>

                    {/* Share App / Invite */}
                    <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', color: 'white' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ padding: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%' }}>
                                <UserPlus size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Invite Friends to College Org</h3>
                                <p style={{ margin: '4px 0 0 0', opacity: 0.9, fontSize: '0.9rem' }}>Help your friends succeed too!</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                className="btn"
                                style={{ background: 'white', color: 'var(--primary)', border: 'none', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.origin);
                                    // We can't use addNotification here because it's not exposed in the component scope easily without restructuring props, 
                                    // but wait, we have addNotification from useApp? 
                                    // Actually checking line 8: const { ..., activities } = useApp(); 
                                    // I removed addNotification in step 776. I need to add it back or just use alert/toast.
                                    // Let's add it back in the next edit or just assume user knows.
                                    // Actually, I'll add a simple "Copied!" text change state if needed, but let's just do valid logic.
                                    alert('Link copied to clipboard!');
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                Copy Link
                            </button>
                            <a
                                href={`mailto:?subject=Join me on College Org!&body=Hey! I'm using College Org to manage my classes and grades. Check it out: ${window.location.origin}`}
                                className="btn"
                                style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                Email
                            </a>
                        </div>
                    </div>

                    {/* Invites */}
                    {friendRequests.length > 0 && (
                        <div>
                            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>Pending Requests</h3>
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {friendRequests.map(req => (
                                    <div key={req.id} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-app)', overflow: 'hidden' }}>
                                                {req.profiles?.avatar_url && <img src={req.profiles.avatar_url} style={{ width: '100%' }} />}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '600' }}>{req.profiles?.display_name || 'Unknown User'}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{req.profiles?.email}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => respondToRequest(req.id, 'accepted', req.sender_id)}>
                                                Accept
                                            </button>
                                            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => respondToRequest(req.id, 'rejected', req.sender_id)}>
                                                Ignore
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Friend List */}
                    <div>
                        <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>Your Connections ({Object.keys(friendsProfiles).length})</h3>
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {Object.values(friendsProfiles).map(friend => (
                                <div key={friend.id} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-app)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {friend.avatar_url ? <img src={friend.avatar_url} style={{ width: '100%' }} /> : <Users size={20} />}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '600' }}>{friend.display_name}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                {friend.school || 'Student'} • {friend.major || 'Undeclared'}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                                        <UserCheck size={16} /> Friend
                                    </div>
                                </div>
                            ))}
                            {Object.keys(friendsProfiles).length === 0 && (
                                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px', fontStyle: 'italic' }}>
                                    No friends yet. Add someone above!
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};

export default Social;
