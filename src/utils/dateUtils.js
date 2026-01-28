// Helper to parse YYYY-MM-DD as local midnight
// Helper to parse YYYY-MM-DD as local midnight
const parseLocalDate = (dateString) => {
    if (!dateString) return new Date(); // Fallback
    if (typeof dateString !== 'string') return new Date(dateString); // Handle Date object

    // Handle ISO string (2026-05-05T...) or simple date (2026-05-05)
    // We only care about the date part for 'overdue' checks
    const cleanDate = dateString.split('T')[0];

    // Ensure it looks like a date
    if (!cleanDate.includes('-')) return new Date(cleanDate);

    const [y, m, d] = cleanDate.split('-').map(Number);
    return new Date(y, m - 1, d);
};

export const isOverdue = (dateString) => {
    if (!dateString) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = parseLocalDate(dateString);

    if (isNaN(date.getTime())) return false; // Invalid date is not overdue
    return date < today;
};

export const isToday = (dateString) => {
    if (!dateString) return false;
    const today = new Date();
    const date = parseLocalDate(dateString);
    return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
};

export const isTomorrow = (dateString) => {
    if (!dateString) return false;
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = parseLocalDate(dateString);
    return date.getDate() === tomorrow.getDate() &&
        date.getMonth() === tomorrow.getMonth() &&
        date.getFullYear() === tomorrow.getFullYear();
};

export const getDaysDifference = (dateString) => {
    if (!dateString) return 999;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = parseLocalDate(dateString);
    // Both are local midnight, so straight subtraction works
    const diffTime = date - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export const formatDate = (dateString, options = {}) => {
    if (!dateString) return '';
    if (typeof dateString !== 'string') {
        // Handle if it's already a Date object
        if (dateString instanceof Date) {
            return dateString.toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', ...options
            });
        }
        return '';
    }
    // Use parseLocalDate to ensure we display the intended calendar date
    return parseLocalDate(dateString).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', ...options
    });
}
