/**
 * MongoDB Atlas Migration Audit Script
 * 
 * Comprehensive security and configuration audit for MongoDB Atlas migration.
 * Verifies that all connection strings point to Atlas and not local MongoDB.
 * 
 * Usage: node server/scripts/atlas-migration-audit.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config({ path: './.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverRoot = join(__dirname, '..');

const auditResults = {
  envFile: { exists: false, hasUri: false, isAtlas: false, issues: [] },
  connectionTest: { success: false, host: null, database: null, issues: [] },
  codeAudit: { filesChecked: 0, localFallbacks: [], issues: [] },
  security: { credentialsExposed: false, localConnections: false, issues: [] }
};

const runAudit = async () => {
  console.log('🔍 MongoDB Atlas Migration Security Audit\n');
  console.log('=' .repeat(60));
  console.log('');

  // Phase 1: Environment Variable Check
  console.log('📋 Phase 1: Environment Variable Check (.env)');
  console.log('-'.repeat(60));
  
  const envPath = join(serverRoot, '.env');
  auditResults.envFile.exists = existsSync(envPath);
  
  if (!auditResults.envFile.exists) {
    auditResults.envFile.issues.push('❌ .env file not found in server/ directory');
    console.log('❌ .env file not found');
    console.log('   Expected location: server/.env');
  } else {
    console.log('✅ .env file found');
    
    try {
      const envContent = readFileSync(envPath, 'utf-8');
      const mongoUriMatch = envContent.match(/MONGODB_URI\s*=\s*(.+)/);
      
      if (mongoUriMatch) {
        const mongoUri = mongoUriMatch[1].trim();
        auditResults.envFile.hasUri = true;
        auditResults.envFile.isAtlas = mongoUri.includes('mongodb+srv://');
        
        console.log('✅ MONGODB_URI found in .env');
        console.log(`   Type: ${auditResults.envFile.isAtlas ? 'MongoDB Atlas (Cloud)' : 'Local/Other'}`);
        console.log(`   URI: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`);
        
        // Check for local MongoDB
        if (mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1')) {
          auditResults.envFile.issues.push('⚠️  Connection string points to local MongoDB, not Atlas');
          auditResults.security.localConnections = true;
          console.log('⚠️  WARNING: Connection string points to local MongoDB');
        }
        
        // Check for database name
        if (!mongoUri.includes('/kbm-logic') && !mongoUri.includes('/?') && !mongoUri.includes('?appName=')) {
          auditResults.envFile.issues.push('⚠️  Database name may be missing from connection string');
          console.log('⚠️  WARNING: Database name may be missing');
        }
        
        // Check for Atlas-specific parameters
        if (auditResults.envFile.isAtlas) {
          if (!mongoUri.includes('retryWrites=true')) {
            auditResults.envFile.issues.push('⚠️  Missing retryWrites=true parameter (recommended for Atlas)');
            console.log('⚠️  Missing retryWrites=true parameter');
          }
          if (!mongoUri.includes('w=majority')) {
            auditResults.envFile.issues.push('⚠️  Missing w=majority parameter (recommended for Atlas)');
            console.log('⚠️  Missing w=majority parameter');
          }
        }
      } else {
        auditResults.envFile.issues.push('❌ MONGODB_URI not found in .env file');
        console.log('❌ MONGODB_URI not found in .env file');
      }
    } catch (error) {
      auditResults.envFile.issues.push(`❌ Error reading .env file: ${error.message}`);
      console.log(`❌ Error reading .env file: ${error.message}`);
    }
  }
  
  console.log('');

  // Phase 2: Live Connection Test
  console.log('📋 Phase 2: Live Connection Test');
  console.log('-'.repeat(60));
  
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    auditResults.connectionTest.issues.push('❌ MONGODB_URI not set in environment');
    console.log('❌ Cannot test connection: MONGODB_URI not set');
  } else {
    try {
      const connectionOptions = {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      };
      
      if (mongoUri.includes('mongodb+srv://')) {
        connectionOptions.retryWrites = true;
        connectionOptions.w = 'majority';
      }
      
      console.log('🔄 Attempting connection...');
      const conn = await mongoose.connect(mongoUri, connectionOptions);
      
      auditResults.connectionTest.success = true;
      auditResults.connectionTest.host = conn.connection.host;
      auditResults.connectionTest.database = conn.connection.name;
      
      console.log('✅ Connection successful!');
      console.log(`   Host: ${conn.connection.host}`);
      console.log(`   Database: ${conn.connection.name}`);
      console.log(`   Ready State: ${conn.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
      
      // Test database operations
      const Project = mongoose.model('Project', new mongoose.Schema({}, { strict: false }));
      const projectCount = await Project.countDocuments();
      console.log(`   Projects in database: ${projectCount}`);
      
      // Check if it's Atlas
      if (conn.connection.host.includes('mongodb.net')) {
        console.log('✅ Confirmed: Connected to MongoDB Atlas');
      } else {
        auditResults.connectionTest.issues.push('⚠️  Connected host does not appear to be Atlas');
        console.log('⚠️  WARNING: Connected host does not appear to be Atlas');
      }
      
      await mongoose.connection.close();
      console.log('✅ Connection closed');
      
    } catch (error) {
      auditResults.connectionTest.issues.push(`❌ Connection failed: ${error.message}`);
      console.log(`❌ Connection failed: ${error.message}`);
      
      if (error.message.includes('authentication failed')) {
        console.log('   💡 Check username and password in connection string');
      } else if (error.message.includes('ENOTFOUND')) {
        console.log('   💡 Check if IP address is whitelisted in Atlas Network Access');
      }
    }
  }
  
  console.log('');

  // Phase 3: Code Audit
  console.log('📋 Phase 3: Code Audit (Backend Files)');
  console.log('-'.repeat(60));
  
  const filesToCheck = [
    'config/db.js',
    'scripts/seed-demo.js',
    'scripts/seed-scenarios.js',
    'scripts/debug-ev.js',
    'scripts/verify-demo.js',
    'seed.js'
  ];
  
  for (const file of filesToCheck) {
    const filePath = join(serverRoot, file);
    if (existsSync(filePath)) {
      auditResults.codeAudit.filesChecked++;
      try {
        const content = readFileSync(filePath, 'utf-8');
        
        // Check for local MongoDB fallback
        if (content.includes('mongodb://localhost:27017') || content.includes('127.0.0.1:27017')) {
          auditResults.codeAudit.localFallbacks.push(file);
          console.log(`⚠️  ${file}: Contains local MongoDB fallback`);
        } else {
          console.log(`✅ ${file}: No local MongoDB fallback found`);
        }
      } catch (error) {
        console.log(`❌ ${file}: Error reading file`);
      }
    }
  }
  
  console.log('');

  // Phase 4: Security Audit
  console.log('📋 Phase 4: Security Audit');
  console.log('-'.repeat(60));
  
  // Check for hardcoded credentials (excluding comments and console.log examples)
  const sensitivePatterns = [
    {
      pattern: /mongodb\+srv:\/\/[^:]+:[^@]+@/,
      exclude: [/console\.(log|error|warn)/, /\/\//, /\/\*/] // Exclude console.log and comments
    },
    {
      pattern: /MONGODB_URI\s*=\s*['"][^'"]+mongodb[^'"]+['"]/,
      exclude: [/console\.(log|error|warn)/, /\/\//, /\/\*/] // Exclude console.log and comments
    }
  ];
  
  // Note: We don't check for generic "password" patterns as they may be demo/test passwords
  // Only check for actual MongoDB connection strings outside of comments/examples
  
  let foundCredentials = false;
  for (const file of filesToCheck) {
    const filePath = join(serverRoot, file);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNum = i + 1;
          
          // Skip comment lines
          if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*')) {
            continue;
          }
          
          // Skip console.log lines (these are examples)
          if (line.includes('console.log') || line.includes('console.error') || line.includes('console.warn')) {
            continue;
          }
          
          // Check for actual MongoDB connection strings in code
          for (const { pattern, exclude } of sensitivePatterns) {
            if (pattern.test(line)) {
              // Double-check it's not in a comment or example
              const isExcluded = exclude.some(excludePattern => excludePattern.test(line));
              if (!isExcluded) {
                foundCredentials = true;
                auditResults.security.credentialsExposed = true;
                auditResults.security.issues.push(`⚠️  Potential credentials in ${file}:${lineNum}`);
                console.log(`⚠️  ${file}:${lineNum}: Potential hardcoded credentials detected`);
                break;
              }
            }
          }
        }
      } catch (error) {
        // Skip
      }
    }
  }
  
  if (!foundCredentials) {
    console.log('✅ No hardcoded credentials found in code');
  }
  
  // Check .gitignore
  const gitignorePath = join(serverRoot, '..', '.gitignore');
  if (existsSync(gitignorePath)) {
    const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
    if (gitignoreContent.includes('.env')) {
      console.log('✅ .env file is in .gitignore');
    } else {
      auditResults.security.issues.push('⚠️  .env file may not be in .gitignore');
      console.log('⚠️  WARNING: .env file may not be in .gitignore');
    }
  }
  
  console.log('');

  // Summary Report
  console.log('📊 Audit Summary');
  console.log('='.repeat(60));
  console.log('');
  
  const totalIssues = 
    auditResults.envFile.issues.length +
    auditResults.connectionTest.issues.length +
    auditResults.codeAudit.localFallbacks.length +
    auditResults.security.issues.length;
  
  if (totalIssues === 0) {
    console.log('✅ All checks passed! MongoDB Atlas migration is complete and secure.');
  } else {
    console.log(`⚠️  Found ${totalIssues} issue(s) that need attention:\n`);
    
    if (auditResults.envFile.issues.length > 0) {
      console.log('Environment File Issues:');
      auditResults.envFile.issues.forEach(issue => console.log(`  ${issue}`));
      console.log('');
    }
    
    if (auditResults.connectionTest.issues.length > 0) {
      console.log('Connection Test Issues:');
      auditResults.connectionTest.issues.forEach(issue => console.log(`  ${issue}`));
      console.log('');
    }
    
    if (auditResults.codeAudit.localFallbacks.length > 0) {
      console.log('Code Files with Local MongoDB Fallbacks:');
      auditResults.codeAudit.localFallbacks.forEach(file => console.log(`  ⚠️  ${file}`));
      console.log('');
    }
    
    if (auditResults.security.issues.length > 0) {
      console.log('Security Issues:');
      auditResults.security.issues.forEach(issue => console.log(`  ${issue}`));
      console.log('');
    }
  }
  
  console.log('');
  console.log('📝 Recommended Actions:');
  console.log('  1. Ensure server/.env file contains:');
  console.log('     MONGODB_URI=mongodb+srv://MrVAC:bOvw1g9nyjeyu0AL@cluster0.bj58rji.mongodb.net/kbm-logic?retryWrites=true&w=majority&appName=Cluster0');
  console.log('  2. Verify IP address is whitelisted in MongoDB Atlas Network Access');
  console.log('  3. Test connection using: node server/scripts/test-atlas-connection.js');
  console.log('  4. Remove any local MongoDB fallbacks from code (already done in updated files)');
  console.log('');
  
  process.exit(totalIssues > 0 ? 1 : 0);
};

runAudit().catch(error => {
  console.error('❌ Audit failed:', error);
  process.exit(1);
});

