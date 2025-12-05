// src/config/db.js
const mongoose = require('mongoose');

const DEFAULT_URI =`mongodb+srv://${process.env.DB}:${process.env.PASS}@cluster0.7eooxat.mongodb.net/CourseMaster?retryWrites=true&w=majority`;

if (!DEFAULT_URI) {
  console.error('MONGO_URI not set. Set process.env.MONGO_URI (or DB & PASS).');
}

const connectDB = async (opts = {}) => {
  const uri = opts.uri || DEFAULT_URI;
  if (!uri) throw new Error('MongoDB URI not provided');


  try {
    console.log('Connecting to MongoDB with Mongoose...');
    await mongoose.connect(uri);
    console.log('✔ Mongoose connected (readyState=%s)', mongoose.connection.readyState);
    return mongoose.connection;
  } catch (err) {
    console.error('MongoDB (Mongoose) connect error:', err.message);
    // Retry logic (simple)
    if ((opts.retryCount || 0) < (opts.maxRetries || 2)) {
      const next = (opts.retryCount || 0) + 1;
      console.log(`Retrying MongoDB connect (${next}) in 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
      return connectDB({ ...opts, retryCount: next, maxRetries: opts.maxRetries || 2 });
    }
    throw err;
  }
};

// helper to check connection state
const getConnectionState = () => mongoose.connection.readyState; // 0 disconnected, 1 connected, 2 connecting

module.exports = { connectDB, getConnectionState, mongoose };
