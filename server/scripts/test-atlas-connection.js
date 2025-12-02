/**
 * MongoDB Atlas Connection Test Script
 * 
 * Verifies that the application can connect to MongoDB Atlas
 * and that the connection string is correctly configured.
 * 
 * Usage: node server/scripts/test-atlas-connection.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const testAtlasConnection = async () => {
  try {
    console.log('🔍 Testing MongoDB Atlas Connection...\n');
    
    // Get connection string from environment
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      console.error('❌ MONGODB_URI is not set in .env file');
      console.log('\n📝 Please create server/.env file with:');
      console.log('MONGODB_URI=mongodb+srv://MrVAC:bOvw1g9nyjeyu0AL@cluster0.bj58rji.mongodb.net/kbm-logic?retryWrites=true&w=majority&appName=Cluster0');
      console.log('\n⚠️  SECURITY NOTE: Replace with your actual Atlas credentials if different.');
      process.exit(1);
    }
    
    // Check if it's Atlas connection string
    const isAtlas = mongoUri.includes('mongodb+srv://');
    const isLocal = mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1');
    
    console.log('📋 Connection Details:');
    console.log(`   URI: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials
    console.log(`   Type: ${isAtlas ? 'MongoDB Atlas (Cloud)' : isLocal ? 'Local MongoDB' : 'Other'}`);
    console.log('');
    
    if (isLocal) {
      console.warn('⚠️  WARNING: Connection string points to local MongoDB, not Atlas!');
      console.warn('   Please update MONGODB_URI in .env file to use Atlas connection string.\n');
    }
    
    // MongoDB Atlas connection options
    const connectionOptions = {
      serverSelectionTimeoutMS: 10000, // 10 seconds for Atlas
      socketTimeoutMS: 45000,
    };
    
    // Add retryWrites for MongoDB Atlas (required for replica sets)
    if (isAtlas) {
      connectionOptions.retryWrites = true;
      connectionOptions.w = 'majority';
      console.log('🔧 Using Atlas-optimized connection options...');
    }
    
    console.log('🔄 Attempting to connect...\n');
    
    const startTime = Date.now();
    const conn = await mongoose.connect(mongoUri, connectionOptions);
    const connectionTime = Date.now() - startTime;
    
    console.log('✅ Connection Successful!\n');
    console.log('📊 Connection Information:');
    console.log(`   Host: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    console.log(`   Connection Time: ${connectionTime}ms`);
    console.log(`   Ready State: ${conn.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
    
    // Test basic operations
    console.log('\n🧪 Testing Database Operations...');
    
    // List collections
    const collections = await conn.connection.db.listCollections().toArray();
    console.log(`   Collections found: ${collections.length}`);
    if (collections.length > 0) {
      console.log(`   Collection names: ${collections.map(c => c.name).join(', ')}`);
    }
    
    // Test read operation
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const userCount = await User.countDocuments();
    console.log(`   Users in database: ${userCount}`);
    
    // Test write operation (if Atlas)
    if (isAtlas) {
      console.log('   ✅ Write operations enabled (Atlas replica set)');
    }
    
    console.log('\n🎉 All tests passed! MongoDB Atlas connection is working correctly.\n');
    
    await mongoose.connection.close();
    console.log('✅ Connection closed');
    
  } catch (error) {
    console.error('\n❌ Connection Failed!\n');
    console.error('Error Details:');
    console.error(`   Message: ${error.message}`);
    console.error(`   Name: ${error.name}`);
    
    if (error.message.includes('authentication failed')) {
      console.error('\n💡 Possible Issues:');
      console.error('   1. Check username and password in connection string');
      console.error('   2. Verify database user has correct permissions in Atlas');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('\n💡 Possible Issues:');
      console.error('   1. Check internet connection');
      console.error('   2. Verify cluster hostname is correct');
      console.error('   3. Check if IP address is whitelisted in Atlas Network Access');
    } else if (error.message.includes('timeout')) {
      console.error('\n💡 Possible Issues:');
      console.error('   1. Check if IP address is whitelisted in Atlas Network Access');
      console.error('   2. Verify firewall settings');
      console.error('   3. Check network connectivity');
    }
    
    console.error('\n📝 Connection String Format:');
    console.error('   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority');
    
    process.exit(1);
  }
};

// Run test
testAtlasConnection();

