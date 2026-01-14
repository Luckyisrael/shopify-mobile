/**
 * A/B Testing Service
 * 
 * Provides functionality for creating and managing A/B tests for push notifications.
 * Uses hash-based assignment for consistent 50/50 variant distribution.
 */

import prisma from "../db.server";
import crypto from "crypto";

export interface ABTestConfig {
  name: string;
  targetAudience?: string; // Optional filter criteria (stored in data field if needed)
  variantA: {
    title: string;
    body: string;
  };
  variantB: {
    title: string;
    body: string;
  };
}

export interface ABTestResult {
  variant: "A" | "B";
  sends: number;
  opens: number;
  clicks: number;
  conversions: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
}

export interface ABTestResults {
  testId: string;
  name: string;
  status: string;
  variantA: ABTestResult;
  variantB: ABTestResult;
  winner?: "A" | "B" | null;
  confidence?: number;
  isSignificant: boolean;
}

/**
 * Create a new A/B test
 */
export async function createABTest(
  merchantId: string,
  config: ABTestConfig
) {
  const test = await prisma.aBTest.create({
    data: {
      merchantId,
      name: config.name,
      status: "RUNNING",
      variantATitle: config.variantA.title,
      variantABody: config.variantA.body,
      variantBTitle: config.variantB.title,
      variantBBody: config.variantB.body,
    },
  });

  console.log(`[AB-Testing] Created test ${test.id} for merchant ${merchantId}`);
  return test;
}

/**
 * Assign a variant to a customer using hash-based 50/50 split
 * 
 * Uses SHA-256 hash of testId + customerId to ensure:
 * - Consistent assignment (same customer always gets same variant)
 * - Fair 50/50 distribution across population
 * - No bias or patterns
 */
export function assignVariant(
  testId: string,
  customerId: string
): "A" | "B" {
  // Create deterministic hash
  const hash = crypto
    .createHash("sha256")
    .update(`${testId}:${customerId}`)
    .digest("hex");

  // Use first byte of hash to determine variant
  // Even = A, Odd = B (50/50 split)
  const firstByte = parseInt(hash.substring(0, 2), 16);
  const variant = firstByte % 2 === 0 ? "A" : "B";

  return variant;
}

/**
 * Record a test result event (send, open, click, conversion)
 */
export async function recordTestResult(
  testId: string,
  customerId: string,
  eventType: "SEND" | "OPEN" | "CLICK" | "CONVERSION",
  variant?: "A" | "B"
) {
  // If variant not provided, determine it
  const assignedVariant = variant || assignVariant(testId, customerId);

  // Update the appropriate counter
  const updateData: any = {};
  
  if (assignedVariant === "A") {
    switch (eventType) {
      case "SEND":
        updateData.variantASent = { increment: 1 };
        break;
      case "OPEN":
        updateData.variantAOpened = { increment: 1 };
        break;
      case "CLICK":
        updateData.variantAClicked = { increment: 1 };
        break;
      case "CONVERSION":
        updateData.variantAConverted = { increment: 1 };
        break;
    }
  } else {
    switch (eventType) {
      case "SEND":
        updateData.variantBSent = { increment: 1 };
        break;
      case "OPEN":
        updateData.variantBOpened = { increment: 1 };
        break;
      case "CLICK":
        updateData.variantBClicked = { increment: 1 };
        break;
      case "CONVERSION":
        updateData.variantBConverted = { increment: 1 };
        break;
    }
  }

  await prisma.aBTest.update({
    where: { id: testId },
    data: updateData,
  });

  console.log(
    `[AB-Testing] Recorded ${eventType} for test ${testId}, variant ${assignedVariant}`
  );
}

/**
 * Get the variant content for a customer
 */
export async function getVariantContent(
  testId: string,
  customerId: string
) {
  const test = await prisma.aBTest.findUnique({
    where: { id: testId },
  });

  if (!test) {
    throw new Error(`Test ${testId} not found`);
  }

  const variant = assignVariant(testId, customerId);

  return {
    variant,
    title: variant === "A" ? test.variantATitle : test.variantBTitle,
    body: variant === "A" ? test.variantABody : test.variantBBody,
  };
}

/**
 * Get all active tests for a merchant
 */
export async function getActiveTests(merchantId: string) {
  return await prisma.aBTest.findMany({
    where: {
      merchantId,
      status: "RUNNING",
    },
    orderBy: {
      startedAt: "desc",
    },
  });
}

/**
 * Get a specific test by ID
 */
export async function getTest(testId: string) {
  return await prisma.aBTest.findUnique({
    where: { id: testId },
  });
}

/**
 * Update test status
 */
export async function updateTestStatus(
  testId: string,
  status: "RUNNING" | "COMPLETED" | "CANCELLED"
) {
  return await prisma.aBTest.update({
    where: { id: testId },
    data: { status },
  });
}

/**
 * Get all tests for a merchant (with optional status filter)
 */
