/**
 * Fix .env URI Script
 * 
 * Automatically fixes the MONGODB_URI in .env file to include:
 * - Database name: kbm-logic
 * - Required Atlas parameters: retryWrites=true&w=majority
 * 
 * Usage: node server/scripts/fix-env-uri.js
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverRoot = join(__dirname, '..');
const envPath = join(serverRoot, '.env');

const CORRECT_URI = 'mongodb+srv://MrVAC:bOvw1g9nyjeyu0AL@cluster0.bj58rji.mongodb.net/kbm-logic?retryWrites=true&w=majority&appName=Cluster0';

const fixEnvUri = () => {
  console.log('🔧 Fixing .env file URI...\n');
  
  if (!existsSync(envPath)) {
    console.log('❌ .env file not found');
    console.log(`   Expected location: ${envPath}`);
    console.log('\n📝 Creating new .env file with correct URI...\n');
    
    const newEnvContent = `# MongoDB Atlas Connection String
MONGODB_URI=${CORRECT_URI}

# Server Configuration
PORT=5000
CORS_ORIGIN=http://localhost:5173

# Environment
NODE_ENV=development
`;
    
    writeFileSync(envPath, newEnvContent, 'utf-8');
    console.log('✅ Created .env file with correct URI');
    return;
  }
  
  try {
    let envContent = readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    let updated = false;
    let foundMongoUri = false;
    
    const newLines = lines.map(line => {
      // Check if this is the MONGODB_URI line
      if (line.trim().startsWith('MONGODB_URI=') || line.trim().startsWith('# MONGODB_URI=')) {
        foundMongoUri = true;
        
        // Extract current URI (if any)
        const currentUri = line.match(/MONGODB_URI=(.+)/)?.[1]?.trim() || '';
        
        // Check if it needs fixing
        const needsDatabase = !currentUri.includes('/kbm-logic') && !currentUri.includes('/?');
        const needsParams = !currentUri.includes('retryWrites=true') || !currentUri.includes('w=majority');
        
        if (needsDatabase || needsParams) {
          console.log('⚠️  Current URI:', currentUri.replace(/\/\/.*@/, '//***:***@'));
          console.log('   Issues found:');
          if (needsDatabase) console.log('     ❌ Missing database name: /kbm-logic');
          if (needsParams) console.log('     ❌ Missing Atlas parameters: retryWrites=true&w=majority');
          console.log('');
          
          updated = true;
          return `MONGODB_URI=${CORRECT_URI}`;
        } else {
          console.log('✅ URI is already correct');
          return line;
        }
      }
      return line;
    });
    
    if (!foundMongoUri) {
      console.log('⚠️  MONGODB_URI not found in .env file');
      console.log('   Adding it...\n');
      newLines.push(`MONGODB_URI=${CORRECT_URI}`);
      updated = true;
    }
    
    if (updated) {
      writeFileSync(envPath, newLines.join('\n'), 'utf-8');
      console.log('✅ Updated .env file with correct URI');
      console.log(`   New URI: ${CORRECT_URI.replace(/\/\/.*@/, '//***:***@')}\n`);
    } else {
      console.log('✅ .env file is already correct\n');
    }
    
  } catch (error) {
    console.error('❌ Error reading/writing .env file:', error.message);
    process.exit(1);
  }
};

fixEnvUri();

