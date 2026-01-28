import React, { createContext, useContext, useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useLocation, useNavigate } from 'react-router-dom';

const TourContext = createContext();

export const useTour = () => useContext(TourContext);

export const TourProvider = ({ children }) => {
    const driverObj = useRef(null);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        driverObj.current = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            doneBtnText: 'Finish',
            nextBtnText: 'Next',
            prevBtnText: 'Previous',
            onHighlightStarted: (element) => {
                // specific logic if needed when an element is highlighted
            }
        });
    }, []);

    const startTour = () => {
        if (!driverObj.current) return;

        // Ensure we are on the dashboard to start, or handle routing within steps
        // For simplicity, we'll assume the tour starts on the dashboard or guides users there
        if (location.pathname !== '/') {
            navigate('/');
            // Give a small delay for navigation to complete before starting driver
            setTimeout(() => launchDriver(), 500);
        } else {
            launchDriver();
        }
    };

    const launchDriver = () => {
        driverObj.current.setSteps([
            {
                element: '.sidebar-header', // We'll need to make sure this class exists or add an ID
                popover: {
                    title: 'Welcome to College Org! 🚀',
                    description: 'This is your new academic command center. Let us show you around.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#nav-dashboard',
                popover: {
                    title: 'Dashboard',
                    description: 'Your daily overview. See upcoming due dates, today\'s schedule, and your current GPA at a glance.',
                    side: 'right'
                }
            },
            {
                element: '#nav-courses',
                popover: {
                    title: 'Courses',
                    description: 'Manage your classes, syllabus, and grading scales here. Color-code them for organization!',
                    side: 'right'
                }
            },
            {
                element: '#nav-assignments',
                popover: {
                    title: 'Assignments',
                    description: 'Track every homework, quiz, and project. Connect Canvas/Blackboard to auto-sync this!',
                    side: 'right'
                }
            },
            {
                element: '#nav-planner',
                popover: {
                    title: 'Planner',
                    description: 'Drag-and-drop your tasks. Plan your study sessions like a pro.',
                    side: 'right'
                }
            },
            {
                element: '#btn-panic',
                popover: {
                    title: '🚨 The Panic Button',
                    description: 'Feeling overwhelmed? unexpected deadline? Click this. We will generate a survival plan for you.',
                    side: 'right'
                }
            },
            {
                element: '#nav-help',
                popover: {
                    title: 'Need Help?',
                    description: 'Come back here anytime to view guides or restart this tour.',
                    side: 'right'
                }
            }
        ]);

        driverObj.current.drive();
    };

    return (
        <TourContext.Provider value={{ startTour }}>
            {children}
        </TourContext.Provider>
    );
};
