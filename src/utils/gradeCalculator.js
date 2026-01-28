export const calculateCourseGrade = (course, assignments) => {
    // 1. Filter assignments for this course
    const courseAssignments = assignments.filter(a => a.courseId === course.id);

    if (courseAssignments.length === 0) return { percent: null, letter: 'N/A' };

    // 2. Group by category
    const categories = course.categories || []; // e.g. [{id, name, weight}]
    let totalWeightedScore = 0;
    let totalWeightUsed = 0;

    categories.forEach(cat => {
        const catAssignments = courseAssignments.filter(a => a.categoryId === cat.id && a.pointsEarned !== undefined && a.pointsEarned !== null);

        if (catAssignments.length > 0) {
            // Calculate average for this category
            // Option A: Sum of points earned / Sum of points possible (Standard)
            // Option B: Average of percentages (Less common but simple)
            // Using Option A standard weighting
            let catPointsEarned = 0;
            let catPointsPossible = 0;

            catAssignments.forEach(a => {
                catPointsEarned += parseFloat(a.pointsEarned);
                catPointsPossible += parseFloat(a.pointsPossible);
            });

            if (catPointsPossible > 0) {
                const catPercent = catPointsEarned / catPointsPossible;
                totalWeightedScore += catPercent * cat.weight;
                totalWeightUsed += cat.weight;
            }
        }
    });

    // 3. Fallback: If graded assignments exist but no weights are used (e.g. weighted groups disabled)
    // calculate a simple unweighted average of all graded items.
    if (totalWeightUsed === 0) {
        let totalPointsEarned = 0;
        let totalPointsPossible = 0;
        let hasGrades = false;

        courseAssignments.forEach(a => {
            if (a.pointsEarned !== undefined && a.pointsEarned !== null && a.pointsEarned !== '') {
                totalPointsEarned += parseFloat(a.pointsEarned);
                totalPointsPossible += parseFloat(a.pointsPossible);
                hasGrades = true;
            }
        });

        if (!hasGrades || totalPointsPossible === 0) return { percent: null, letter: 'N/A' };

        const finalPercent = (totalPointsEarned / totalPointsPossible) * 100;
        return {
            percent: finalPercent,
            letter: getLetterGrade(finalPercent, course.gradingScale)
        };
    }

    // Normalize: if total weights don't sum to 100, normalize based on used weights?
    // User requirement: "weights don’t have to add to 100, your code normalizes them"
    // So usually we normalize relative to the TOTAL weights of categories that have grades.
    // Example: HW (50%) has grades, Final (50%) has NO grades. 
    // Current grade should be specific to the HW only? Or relative to the course total?
    // "Current Grade" usually means "How am I doing on what I've turned in".
    // So we normalize by totalWeightUsed.

    // However, if user puts weights 10, 10, 10 (total 30).
    // And they have grades in all. TotalWeightedScore will be e.g. 0.9*10 + 0.8*10 + ...
    // So we divide by totalWeightUsed.

    const finalPercent = (totalWeightedScore / totalWeightUsed) * 100;

    return {
        percent: finalPercent,
        letter: getLetterGrade(finalPercent, course.gradingScale)
    };
};

export const getLetterGrade = (percent, scale) => {
    let parsedScale = [];

    // Default Scale
    const defaultScale = [
        { min: 93, label: 'A' },
        { min: 90, label: 'A-' },
        { min: 87, label: 'B+' },
        { min: 83, label: 'B' },
        { min: 80, label: 'B-' },
        { min: 77, label: 'C+' },
        { min: 73, label: 'C' },
        { min: 70, label: 'C-' },
        { min: 60, label: 'D' },
        { min: 0, label: 'F' }
    ];

    if (!scale) {
        parsedScale = defaultScale;
    } else if (typeof scale === 'string') {
        // Parse user string: "A: 90-100" or "A: 90"
        try {
            parsedScale = scale.split('\n')
                .map(line => {
                    const parts = line.split(':');
                    if (parts.length < 2) return null;
                    const label = parts[0].trim();
                    const range = parts[1].trim();
                    // Extract the first number as the minimum (logic: "94-100" -> 94 is min)
                    // If multiple numbers, usually the first one or the smaller one? 
                    // User Example: "A: 94-100". Min is 94.
                    // "A-: 90-93". Min is 90.
                    // So we look for the *lowest* number in the range? 
                    // Actually, usually standard format is "Min-Max" or just "Min".
                    // Let's assume the first number found is the min, UNLESS the range is reversed?
                    // "94-100" -> 94. "A: 90+" -> 90.
                    // Regex to find numbers.
                    const numbers = range.match(/\d+(\.\d+)?/g);
                    if (!numbers) return null;
                    const val1 = parseFloat(numbers[0]);
                    const val2 = numbers.length > 1 ? parseFloat(numbers[1]) : val1;
                    return { label, min: Math.min(val1, val2) };
                })
                .filter(item => item !== null);

            // If parsing failed or empty, fallback
            if (parsedScale.length === 0) parsedScale = defaultScale;
        } catch (e) {
            console.error("Scale parsing error", e);
            parsedScale = defaultScale;
        }
    } else {
        // Already array
        parsedScale = scale;
    }

    // Sort scale descending by min
    const sortedScale = [...parsedScale].sort((a, b) => b.min - a.min);

    // Round per usual convention? Or strict? 
    // Usually strict unless specified. Apps often round to nearest whole number for display logic, 
    // but for "Is it an A?", 93.9 might not be 94. 
    // Let's stick to strict comparison >= min
    for (const grade of sortedScale) {
        if (percent >= grade.min) return grade.label;
    }
    return sortedScale[sortedScale.length - 1]?.label || 'F';
};
