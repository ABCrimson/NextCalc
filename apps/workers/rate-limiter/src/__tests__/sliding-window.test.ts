/**
 * Unit tests for sliding window rate limiting
 */

import { describe, expect, it } from 'vitest';
import { getRecommendedTier, RATE_LIMIT_CONFIGS, type UserTier } from '../utils/sliding-window.js';

describe('Rate Limit Configuration', () => {
  it('should have correct free tier limits', () => {
    expect(RATE_LIMIT_CONFIGS.free.requestsPerHour).toBe(100);
    expect(RATE_LIMIT_CONFIGS.free.burstLimit).toBe(20);
  });

  it('should have correct pro tier limits', () => {
    expect(RATE_LIMIT_CONFIGS.pro.requestsPerHour).toBe(1000);
    expect(RATE_LIMIT_CONFIGS.pro.burstLimit).toBe(50);
  });

  it('should have unlimited enterprise tier', () => {
    expect(RATE_LIMIT_CONFIGS.enterprise.requestsPerHour).toBeGreaterThan(1000000);
    expect(RATE_LIMIT_CONFIGS.enterprise.burstLimit).toBe(1000);
  });
});

describe('getRecommendedTier', () => {
  it('should recommend free tier for low usage', () => {
    expect(getRecommendedTier(50)).toBe('free');
    expect(getRecommendedTier(100)).toBe('free');
  });

  it('should recommend pro tier for medium usage', () => {
    expect(getRecommendedTier(150)).toBe('pro');
    expect(getRecommendedTier(500)).toBe('pro');
    expect(getRecommendedTier(1000)).toBe('pro');
  });

  it('should recommend enterprise tier for high usage', () => {
    expect(getRecommendedTier(1500)).toBe('enterprise');
    expect(getRecommendedTier(10000)).toBe('enterprise');
  });
});

describe('Sliding Window Algorithm', () => {
  it('should correctly identify all tier types', () => {
    const tiers: UserTier[] = ['free', 'pro', 'enterprise'];
    tiers.forEach((tier) => {
      expect(RATE_LIMIT_CONFIGS[tier]).toBeDefined();
      expect(RATE_LIMIT_CONFIGS[tier].tier).toBe(tier);
    });
  });

  it('should have increasing limits across tiers', () => {
    expect(RATE_LIMIT_CONFIGS.free.requestsPerHour).toBeLessThan(
      RATE_LIMIT_CONFIGS.pro.requestsPerHour,
    );
    expect(RATE_LIMIT_CONFIGS.pro.requestsPerHour).toBeLessThan(
      RATE_LIMIT_CONFIGS.enterprise.requestsPerHour,
    );
  });
});
