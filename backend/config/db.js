const mongoose = require('mongoose');

const connectDB = async () => {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/crisis_detector';
    mongoose.set('strictQuery', false);

    try {
        await mongoose.connect(uri);
        console.log(`MongoDB Connected Successfully: ${uri}`);
    } catch (error) {
        console.warn('Direct MongoDB connection failed:', error.message);
        console.log('Attempting In-Memory MongoDB Fallback...');

        try {
            const { MongoMemoryServer } = require('mongodb-memory-server');
            const mongoServer = await MongoMemoryServer.create();
            const memoryUri = mongoServer.getUri();
            await mongoose.connect(memoryUri);
            console.log('MongoDB Connected via In-Memory Instance at:', memoryUri);
        } catch (memError) {
            console.error('All MongoDB connection options failed:', memError.message);
        }
    }
};

module.exports = connectDB;
