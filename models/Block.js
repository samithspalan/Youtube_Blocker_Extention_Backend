const mongoose = require('mongoose');

const BlockSchema = new mongoose.Schema({
    handle: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    blockCount: {
        type: Number,
        default: 1
    }
}, { timestamps: true }); // Automatically adds createdAt and updatedAt dates

module.exports = mongoose.model('Block', BlockSchema);