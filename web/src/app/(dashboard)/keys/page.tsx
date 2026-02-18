'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { LoadingPage } from '@/components/loading';
import type { AdminAgent, CreateAgentResponse } from '@/lib/types';

export default function KeysPage() {
  const { apiKey } = useAuth();
  const [agents, setAgents] = useState<AdminAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create agent modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // New agent key display
  const [newAgentKey, setNewAgentKey] = useState<{ name: string; apiKey: string } | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  // Copy states for existing agents
  const [copiedAgentId, setCopiedAgentId] = useState<string | null>(null);

  // Regenerate/revoke states
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!apiKey) return;
    apiFetch<AdminAgent[]>('/v1/admin/agents', { apiKey })
      .then(setAgents)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      })
      .finally(() => setLoading(false));
  }, [apiKey]);

  const handleCreateAgent = async () => {
    if (!apiKey || !newAgentName.trim()) return;
    setCreateLoading(true);
    setCreateError('');

    try {
      const response = await apiFetch<CreateAgentResponse>('/v1/agents', {
        apiKey,
        method: 'POST',
        body: { name: newAgentName.trim() },
      });
      setNewAgentKey({ name: response.name, apiKey: response.apiKey });
      setShowCreateModal(false);
      setNewAgentName('');
      // Refresh agents list
      const updatedAgents = await apiFetch<AdminAgent[]>('/v1/admin/agents', { apiKey });
      setAgents(updatedAgents);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setCreateLoading(false);
    }
  };

  const copyKey = async (key: string, agentId?: string) => {
    await navigator.clipboard.writeText(key);
    if (agentId) {
      setCopiedAgentId(agentId);
      setTimeout(() => setCopiedAgentId(null), 2000);
    } else {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  };

  const handleRegenerate = async (agentId: string) => {
    if (!apiKey) return;
    if (!confirm('This will invalidate the current API key. Continue?')) return;

    setRegeneratingId(agentId);
    setActionError('');

    try {
      const response = await apiFetch<{ apiKey: string; name: string }>(`/v1/agents/${agentId}/regenerate`, {
        apiKey,
        method: 'POST',
      });
      setNewAgentKey({ name: response.name, apiKey: response.apiKey });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to regenerate key');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleRevoke = async (agentId: string, agentName: string) => {
    if (!apiKey) return;
    if (!confirm(`Revoke agent "${agentName}"? This cannot be undone.`)) return;

    setRevokingId(agentId);
    setActionError('');

    try {
      await apiFetch(`/v1/agents/${agentId}`, {
        apiKey,
        method: 'DELETE',
      });
      // Refresh agents list
      const updatedAgents = await apiFetch<AdminAgent[]>('/v1/admin/agents', { apiKey });
      setAgents(updatedAgents);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to revoke agent');
    } finally {
      setRevokingId(null);
    }
  };

  if (loading) {
    return <LoadingPage />;
  }

  if (error) {
    return <div className="text-sm text-red-400">Error: {error}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary px-4 py-2.5 rounded-lg text-sm"
        >
          + New Agent
        </button>
      </div>

      {/* Action Error Display */}
      {actionError && (
        <div className="border border-red-500/30 bg-red-500/10 rounded-xl p-4 mb-6">
          <div className="text-sm text-red-400">{actionError}</div>
          <button onClick={() => setActionError('')} className="text-xs text-red-400/70 hover:text-red-400 mt-2">
            Dismiss
          </button>
        </div>
      )}

      {/* New Agent Key Display - shows after creating an agent */}
      {newAgentKey && (
        <div className="border border-accent/30 bg-accent/10 rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-accent mb-1">
                Agent &quot;{newAgentKey.name}&quot; created
              </div>
              <div className="text-xs text-accent/70 mb-3">
                Save this API key now. You won&apos;t be able to see it again.
              </div>
              <div className="bg-background rounded-lg px-4 py-3 font-mono text-xs break-all border border-accent/30">
                {newAgentKey.apiKey}
              </div>
            </div>
            <button
              onClick={() => copyKey(newAgentKey.apiKey)}
              className="ml-4 btn-primary px-4 py-2 rounded-lg text-xs shrink-0"
            >
              {keyCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => setNewAgentKey(null)}
            className="mt-4 text-xs text-accent/70 hover:text-accent transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Agents List */}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                Created
              </th>
              <th className="text-center px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                View
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  No agents yet. Create one to get started.
                </td>
              </tr>
            ) : (
              agents.map((agent) => (
                <tr
                  key={agent.id}
                  className="border-b border-border last:border-b-0 hover:bg-surface/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium">
                      {agent.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={agent.status} />
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {formatDate(agent.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <a
                      href={`/keys/${agent.id}`}
                      className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View
                    </a>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRegenerate(agent.id)}
                        disabled={regeneratingId === agent.id || agent.status === 'killed'}
                        className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-400 hover:text-blue-300 transition-all disabled:opacity-30"
                        title="Regenerate API key"
                      >
                        <svg className={`w-4 h-4 ${regeneratingId === agent.id ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                      {agent.role !== 'primary' && agent.status !== 'killed' && (
                        <button
                          onClick={() => handleRevoke(agent.id, agent.name)}
                          disabled={revokingId === agent.id}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-all disabled:opacity-30"
                          title="Revoke agent"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Agent Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative bg-surface border border-border rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h2 className="text-lg font-semibold mb-5">Create Agent</h2>
            <div className="mb-5">
              <label className="text-sm text-zinc-300 block mb-2">Agent name</label>
              <input
                type="text"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder="e.g., production-bot"
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent transition-all"
                autoFocus
              />
            </div>
            {createError && (
              <div className="mb-5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{createError}</div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary px-4 py-2.5 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAgent}
                disabled={createLoading || !newAgentName.trim()}
                className="btn-primary px-4 py-2.5 rounded-lg text-sm"
              >
                {createLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    suspended: 'bg-yellow-500/20 text-yellow-400',
    killed: 'bg-red-500/20 text-red-400',
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}
    >
      {status}
    </span>
  );
}
