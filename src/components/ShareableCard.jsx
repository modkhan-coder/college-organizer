import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, Share2, Eye, EyeOff, Flame, Trophy, Award } from 'lucide-react';

const ShareableCard = ({ type, data, user }) => {
    const cardRef = useRef(null);
    const [isAnonymized, setIsAnonymized] = useState(true);
    const [showSchool, setShowSchool] = useState(false);
    const [generating, setGenerating] = useState(false);

    const handleDownload = async () => {
        if (cardRef.current === null) return;
        setGenerating(true);
        try {
            const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = `college-organizer-${type}-${new Date().getTime()}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Oops, something went wrong!', err);
        } finally {
            setGenerating(false);
        }
    };

    const getCardContent = () => {
        switch (type) {
            case 'streak':
                return {
                    title: "Consistent & Crushing It",
                    value: `${data.streak} DAY STREAK`,
                    subtext: `Completed ${data.tasks} tasks this week`,
                    icon: <Flame size={48} color="white" fill="white" />,
                    bg: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)'
                };
            case 'gpa':
                return {
                    title: "Academic Milestone",
                    value: `${data.gpa} GPA`,
                    subtext: `Targeting excellence in ${data.courses} courses`,
                    icon: <Award size={48} color="white" />,
                    bg: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
                };
            default:
                return {
                    title: "My Progress",
                    value: "Hard work pays off",
                    subtext: "",
                    icon: <Trophy size={48} color="white" />,
                    bg: 'var(--primary)'
                };
        }
    };

    const content = getCardContent();
    const schoolName = user?.school?.toUpperCase() || user?.email?.split('@')[1]?.split('.')[0]?.toUpperCase() || 'MY UNIVERSITY';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Card Preview (The thing we record) */}
            <div ref={cardRef} style={{
                width: '400px',
                height: '400px',
                background: content.bg,
                color: 'white',
                padding: '40px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderRadius: '24px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
            }}>
                {/* Decoration */}
                <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '150px', height: '150px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}></div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <p style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.8rem', opacity: 0.9 }}>{content.title}</p>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '8px 0', lineHeight: '1.1' }}>{content.value}</h2>
                    </div>
                    {content.icon}
                </div>

                <div>
                    {showSchool && <p style={{ fontWeight: 'bold', margin: '0 0 4px 0', fontSize: '1rem' }}>🏫 {schoolName}</p>}
                    <p style={{ margin: 0, opacity: 0.9, fontSize: '1.1rem' }}>{content.subtext}</p>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>MADE WITH <span style={{ color: '#fff' }}>COLLEGE ORGANIZER</span></div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>collegeorganizer.app</div>
                </div>
            </div>

            {/* Controls */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setShowSchool(!showSchool)} className="btn btn-secondary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {showSchool ? <EyeOff size={14} /> : <Eye size={14} />} {showSchool ? 'Hide School' : 'Show School'}
                    </button>
                    <button onClick={handleDownload} disabled={generating} className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <Download size={18} /> {generating ? 'Generating...' : 'Download Card'}
                    </button>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, textAlign: 'center' }}>
                    Ready to share with friends or on Instagram Stories?
                </p>
            </div>
        </div>
    );
};

export default ShareableCard;
