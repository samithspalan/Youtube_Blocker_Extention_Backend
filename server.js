require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Block = require('./models/Block'); // Import the schema

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Successfully connected to MongoDB!'))
    .catch((err) => console.error('MongoDB connection error:', err));

// Route 1: Get all blocks
app.get('/api/blocks', async (req, res) => {
    try {
        const blocks = await Block.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: blocks });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route 2: Report or increment a block
app.post('/api/blocks', async (req, res) => {
    const { handle } = req.body;
    
    if (!handle) {
        return res.status(400).json({ success: false, message: "Handle is required" });
    }

    try {
        // Find the channel, or create it if it doesn't exist (Upsert)
        const updatedBlock = await Block.findOneAndUpdate(
            { handle: handle },
            { $inc: { blockCount: 1 } }, // Increment the count by 1
            { new: true, upsert: true } // Return the new document, create if missing
        );
        
        console.log(`[API] Logged to Database: ${handle}`);
        res.status(201).json({ success: true, data: updatedBlock });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route 3: Check database connection status
app.get('/api/status', (req, res) => {
    const isConnected = mongoose.connection.readyState === 1;
    res.status(200).json({ success: true, dbConnected: isConnected });
});

// Mount Time spent tracking routes
app.use('/api/time', require('./routes/time'));

app.listen(PORT, () => {
    console.log(`Backend API running on http://localhost:${PORT}`);
});