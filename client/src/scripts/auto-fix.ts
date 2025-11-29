/**
 * Auto-Fix Script
 * 
 * This script scans the codebase for common errors and applies fixes:
 * 1. Array operations without null checks
 * 2. React hooks called after early returns
 * 3. Missing type guards
 * 4. Unsafe property access
 * 
 * Run with: npx tsx src/scripts/auto-fix.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface FixResult {
  file: string;
  fixes: string[];
  errors: string[];
}

class AutoFixer {
  private fixes: FixResult[] = [];

  /**
   * Scan and fix all TypeScript/TSX/JSX files
   */
  async scanAndFix(rootDir: string): Promise<void> {
    const files = await glob('**/*.{ts,tsx,jsx}', {
      cwd: rootDir,
      ignore: ['node_modules/**', 'dist/**', 'build/**'],
    });

    console.log(`📁 Found ${files.length} files to scan...\n`);

    for (const file of files) {
      const filePath = path.join(rootDir, file);
      const result = await this.fixFile(filePath);
      if (result.fixes.length > 0 || result.errors.length > 0) {
        this.fixes.push(result);
      }
    }

    this.printReport();
  }

  /**
   * Fix a single file
   */
  private async fixFile(filePath: string): Promise<FixResult> {
    const result: FixResult = {
      file: path.relative(process.cwd(), filePath),
      fixes: [],
      errors: [],
    };

    try {
      let content = fs.readFileSync(filePath, 'utf-8');
      const originalContent = content;

      // Fix 1: Array operations without null checks
      content = this.fixArrayOperations(content, result);

      // Fix 2: React hooks after early returns (basic check)
      content = this.checkReactHooks(content, result);

      // Fix 3: Unsafe property access
      content = this.fixUnsafePropertyAccess(content, result);

      // Write fixed content if changes were made
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf-8');
        result.fixes.push('File updated');
      }
    } catch (error) {
      result.errors.push(`Error processing file: ${error}`);
    }

    return result;
  }

  /**
   * Fix array operations without null checks
   */
  private fixArrayOperations(content: string, result: FixResult): string {
    const patterns = [
      // .filter( without Array.isArray check
      {
        regex: /(\w+)\.filter\(/g,
        fix: (match: string, varName: string) => {
          // Check if already has safe wrapper
          if (content.includes(`safeArray.filter(${varName}`) || 
              content.includes(`Array.isArray(${varName})`)) {
            return match;
          }
          result.fixes.push(`Added safe array filter for ${varName}`);
          return `safeArray.filter(${varName}, `;
        },
      },
      // .map( without Array.isArray check
      {
        regex: /(\w+)\.map\(/g,
        fix: (match: string, varName: string) => {
          if (content.includes(`safeArray.map(${varName}`) || 
              content.includes(`Array.isArray(${varName})`)) {
            return match;
          }
          result.fixes.push(`Added safe array map for ${varName}`);
          return `safeArray.map(${varName}, `;
        },
      },
      // .find( without Array.isArray check
      {
        regex: /(\w+)\.find\(/g,
        fix: (match: string, varName: string) => {
          if (content.includes(`safeArray.find(${varName}`) || 
              content.includes(`Array.isArray(${varName})`)) {
            return match;
          }
          result.fixes.push(`Added safe array find for ${varName}`);
          return `safeArray.find(${varName}, `;
        },
      },
    ];

    // Note: This is a simplified version. Full implementation would need AST parsing.
    // For now, we'll just detect and report issues.
    for (const pattern of patterns) {
      const matches = content.matchAll(pattern.regex);
      for (const match of matches) {
        const varName = match[1];
        // Check if it's already safe
        const beforeMatch = content.substring(0, match.index);
        const hasSafeCheck = beforeMatch.includes(`Array.isArray(${varName})`) ||
                            beforeMatch.includes(`safeArray.`);
        
        if (!hasSafeCheck && !this.isInComment(content, match.index || 0)) {
          result.errors.push(`⚠️  Unsafe array operation: ${match[0]} in ${result.file}`);
        }
      }
    }

    return content;
  }

  /**
   * Check React hooks usage
   */
  private checkReactHooks(content: string, result: FixResult): string {
    const hookPattern = /(useState|useEffect|useMemo|useCallback|useRef)\(/g;
    const returnPattern = /return\s+[^;]+;/g;

    const hooks: Array<{ name: string; index: number }> = [];
    const returns: number[] = [];

    // Find all hooks
    for (const match of content.matchAll(hookPattern)) {
      hooks.push({ name: match[1], index: match.index || 0 });
    }

    // Find all returns
    for (const match of content.matchAll(returnPattern)) {
      returns.push(match.index || 0);
    }

    // Check if any hook comes after a return
    for (const hook of hooks) {
      for (const returnIndex of returns) {
        if (hook.index > returnIndex) {
          // Check if return is inside a function (not the component's return)
          const beforeHook = content.substring(0, hook.index);
          const functionMatches = beforeHook.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g);
          const lastFunction = functionMatches?.[functionMatches.length - 1];
          
          if (lastFunction && returnIndex > (lastFunction.index || 0)) {
            result.errors.push(
              `⚠️  Hook ${hook.name}() may be called after return statement in ${result.file}`
            );
          }
        }
      }
    }

    return content;
  }

  /**
   * Fix unsafe property access
   */
  private fixUnsafePropertyAccess(content: string, result: FixResult): string {
    // Detect patterns like obj.prop.prop2 without optional chaining
    const unsafePattern = /(\w+)\.(\w+)\.(\w+)(?!\?\.)/g;
    const matches = Array.from(content.matchAll(unsafePattern));
    
    for (const match of matches) {
      const fullMatch = match[0];
      if (!fullMatch.includes('?.') && !this.isInComment(content, match.index || 0)) {
        result.errors.push(
          `⚠️  Unsafe property access: ${fullMatch} in ${result.file}`
        );
      }
    }

    return content;
  }

  /**
   * Check if position is inside a comment
   */
  private isInComment(content: string, position: number): boolean {
    const before = content.substring(0, position);
    const lines = before.split('\n');
    const lastLine = lines[lines.length - 1];
    
    // Check for // comments
    if (lastLine.includes('//')) {
      return true;
    }
    
    // Check for /* */ comments (simplified)
    const commentStart = before.lastIndexOf('/*');
    const commentEnd = before.lastIndexOf('*/');
    if (commentStart > commentEnd) {
      return true;
    }
    
    return false;
  }

  /**
   * Print fix report
   */
  private printReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 AUTO-FIX REPORT');
    console.log('='.repeat(60) + '\n');

    const totalFixes = this.fixes.reduce((sum, r) => sum + r.fixes.length, 0);
    const totalErrors = this.fixes.reduce((sum, r) => sum + r.errors.length, 0);

    if (totalFixes === 0 && totalErrors === 0) {
      console.log('✅ No issues found! All files are clean.\n');
      return;
    }

    for (const result of this.fixes) {
      if (result.fixes.length > 0 || result.errors.length > 0) {
        console.log(`\n📄 ${result.file}`);
        
        if (result.fixes.length > 0) {
          console.log('  ✅ Fixes applied:');
          result.fixes.forEach(fix => console.log(`     - ${fix}`));
        }
        
        if (result.errors.length > 0) {
          console.log('  ⚠️  Issues detected (manual review needed):');
          result.errors.forEach(error => console.log(`     ${error}`));
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📈 Summary: ${totalFixes} fixes applied, ${totalErrors} issues need manual review`);
    console.log('='.repeat(60) + '\n');
  }
}

// Run if executed directly
if (require.main === module) {
  const rootDir = path.join(__dirname, '../..');
  const fixer = new AutoFixer();
  fixer.scanAndFix(rootDir).catch(console.error);
}

export { AutoFixer };


