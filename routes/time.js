const express = require('express');
const router = express.Router();
const TimeLog = require('../models/TimeLog');

// Helper to clean up any time log documents older than 7 days
async function performOldDataCleanup() {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7); // Go back 7 days
        const year = cutoffDate.getFullYear();
        const month = String(cutoffDate.getMonth() + 1).padStart(2, '0');
        const day = String(cutoffDate.getDate()).padStart(2, '0');
        const cutoffStr = `${year}-${month}-${day}`;
        
        // Delete logs where date string is lexicographically smaller than the cutoff YYYY-MM-DD
        const result = await TimeLog.deleteMany({ date: { $lt: cutoffStr } });
        if (result.deletedCount > 0) {
            console.log(`🧹 [Time Tracking Cleanup] Cleared ${result.deletedCount} old time log documents.`);
        }
    } catch (error) {
        console.error("🧹 [Time Tracking Cleanup] Error running clean up:", error);
    }
}

// Route 1: Log active duration on a channel
router.post('/log', async (req, res) => {
    const { channelName, category, durationMs, date } = req.body;
    
    if (!channelName || !category || typeof durationMs !== 'number') {
        return res.status(400).json({ success: false, message: "Missing required fields (channelName, category, durationMs)" });
    }

    // Default to today's date in YYYY-MM-DD if not provided
    const logDate = date || new Date().toISOString().split('T')[0];

    try {
        // Trigger active deletion of logs older than 7 days
        await performOldDataCleanup();

        let timeLog = await TimeLog.findOne({ date: logDate });
        
        if (!timeLog) {
            timeLog = new TimeLog({
                date: logDate,
                totalStudyTime: 0,
                totalDistractionTime: 0,
                channels: []
            });
        }

        // Find or insert the channel in the channels list
        const channelIndex = timeLog.channels.findIndex(
            c => c.name.toLowerCase() === channelName.toLowerCase()
        );

        if (channelIndex > -1) {
            timeLog.channels[channelIndex].timeSpent += durationMs;
            // Update the category if the heuristic classified it differently
            timeLog.channels[channelIndex].category = category;
        } else {
            timeLog.channels.push({
                name: channelName,
                category: category,
                timeSpent: durationMs
            });
        }

        // Increment the totals based on classification
        if (category === 'Study') {
            timeLog.totalStudyTime += durationMs;
        } else if (category === 'Distraction') {
            timeLog.totalDistractionTime += durationMs;
        }

        await timeLog.save();
        res.status(200).json({ success: true, data: timeLog });
    } catch (error) {
        console.error("Error logging time spent:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route 2: Get time analytics for frontend charts
router.get('/analytics', async (req, res) => {
    try {
        // Trigger active deletion of logs older than 7 days
        await performOldDataCleanup();

        const today = new Date();
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dailyTrend = [];

        // Build last 7 days of logs (from 6 days ago up to today)
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            
            const log = await TimeLog.findOne({ date: dateStr });
            
            const studyHours = log ? log.totalStudyTime / (1000 * 60 * 60) : 0;
            const distractionHours = log ? log.totalDistractionTime / (1000 * 60 * 60) : 0;
            const totalHours = studyHours + distractionHours;

            dailyTrend.push({
                date: dateStr,
                label: daysOfWeek[d.getDay()],
                studyTime: log ? log.totalStudyTime : 0,
                distractionTime: log ? log.totalDistractionTime : 0,
                totalTime: log ? (log.totalStudyTime + log.totalDistractionTime) : 0,
                // Hour-based units for clean Recharts display
                studyHours: parseFloat(studyHours.toFixed(2)),
                distractionHours: parseFloat(distractionHours.toFixed(2)),
                totalHours: parseFloat(totalHours.toFixed(2)),
                channels: log ? log.channels : []
            });
        }

        // Aggregate overall metrics across all dates
        const allLogs = await TimeLog.find();
        let totalStudy = 0;
        let totalDistraction = 0;
        const channelMap = new Map();

        allLogs.forEach(log => {
            totalStudy += log.totalStudyTime;
            totalDistraction += log.totalDistractionTime;

            log.channels.forEach(ch => {
                const key = ch.name.toLowerCase();
                if (channelMap.has(key)) {
                    const existing = channelMap.get(key);
                    existing.timeSpent += ch.timeSpent;
                } else {
                    channelMap.set(key, {
                        name: ch.name,
                        category: ch.category,
                        timeSpent: ch.timeSpent
                    });
                }
            });
        });

        const channelsList = Array.from(channelMap.values())
            .sort((a, b) => b.timeSpent - a.timeSpent);

        res.status(200).json({
            success: true,
            data: {
                dailyTrend,
                breakdown: {
                    study: totalStudy,
                    distraction: totalDistraction,
                    total: totalStudy + totalDistraction
                },
                channels: channelsList
            }
        });
    } catch (error) {
        console.error("Error retrieving time spent analytics:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
