/**
 * E2E Tests: Agent Management & Policies
 * Tests agent CRUD operations, policy management, and kill switch functionality.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Saturn } from '../../sdk/src/index.js';
import {
  E2E_CONFIG,
  createTestAccount,
  enableKillSwitch,
  disableKillSwitch,
  type TestAccount,
} from './setup.js';

describe('Agent Management', () => {
  let testAccount: TestAccount;

  beforeAll(async () => {
    testAccount = await createTestAccount();
  }, 30000);

  describe('Agent CRUD', () => {
    it('should list agents (includes primary agent)', async () => {
      const agents = await testAccount.saturn.agents.list();

      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);

      // Primary agent should exist
      const primaryAgent = agents.find((a) => a.id === testAccount.agentId);
      expect(primaryAgent).toBeDefined();
      expect(primaryAgent?.status).toBe('active');
      expect(primaryAgent?.accountId).toBe(testAccount.accountId);
    });

    it('should create a worker agent', async () => {
      const result = await testAccount.saturn.agents.create({
        name: 'E2E Worker Agent',
        metadata: { purpose: 'testing', environment: 'e2e' },
      });

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^agt_/);
      expect(result.apiKey).toBeDefined();
      expect(result.apiKey).toMatch(/^sk_agt_/);
      expect(result.name).toBe('E2E Worker Agent');
      expect(result.status).toBe('active');
      expect(result.accountId).toBe(testAccount.accountId);
      expect(result.metadata).toEqual({ purpose: 'testing', environment: 'e2e' });
      expect(result.policy).toBeDefined();
      expect(result.policy.killSwitch).toBe(false);
    });

    it('should get agent details', async () => {
      // Create an agent first
      const created = await testAccount.saturn.agents.create({
        name: 'Get Test Agent',
      });

      const agent = await testAccount.saturn.agents.get(created.id);

      expect(agent.id).toBe(created.id);
      expect(agent.name).toBe('Get Test Agent');
      expect(agent.status).toBe('active');
      expect(agent.createdAt).toBeDefined();
      expect(agent.updatedAt).toBeDefined();
    });

    it('should update agent name', async () => {
      // Create an agent
      const created = await testAccount.saturn.agents.create({
        name: 'Original Name',
      });

      // Update name
      const updated = await testAccount.saturn.agents.update(created.id, {
        name: 'Updated Name',
      });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe('Updated Name');
    });

    it('should update agent metadata', async () => {
      // Create an agent
      const created = await testAccount.saturn.agents.create({
        name: 'Metadata Test',
        metadata: { version: 1 },
      });

      // Update metadata
      const updated = await testAccount.saturn.agents.update(created.id, {
        metadata: { version: 2, updated: true },
      });

      expect(updated.metadata).toEqual({ version: 2, updated: true });
    });

    it('should delete agent', async () => {
      // Create an agent
      const created = await testAccount.saturn.agents.create({
        name: 'To Be Deleted',
      });

      // Delete it
      await testAccount.saturn.agents.delete(created.id);

      // Verify it's gone
      await expect(
        testAccount.saturn.agents.get(created.id)
      ).rejects.toThrow();
    });

    it('should not delete primary agent', async () => {
      // The primary agent should be protected
      await expect(
        testAccount.saturn.agents.delete(testAccount.agentId)
      ).rejects.toThrow();
    });
  });

  describe('Shared Wallet', () => {
    it('should share wallet between agents of same account', async () => {
      // Create a second agent
      const agent2 = await testAccount.saturn.agents.create({
        name: 'Wallet Share Test',
      });

      // Get wallet from primary agent
      const wallet1 = await testAccount.saturn.wallet.getSelf();

      // Get wallet from second agent using its API key
      const saturn2 = new Saturn({
        apiKey: agent2.apiKey,
        baseUrl: E2E_CONFIG.apiUrl,
      });
      const wallet2 = await saturn2.wallet.getSelf();

      // Wallets should be the same
      expect(wallet1.id).toBe(wallet2.id);
      expect(wallet1.accountId).toBe(wallet2.accountId);
    });
  });

  describe('Policy Management', () => {
    let workerAgentId: string;

    beforeAll(async () => {
      const agent = await testAccount.saturn.agents.create({
        name: 'Policy Test Agent',
      });
      workerAgentId = agent.id;
    });

    it('should get agent policy', async () => {
      const policy = await testAccount.saturn.agents.policy.get(workerAgentId);

      expect(policy.id).toBeDefined();
      expect(policy.id).toMatch(/^pol_/);
      expect(policy.agentId).toBe(workerAgentId);
      expect(typeof policy.killSwitch).toBe('boolean');
      expect(policy.createdAt).toBeDefined();
    });

    it('should update spend limits', async () => {
      const policy = await testAccount.saturn.agents.policy.update(workerAgentId, {
        maxPerCallSats: 10000,
        maxPerDaySats: 100000,
      });

      expect(policy.maxPerCallSats).toBe(10000);
      expect(policy.maxPerDaySats).toBe(100000);
    });

    it('should update allowed services', async () => {
      const policy = await testAccount.saturn.agents.policy.update(workerAgentId, {
        allowedServices: ['openai', 'anthropic'],
      });

      expect(policy.allowedServices).toEqual(['openai', 'anthropic']);
    });

    it('should update denied services', async () => {
      const policy = await testAccount.saturn.agents.policy.update(workerAgentId, {
        deniedServices: ['twilio', 'resend'],
      });

      expect(policy.deniedServices).toEqual(['twilio', 'resend']);
    });

    it('should update allowed capabilities', async () => {
      const policy = await testAccount.saturn.agents.policy.update(workerAgentId, {
        allowedCapabilities: ['reason', 'search', 'read'],
      });

      expect(policy.allowedCapabilities).toEqual(['reason', 'search', 'read']);
    });

    it('should replace entire policy', async () => {
      const policy = await testAccount.saturn.agents.policy.replace(workerAgentId, {
        maxPerCallSats: 5000,
        maxPerDaySats: 50000,
        allowedServices: null,
        deniedServices: null,
        allowedCapabilities: ['reason'],
        deniedCapabilities: null,
        killSwitch: false,
        maxBalanceSats: null,
      });

      expect(policy.maxPerCallSats).toBe(5000);
      expect(policy.maxPerDaySats).toBe(50000);
      expect(policy.allowedCapabilities).toEqual(['reason']);
      expect(policy.killSwitch).toBe(false);
    });
  });

  describe('Kill Switch', () => {
    let killTestAgentId: string;
    let killTestSaturn: Saturn;

    beforeAll(async () => {
      const agent = await testAccount.saturn.agents.create({
        name: 'Kill Switch Test Agent',
      });
      killTestAgentId = agent.id;
      killTestSaturn = new Saturn({
        apiKey: agent.apiKey,
        baseUrl: E2E_CONFIG.apiUrl,
      });
    });

    it('should enable kill switch', async () => {
      const policy = await enableKillSwitch(testAccount.saturn, killTestAgentId);

      expect(policy.killSwitch).toBe(true);
    });

    it('should disable kill switch', async () => {
      const policy = await disableKillSwitch(testAccount.saturn, killTestAgentId);

      expect(policy.killSwitch).toBe(false);
    });

    it('should toggle kill switch via kill/unkill endpoints', async () => {
      // Enable
      const killed = await testAccount.saturn.agents.policy.kill(killTestAgentId);
      expect(killed.killSwitch).toBe(true);

      // Verify policy reflects change
      const policyKilled = await testAccount.saturn.agents.policy.get(killTestAgentId);
      expect(policyKilled.killSwitch).toBe(true);

      // Disable
      const unkilled = await testAccount.saturn.agents.policy.unkill(killTestAgentId);
      expect(unkilled.killSwitch).toBe(false);

      // Verify policy reflects change
      const policyUnkilled = await testAccount.saturn.agents.policy.get(killTestAgentId);
      expect(policyUnkilled.killSwitch).toBe(false);
    });

    // NOTE: This test requires a funded account to actually verify enforcement
    describe.skip('Kill Switch Enforcement (requires funded account)', () => {
      it('should block API calls when killed', async () => {
        // Enable kill switch
        await enableKillSwitch(testAccount.saturn, killTestAgentId);

        // Try to make an API call with the killed agent
        await expect(
          killTestSaturn.read({ url: 'https://example.com' })
        ).rejects.toThrow(/POLICY_DENIED|KILL_SWITCH/);
      });

      it('should allow API calls when unkilled', async () => {
        // Disable kill switch
        await disableKillSwitch(testAccount.saturn, killTestAgentId);

        // Now the call should work (or fail with balance error, not policy error)
        try {
          await killTestSaturn.read({ url: 'https://example.com' });
        } catch (error: any) {
          // Should not be a policy denial
          expect(error.message).not.toMatch(/POLICY_DENIED|KILL_SWITCH/);
        }
      });
    });
  });
});
