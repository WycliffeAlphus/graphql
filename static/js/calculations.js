// calculations
/**
 * Calculates XP progress over time for module projects
 * @param {Array} transactions - Array of transaction objects
 * @returns {Array} - Array of objects with date and cumulative XP
 */
export function calculateXpProgress(transactions) {
    if (!transactions || !Array.isArray(transactions)) return [];

    const xpTransactions = transactions
        .filter(t => t.type === 'xp' && t.object?.type === 'project')
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    let cumulativeXp = 0;
    return xpTransactions.map(tx => {
        cumulativeXp += tx.amount;
        return {
            date: new Date(tx.createdAt).toLocaleDateString(),
            totalXp: cumulativeXp,
            totalXpMB: (cumulativeXp / 1000000).toFixed(2)
        };
    });
}

/**
 * Calculates XP earned per project
 * @param {Array} transactions - Array of transaction objects
 * @returns {Object} - Object mapping project name to total XP
 */
export function calculateXpByProject(transactions) {
    if (!transactions || !Array.isArray(transactions)) return {};

    return transactions
        .filter(t => t.type === 'xp' && t.object?.type === 'project')
        .reduce((acc, tx) => {
            const projectName = tx.object?.name || 'Unknown Project';
            acc[projectName] = (acc[projectName] || 0) + tx.amount;
            return acc;
        }, {});
}

/**
 * Calculates pass/fail counts for 'tester' type results
 * @param {Array} results - Array of result objects
 * @returns {Object} - Counts of passed and failed exercises
 */
export function calculatePassFailCounts(results) {
    if (!results || !Array.isArray(results)) {
        return { passed: 0, failed: 0, total: 0 };
    }

    const testedResults = results.filter(res => 
        res.type === 'tester' && res.grade !== null
    );

    return testedResults.reduce((acc, res) => {
        acc.total++;
        if (res.grade === 1) {
            acc.passed++;
        } else if (res.grade < 1 && res.grade >= 0) {
            acc.failed++;
        }
        return acc;
    }, { passed: 0, failed: 0, total: 0 });
}