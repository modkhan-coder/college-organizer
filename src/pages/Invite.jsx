import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { UserPlus, Calendar, Shield, Users, ArrowRight } from 'lucide-react';

const Invite = () => {
    const { inviteId } = useParams();
    const { user, addNotification, acceptInvite } = useApp();
    const navigate = useNavigate();
    const [invite, setInvite] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const fetchInvite = async () => {
            const { data, error } = await supabase
                .from('invites')
                .select('*, profiles:creator_id(display_name, avatar_url, school)')
                .eq('id', inviteId)
                .eq('is_active', true)
                .single();

            if (error || !data) {
                addNotification('Invite not found or expired.', 'error');
                navigate('/dashboard');
            } else {
                setInvite(data);
            }
            setLoading(false);
        };

        if (inviteId) fetchInvite();
    }, [inviteId, navigate, addNotification]);

    const handleAccept = async () => {
        if (!user) {
            addNotification('Please create a profile start.', 'info');
            navigate('/profile');
            return;
        }

        setProcessing(true);
        try {
            const success = await acceptInvite(invite);
            if (success) {
                // Navigate based on invite type
                if (invite.type === 'schedule_share') navigate('/planner');
                else navigate('/dashboard');
            }
        } catch (e) {
            addNotification('Error accepting invite.', 'error');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>Loading invite...</div>;

    const creatorName = invite.profiles?.display_name || 'A student';
    const inviteTypeLabel = invite.type === 'schedule_share' ? 'view their schedule' :
        invite.type === 'study_group' ? 'join a study group' : 'pair up as accountability partners';

    return (
        <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{
                    width: '80px', height: '80px', background: 'var(--primary)',
                    borderRadius: '50%', margin: '0 auto 24px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: 'white'
                }}>
                    <UserPlus size={40} />
                </div>

                <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '16px' }}>
                    You're Invited!
                </h1>
                <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '32px' }}>
                    <strong>{creatorName}</strong> from {invite.profiles?.school || 'their school'} has invited you to {inviteTypeLabel}.
                </p>

                <div style={{ background: 'var(--bg-app)', padding: '24px', borderRadius: '16px', marginBottom: '32px', textAlign: 'left' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '12px' }}>What happens next?</h3>
                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <li style={{ display: 'flex', gap: '12px', fontSize: '0.9rem' }}>
                            <Shield size={18} className="text-success" />
                            <span>Privacy first: Only shared data will be visible.</span>
                        </li>
                        <li style={{ display: 'flex', gap: '12px', fontSize: '0.9rem' }}>
                            <Users size={18} className="text-primary" />
                            <span>Collaborate and stay organized together.</span>
                        </li>
                        <li style={{ display: 'flex', gap: '12px', fontSize: '0.9rem' }}>
                            <Calendar size={18} className="text-secondary" />
                            <span>Sync availability without manual back-and-forth.</span>
                        </li>
                    </ul>
                </div>

                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                    <button
                        onClick={handleAccept}
                        disabled={processing}
                        className="btn btn-primary"
                        style={{ padding: '12px 32px', fontSize: '1rem' }}
                    >
                        {processing ? 'Processing...' : 'Accept Invitation'} <ArrowRight size={18} style={{ marginLeft: '8px' }} />
                    </button>
                    <Link to="/dashboard" className="btn btn-secondary" style={{ padding: '12px 32px' }}>
                        Maybe Later
                    </Link>
                </div>
            </div>

            <p style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Powered by College Organizer • Privacy-first Habit Building
            </p>
        </div>
    );
};

export default Invite;
