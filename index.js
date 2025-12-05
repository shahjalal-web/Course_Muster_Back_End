// server.js
require('dotenv').config(); // env আগে লোড করুন
const app = require('./app'); // app থেকে express অ্যাপ নিন
const { connectDB } = require('./src/config/db');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // DB connect
    await connectDB();
    console.log('✔ MongoDB connected');

    // Server start
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port: ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