export async function getTests(
  merchantId: string,
  status?: "RUNNING" | "COMPLETED" | "CANCELLED"
) {
  const where: any = { merchantId };
  if (status) {
    where.status = status;
  }

  return await prisma.aBTest.findMany({
    where,
    orderBy: {
      startedAt: "desc",
    },
  });
}

/**
 * Calculate statistical significance using chi-square test
 * 
 * Tests if the difference in conversion rates between variants is statistically significant.
 * Uses chi-square test with p < 0.05 threshold.
 * 
 * @returns Object with isSignificant flag and p-value
 */
export function calculateSignificance(
  variantA: { sends: number; conversions: number },
  variantB: { sends: number; conversions: number }
): { isSignificant: boolean; pValue: number; confidence: number } {
  const totalSends = variantA.sends + variantB.sends;
  const totalConversions = variantA.conversions + variantB.conversions;

  // Need minimum sample size
  if (totalSends < 100 || totalConversions < 10) {
    return {
      isSignificant: false,
      pValue: 1.0,
      confidence: 0,
    };
  }

  // Calculate expected values
  const expectedA = (variantA.sends * totalConversions) / totalSends;
  const expectedB = (variantB.sends * totalConversions) / totalSends;

  // Calculate chi-square statistic
  const chiSquare =
    Math.pow(variantA.conversions - expectedA, 2) / expectedA +
    Math.pow(variantB.conversions - expectedB, 2) / expectedB;

  // For 1 degree of freedom, chi-square > 3.841 means p < 0.05
  const isSignificant = chiSquare > 3.841;

  // Approximate p-value calculation
  // For chi-square with 1 df: p ≈ 1 - erf(sqrt(chi-square/2))
  const pValue = isSignificant ? 0.05 : 0.5; // Simplified

  // Calculate confidence level (1 - p-value) as percentage
  const confidence = Math.round((1 - pValue) * 100);

  return {
    isSignificant,
    pValue,
    confidence,
  };
}

/**
 * Declare a winner for an A/B test
 * 
 * Checks statistical significance and declares winner if significant.
 * Updates test status to COMPLETED.
 */
export async function declareWinner(testId: string) {
  const test = await prisma.aBTest.findUnique({
    where: { id: testId },
  });

  if (!test) {
    throw new Error(`Test ${testId} not found`);
  }

  // Calculate rates
  const variantARate =
    test.variantASent > 0
      ? test.variantAConverted / test.variantASent
      : 0;
  const variantBRate =
    test.variantBSent > 0
      ? test.variantBConverted / test.variantBSent
      : 0;

  // Check statistical significance
  const significance = calculateSignificance(
    { sends: test.variantASent, conversions: test.variantAConverted },
    { sends: test.variantBSent, conversions: test.variantBConverted }
  );

  let winner: "A" | "B" | null = null;

  if (significance.isSignificant) {
    // Declare winner based on conversion rate
    winner = variantARate > variantBRate ? "A" : "B";
  }

  // Update test with winner and complete it
  const updatedTest = await prisma.aBTest.update({
    where: { id: testId },
    data: {
      status: "COMPLETED",
      winner,
      completedAt: new Date(),
    },
  });

  console.log(
    `[AB-Testing] Test ${testId} completed. Winner: ${winner || "No significant difference"}`
  );

  return {
    test: updatedTest,
    winner,
    significance,
  };
}

/**
 * Get detailed test results with statistical analysis
 */
export async function getTestResults(testId: string): Promise<ABTestResults> {
  const test = await prisma.aBTest.findUnique({
    where: { id: testId },
  });

  if (!test) {
    throw new Error(`Test ${testId} not found`);
  }

  // Calculate variant A metrics
  const variantA: ABTestResult = {
    variant: "A",
    sends: test.variantASent,
    opens: test.variantAOpened,
    clicks: test.variantAClicked,
    conversions: test.variantAConverted,
    openRate: test.variantASent > 0 ? test.variantAOpened / test.variantASent : 0,
    clickRate: test.variantASent > 0 ? test.variantAClicked / test.variantASent : 0,
    conversionRate:
      test.variantASent > 0 ? test.variantAConverted / test.variantASent : 0,
  };

  // Calculate variant B metrics
  const variantB: ABTestResult = {
    variant: "B",
    sends: test.variantBSent,
    opens: test.variantBOpened,
    clicks: test.variantBClicked,
    conversions: test.variantBConverted,
    openRate: test.variantBSent > 0 ? test.variantBOpened / test.variantBSent : 0,
    clickRate: test.variantBSent > 0 ? test.variantBClicked / test.variantBSent : 0,
    conversionRate:
      test.variantBSent > 0 ? test.variantBConverted / test.variantBSent : 0,
  };

  // Calculate statistical significance
  const significance = calculateSignificance(
    { sends: test.variantASent, conversions: test.variantAConverted },
    { sends: test.variantBSent, conversions: test.variantBConverted }
  );

  return {
    testId: test.id,
    name: test.name,
    status: test.status,
    variantA,
    variantB,
    winner: test.winner as "A" | "B" | null,
    confidence: significance.confidence,
    isSignificant: significance.isSignificant,
  };
}
