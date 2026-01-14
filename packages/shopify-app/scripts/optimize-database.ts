/**
 * Database Optimization Script
 * 
 * Applies performance indexes and optimizations to the database.
 * Works with both SQLite (development) and PostgreSQL (production).
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function applyIndexes() {
  console.log("📊 Applying performance indexes...");

  const sqlPath = path.join(__dirname, "../prisma/migrations/add_performance_indexes.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  // Split by semicolon and filter empty statements
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  let successCount = 0;
  let skipCount = 0;

  for (const statement of statements) {
    try {
      await prisma.$executeRawUnsafe(statement);
      successCount++;
      console.log(`✅ Applied: ${statement.substring(0, 60)}...`);
    } catch (error: any) {
      if (error.message.includes("already exists")) {
        skipCount++;
        console.log(`⏭️  Skipped (exists): ${statement.substring(0, 60)}...`);
      } else {
        console.error(`❌ Error: ${statement.substring(0, 60)}...`);
        console.error(error.message);
      }
    }
  }

  console.log(`\n✅ Applied ${successCount} indexes`);
  console.log(`⏭️  Skipped ${skipCount} existing indexes`);
}

async function analyzeDatabase() {
  console.log("\n📈 Analyzing database statistics...");

  try {
    // Get table counts
    const merchants = await prisma.merchant.count();
    const customers = await prisma.customerProfile.count();
    const campaigns = await prisma.pushCampaign.count();
    const metrics = await prisma.notificationMetric.count();
    const events = await prisma.eventLog.count();

    console.log("\n📊 Database Statistics:");
    console.log(`  Merchants: ${merchants.toLocaleString()}`);
    console.log(`  Customers: ${customers.toLocaleString()}`);
    console.log(`  Campaigns: ${campaigns.toLocaleString()}`);
    console.log(`  Metrics: ${metrics.toLocaleString()}`);
    console.log(`  Events: ${events.toLocaleString()}`);

    // Calculate average metrics per campaign
    if (campaigns > 0) {
      const avgMetrics = Math.round(metrics / campaigns);
      console.log(`  Avg Metrics/Campaign: ${avgMetrics.toLocaleString()}`);
    }
  } catch (error) {
    console.error("Error analyzing database:", error);
  }
}

async function vacuumDatabase() {
  console.log("\n🧹 Optimizing database...");

  try {
    // SQLite-specific optimization
    await prisma.$executeRawUnsafe("VACUUM");
    console.log("✅ Database vacuumed (SQLite)");
  } catch (error: any) {
    if (error.message.includes("VACUUM")) {
      console.log("⏭️  VACUUM not supported (PostgreSQL)");
      
      // PostgreSQL-specific optimization
      try {
        await prisma.$executeRawUnsafe("ANALYZE");
        console.log("✅ Database analyzed (PostgreSQL)");
      } catch (pgError) {
        console.log("⏭️  ANALYZE not available");
      }
    }
  }
}

async function main() {
  console.log("🚀 Database Optimization Script\n");

  try {
    await applyIndexes();
    await analyzeDatabase();
    await vacuumDatabase();

    console.log("\n✅ Database optimization complete!");
  } catch (error) {
    console.error("\n❌ Optimization failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
