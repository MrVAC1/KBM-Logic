/**
 * Error Checker Script
 * 
 * Scans codebase for common error patterns:
 * - Array operations without null checks
 * - React hooks after early returns
 * - Unsafe property access
 * 
 * Run with: node src/scripts/check-errors.js
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const ERROR_PATTERNS = {
  unsafeArrayFilter: /(\w+)\.filter\(/g,
  unsafeArrayMap: /(\w+)\.map\(/g,
  unsafeArrayFind: /(\w+)\.find\(/g,
  unsafeArrayReduce: /(\w+)\.reduce\(/g,
  unsafePropertyAccess: /(\w+)\.(\w+)\.(\w+)(?!\?\.)/g,
};

function isInComment(content, position) {
  const before = content.substring(0, position);
  const lines = before.split('\n');
  const lastLine = lines[lines.length - 1];
  
  if (lastLine.includes('//')) return true;
  
  const commentStart = before.lastIndexOf('/*');
  const commentEnd = before.lastIndexOf('*/');
  return commentStart > commentEnd;
}

function hasSafeCheck(content, varName, position) {
  const before = content.substring(0, position);
  return before.includes(`Array.isArray(${varName})`) ||
         before.includes(`safeArray.`) ||
         before.includes(`(${varName} || [])`) ||
         before.includes(`(${varName}?.`);
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const errors = [];
  const relativePath = path.relative(process.cwd(), filePath);

  // Check for unsafe array operations
  for (const [name, pattern] of Object.entries(ERROR_PATTERNS)) {
    const matches = Array.from(content.matchAll(pattern));
    for (const match of matches) {
      const varName = match[1];
      const position = match.index;
      
      if (!isInComment(content, position) && !hasSafeCheck(content, varName, position)) {
        errors.push({
          type: name,
          line: content.substring(0, position).split('\n').length,
          code: match[0],
          variable: varName,
        });
      }
    }
  }

  // Check for React hooks after early returns
  const hookPattern = /(useState|useEffect|useMemo|useCallback|useRef)\(/g;
  const returnPattern = /^\s*return\s+/gm;
  
  const lines = content.split('\n');
  let foundReturn = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (returnPattern.test(line) && !line.includes('//')) {
      foundReturn = true;
    }
    
    if (foundReturn && hookPattern.test(line)) {
      errors.push({
        type: 'hookAfterReturn',
        line: i + 1,
        code: line.trim(),
        variable: 'N/A',
      });
    }
  }

  return { file: relativePath, errors };
}

async function main() {
  const rootDir = path.join(__dirname, '../..');
  const files = await glob('**/*.{ts,tsx,jsx}', {
    cwd: rootDir,
    ignore: ['node_modules/**', 'dist/**', 'build/**', 'src/scripts/**'],
  });

  console.log(`\n🔍 Scanning ${files.length} files for errors...\n`);

  const results = [];
  for (const file of files) {
    const filePath = path.join(rootDir, file);
    const result = checkFile(filePath);
    if (result.errors.length > 0) {
      results.push(result);
    }
  }

  if (results.length === 0) {
    console.log('✅ No errors found! All files are clean.\n');
    return;
  }

  console.log('⚠️  ERRORS FOUND:\n');
  console.log('='.repeat(80));
  
  let totalErrors = 0;
  for (const result of results) {
    console.log(`\n📄 ${result.file}`);
    for (const error of result.errors) {
      totalErrors++;
      console.log(`   Line ${error.line}: ${error.type}`);
      console.log(`   Code: ${error.code}`);
      console.log(`   Variable: ${error.variable}`);
      console.log('');
    }
  }

  console.log('='.repeat(80));
  console.log(`\n📊 Total: ${totalErrors} potential errors found in ${results.length} files\n`);
  console.log('💡 Tip: Use safe-utils.ts functions for defensive coding.\n');
}

main().catch(console.error);


