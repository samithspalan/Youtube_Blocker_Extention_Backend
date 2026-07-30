const mongoose = require('mongoose');

const ChannelTimeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true, enum: ['Study', 'Distraction'] },
    timeSpent: { type: Number, default: 0 } // stored in milliseconds
});

const TimeLogSchema = new mongoose.Schema({
    date: {
        type: String, // YYYY-MM-DD format
        required: true,
        unique: true
    },
    totalStudyTime: {
        type: Number,
        default: 0
    },
    totalDistractionTime: {
        type: Number,
        default: 0
    },
    channels: [ChannelTimeSchema]
}, { timestamps: true });

TimeLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 }); // Expire after 7 days (7 * 24 * 3600 seconds)

module.exports = mongoose.model('TimeLog', TimeLogSchema);
