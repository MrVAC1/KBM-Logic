/**
 * Migration Script: Cleanup Obsolete Permissions
 * 
 * This script removes the obsolete 'can_track_time' permission from all projects
 * in the database. This permission was removed from the schema but may still
 * exist in existing database records, causing validation errors.
 * 
 * Run with: node server/scripts/cleanup-permissions.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Project, { ALL_PERMISSIONS } from '../models/Project.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in environment variables');
  process.exit(1);
}

// Obsolete permission to remove
const OBSOLETE_PERMISSION = 'can_track_time';

async function cleanupPermissions() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Connected to MongoDB');

    // Find all projects
    const projects = await Project.find({});
    console.log(`📊 Found ${projects.length} projects to process`);

    let totalProjectsUpdated = 0;
    let totalCustomRolesCleaned = 0;
    let totalMembersCleaned = 0;
    let totalPermissionsRemoved = 0;

    for (const project of projects) {
      let projectModified = false;
      let customRolesCleaned = 0;
      let membersCleaned = 0;
      let permissionsRemoved = 0;

      // Clean customRoles permissions
      if (project.customRoles && Array.isArray(project.customRoles)) {
        for (const customRole of project.customRoles) {
          if (customRole.permissions && Array.isArray(customRole.permissions)) {
            const beforeCount = customRole.permissions.length;
            // Filter out the obsolete permission
            customRole.permissions = customRole.permissions.filter(
              perm => perm !== OBSOLETE_PERMISSION
            );
            const afterCount = customRole.permissions.length;
            const removed = beforeCount - afterCount;
            
            if (removed > 0) {
              permissionsRemoved += removed;
              customRolesCleaned++;
              projectModified = true;
              console.log(`  🔧 Cleaned custom role "${customRole.name}" in project "${project.name}" (removed ${removed} permission(s))`);
            }
          }
        }
      }

      // Clean members permissions
      if (project.members && Array.isArray(project.members)) {
        for (const member of project.members) {
          if (member.permissions && Array.isArray(member.permissions)) {
            const beforeCount = member.permissions.length;
            // Filter out the obsolete permission
            member.permissions = member.permissions.filter(
              perm => perm !== OBSOLETE_PERMISSION
            );
            const afterCount = member.permissions.length;
            const removed = beforeCount - afterCount;
            
            if (removed > 0) {
              permissionsRemoved += removed;
              membersCleaned++;
              projectModified = true;
              console.log(`  🔧 Cleaned member ${member.userId} in project "${project.name}" (removed ${removed} permission(s))`);
            }
          }
        }
      }

      // Also remove any other invalid permissions (not in ALL_PERMISSIONS)
      if (project.customRoles && Array.isArray(project.customRoles)) {
        for (const customRole of project.customRoles) {
          if (customRole.permissions && Array.isArray(customRole.permissions)) {
            const beforeCount = customRole.permissions.length;
            // Filter out any permissions not in ALL_PERMISSIONS
            customRole.permissions = customRole.permissions.filter(
              perm => ALL_PERMISSIONS.includes(perm)
            );
            const afterCount = customRole.permissions.length;
            const removed = beforeCount - afterCount;
            
            if (removed > 0) {
              permissionsRemoved += removed;
              if (!projectModified) {
                customRolesCleaned++;
                projectModified = true;
              }
              console.log(`  🔧 Removed ${removed} invalid permission(s) from custom role "${customRole.name}" in project "${project.name}"`);
            }
          }
        }
      }

      if (project.members && Array.isArray(project.members)) {
        for (const member of project.members) {
          if (member.permissions && Array.isArray(member.permissions)) {
            const beforeCount = member.permissions.length;
            // Filter out any permissions not in ALL_PERMISSIONS
            member.permissions = member.permissions.filter(
              perm => ALL_PERMISSIONS.includes(perm)
            );
            const afterCount = member.permissions.length;
            const removed = beforeCount - afterCount;
            
            if (removed > 0) {
              permissionsRemoved += removed;
              if (!projectModified) {
                membersCleaned++;
                projectModified = true;
              }
              console.log(`  🔧 Removed ${removed} invalid permission(s) from member ${member.userId} in project "${project.name}"`);
            }
          }
        }
      }

      // Save project if modified
      if (projectModified) {
        try {
          await project.save();
          totalProjectsUpdated++;
          totalCustomRolesCleaned += customRolesCleaned;
          totalMembersCleaned += membersCleaned;
          totalPermissionsRemoved += permissionsRemoved;
          console.log(`✅ Project "${project.name}" cleaned and saved (${permissionsRemoved} permission(s) removed)`);
        } catch (saveError) {
          console.error(`❌ Failed to save project "${project.name}":`, saveError.message);
          if (saveError.name === 'ValidationError') {
            console.error(`   Validation errors:`, saveError.errors);
          }
        }
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`  ✅ Projects updated: ${totalProjectsUpdated}`);
    console.log(`  ✅ Custom roles cleaned: ${totalCustomRolesCleaned}`);
    console.log(`  ✅ Members cleaned: ${totalMembersCleaned}`);
    console.log(`  ✅ Total permissions removed: ${totalPermissionsRemoved}`);
    
    if (totalProjectsUpdated === 0) {
      console.log('\n✨ No obsolete permissions found. Database is clean!');
    } else {
      console.log(`\n✅ Migration completed successfully! Removed '${OBSOLETE_PERMISSION}' and other invalid permissions from ${totalProjectsUpdated} project(s).`);
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration
cleanupPermissions()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

