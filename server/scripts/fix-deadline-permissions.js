/**
 * Migration Script: Fix Deadline Permissions
 * 
 * This script ensures that all existing 'Owner' and 'Project Manager' roles
 * have the 'can_manage_deadline' permission in the database.
 * 
 * Run with: node server/scripts/fix-deadline-permissions.js
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

async function fixDeadlinePermissions() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Connected to MongoDB');

    // Find all projects
    const projects = await Project.find({});
    console.log(`📊 Found ${projects.length} projects to process`);

    let totalUpdated = 0;
    let totalMembersUpdated = 0;

    for (const project of projects) {
      let projectUpdated = false;
      let membersUpdated = 0;

      // Check if project has members
      if (!project.members || project.members.length === 0) {
        console.log(`⚠️  Project "${project.name}" has no members, skipping...`);
        continue;
      }

      // Iterate through members
      for (const member of project.members) {
        // Check if member has roles array
        if (!member.roles || member.roles.length === 0) {
          continue;
        }

        // Check if member has 'Owner' or 'Project Manager' role
        const hasOwnerRole = member.roles.includes('Owner');
        const hasPMRole = member.roles.includes('Project Manager') || member.roles.includes('PM') || member.roles.includes('Manager');

        if (hasOwnerRole || hasPMRole) {
          // Ensure permissions array exists
          if (!member.permissions) {
            member.permissions = [];
          }

          // Check if 'can_manage_deadline' is missing
          if (!member.permissions.includes('can_manage_deadline')) {
            // Add the permission
            member.permissions.push('can_manage_deadline');
            
            // Also ensure other critical permissions are present
            const criticalPermissions = ['can_view_financial', 'can_generate_reports'];
            criticalPermissions.forEach(perm => {
              if (!member.permissions.includes(perm) && ALL_PERMISSIONS.includes(perm)) {
                member.permissions.push(perm);
              }
            });

            // Remove any invalid permissions (not in ALL_PERMISSIONS)
            member.permissions = member.permissions.filter(perm => ALL_PERMISSIONS.includes(perm));

            membersUpdated++;
            projectUpdated = true;
            console.log(`  ✅ Updated member ${member.userId} in project "${project.name}" (Role: ${member.roles.join(', ')})`);
          }
        }
      }

      // Save project if any members were updated
      if (projectUpdated) {
        try {
          await project.save();
          totalUpdated++;
          totalMembersUpdated += membersUpdated;
          console.log(`✅ Project "${project.name}" updated (${membersUpdated} members)`);
        } catch (saveError) {
          console.error(`❌ Failed to save project "${project.name}":`, saveError.message);
        }
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`  ✅ Projects updated: ${totalUpdated}`);
    console.log(`  ✅ Total members updated: ${totalMembersUpdated}`);
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration
fixDeadlinePermissions()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

