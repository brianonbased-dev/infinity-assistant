'use client';

/**
 * Knowledge Marketplace Component
 *
 * Allows users to browse and apply knowledge packets to their
 * Assistant or Build experience for enhanced functionality.
 *
 * Features:
 * - Browse published knowledge packets
 * - Filter by type, domain, and target mode
 * - Apply/unapply packets to Assistant or Build modes
 * - View applied packets and manage them
 *
 * @since 2025-12-01
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  Package,
  MessageSquare,
  Wrench,
  Plus,
  Minus,
  Star,
  BookOpen,
  FileCode,
  Lightbulb,
  FileText,
  Layers,
  Sparkles,
  Check,
  X,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { masterRpcClient, type KnowledgePacket } from '@/services/MasterRpcClient';

type TargetMode = 'assistant' | 'build' | 'all';
type PacketType = 'research' | 'protocol' | 'insight' | 'documentation' | 'pattern';
type ViewTab = 'browse' | 'applied';

interface KnowledgeMarketplaceProps {
  defaultMode?: TargetMode;
  onPacketApplied?: (packet: KnowledgePacket, mode: 'assistant' | 'build') => void;
  onPacketRemoved?: (packetId: string, mode: 'assistant' | 'build') => void;
  className?: string;
}

const PACKET_TYPE_ICONS: Record<PacketType, React.ReactNode> = {
  research: <BookOpen className="w-4 h-4" />,
  protocol: <FileCode className="w-4 h-4" />,
  insight: <Lightbulb className="w-4 h-4" />,
  documentation: <FileText className="w-4 h-4" />,
  pattern: <Layers className="w-4 h-4" />,
};

const PACKET_TYPE_COLORS: Record<PacketType, string> = {
  research: 'text-blue-400 bg-blue-500/20',
  protocol: 'text-purple-400 bg-purple-500/20',
  insight: 'text-yellow-400 bg-yellow-500/20',
  documentation: 'text-green-400 bg-green-500/20',
  pattern: 'text-cyan-400 bg-cyan-500/20',
};

export function KnowledgeMarketplace({
  defaultMode = 'all',
  onPacketApplied,
  onPacketRemoved,
  className = '',
}: KnowledgeMarketplaceProps) {
  // State
  const [activeTab, setActiveTab] = useState<ViewTab>('browse');
  const [targetMode, setTargetMode] = useState<TargetMode>(defaultMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<PacketType | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [packets, setPackets] = useState<KnowledgePacket[]>([]);
  const [appliedPackets, setAppliedPackets] = useState<{
    assistant: KnowledgePacket[];
    build: KnowledgePacket[];
  }>({ assistant: [], build: [] });
  const [selectedPacket, setSelectedPacket] = useState<KnowledgePacket | null>(null);
  const [applyingPacket, setApplyingPacket] = useState<string | null>(null);

  // Load marketplace packets
  const loadPackets = useCallback(async () => {
    setLoading(true);
    try {
      const result = await masterRpcClient.listMarketplacePackets({
        targetMode: targetMode === 'all' ? undefined : targetMode,
        type: typeFilter === 'all' ? undefined : typeFilter,
      });
      setPackets(result.packets);
    } catch (error) {
      console.error('[Marketplace] Failed to load packets:', error);
    } finally {
      setLoading(false);
    }
  }, [targetMode, typeFilter]);

  // Load applied packets
  const loadAppliedPackets = useCallback(async () => {
    try {
      const result = await masterRpcClient.getUserAppliedPackets();
      setAppliedPackets({
        assistant: result.assistant,
        build: result.build,
      });
    } catch (error) {
      console.error('[Marketplace] Failed to load applied packets:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadPackets();
    loadAppliedPackets();
  }, [loadPackets, loadAppliedPackets]);

  // Reload when filters change
  useEffect(() => {
    loadPackets();
  }, [targetMode, typeFilter, loadPackets]);

  // Apply packet to mode
  const handleApplyPacket = async (packet: KnowledgePacket, mode: 'assistant' | 'build') => {
    setApplyingPacket(packet.id);
    try {
      const result = await masterRpcClient.applyPacket(packet.id, mode);
      if (result) {
        // Update local state
        setAppliedPackets((prev) => ({
          ...prev,
          [mode]: [...prev[mode], packet],
        }));
        onPacketApplied?.(packet, mode);
      }
    } catch (error) {
      console.error('[Marketplace] Failed to apply packet:', error);
    } finally {
      setApplyingPacket(null);
    }
  };

  // Remove packet from mode
  const handleRemovePacket = async (packetId: string, mode: 'assistant' | 'build') => {
    setApplyingPacket(packetId);
    try {
      const success = await masterRpcClient.unapplyPacket(packetId, mode);
      if (success) {
        // Update local state
        setAppliedPackets((prev) => ({
          ...prev,
          [mode]: prev[mode].filter((p) => p.id !== packetId),
        }));
        onPacketRemoved?.(packetId, mode);
      }
    } catch (error) {
      console.error('[Marketplace] Failed to remove packet:', error);
    } finally {
      setApplyingPacket(null);
    }
  };

  // Check if packet is applied to a mode
  const isPacketApplied = (packetId: string, mode: 'assistant' | 'build'): boolean => {
    return appliedPackets[mode].some((p) => p.id === packetId);
  };

  // Filter packets by search
  const filteredPackets = packets.filter((packet) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      packet.title.toLowerCase().includes(query) ||
      packet.summary.toLowerCase().includes(query) ||
      packet.domain.toLowerCase().includes(query) ||
      packet.metadata.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  // Render packet card
  const renderPacketCard = (packet: KnowledgePacket, showApplyButtons: boolean = true) => {
    const isAppliedToAssistant = isPacketApplied(packet.id, 'assistant');
    const isAppliedToBuild = isPacketApplied(packet.id, 'build');
    const isApplying = applyingPacket === packet.id;

    return (
      <div
        key={packet.id}
        className={`
          p-4 rounded-lg border transition-all cursor-pointer
          ${selectedPacket?.id === packet.id
            ? 'bg-cyan-500/10 border-cyan-500'
            : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
          }
        `}
        onClick={() => setSelectedPacket(packet)}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className={`p-1.5 rounded ${PACKET_TYPE_COLORS[packet.type]}`}>
              {PACKET_TYPE_ICONS[packet.type]}
            </span>
            <div>
              <h4 className="font-medium text-white">{packet.title}</h4>
              <p className="text-xs text-gray-500">{packet.domain}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isAppliedToAssistant && (
              <span className="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400">
                <MessageSquare className="w-3 h-3 inline mr-1" />
                Assistant
              </span>
            )}
            {isAppliedToBuild && (
              <span className="px-2 py-0.5 text-xs rounded bg-orange-500/20 text-orange-400">
                <Wrench className="w-3 h-3 inline mr-1" />
                Build
              </span>
            )}
          </div>
        </div>

        {/* Summary */}
        <p className="text-sm text-gray-400 mb-3 line-clamp-2">{packet.summary}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {packet.metadata.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-400">
              {tag}
            </span>
          ))}
          {packet.metadata.tags.length > 3 && (
            <span className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-500">
              +{packet.metadata.tags.length - 3}
            </span>
          )}
        </div>

        {/* Apply buttons */}
        {showApplyButtons && (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                isAppliedToAssistant
                  ? handleRemovePacket(packet.id, 'assistant')
                  : handleApplyPacket(packet, 'assistant');
              }}
              disabled={isApplying}
              className={`
                flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded text-sm transition-colors
                ${isAppliedToAssistant
                  ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }
                disabled:opacity-50
              `}
            >
              {isApplying ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : isAppliedToAssistant ? (
                <>
                  <Minus className="w-3 h-3" /> Remove
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3" /> Assistant
                </>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                isAppliedToBuild
                  ? handleRemovePacket(packet.id, 'build')
                  : handleApplyPacket(packet, 'build');
              }}
              disabled={isApplying}
              className={`
                flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded text-sm transition-colors
                ${isAppliedToBuild
                  ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }
                disabled:opacity-50
              `}
            >
              {isApplying ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : isAppliedToBuild ? (
                <>
                  <Minus className="w-3 h-3" /> Remove
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3" /> Build
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">Knowledge Marketplace</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {appliedPackets.assistant.length + appliedPackets.build.length} packets applied
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('browse')}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${activeTab === 'browse'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-gray-800 text-gray-400 hover:text-gray-300'
              }
            `}
          >
            <Search className="w-4 h-4 inline mr-2" />
            Browse
          </button>
          <button
            onClick={() => setActiveTab('applied')}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${activeTab === 'applied'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-gray-800 text-gray-400 hover:text-gray-300'
              }
            `}
          >
            <Sparkles className="w-4 h-4 inline mr-2" />
            My Packets ({appliedPackets.assistant.length + appliedPackets.build.length})
          </button>
        </div>

        {/* Search and Filters (Browse tab only) */}
        {activeTab === 'browse' && (
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search packets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              {/* Mode filter */}
              <select
                value={targetMode}
                onChange={(e) => setTargetMode(e.target.value as TargetMode)}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Modes</option>
                <option value="assistant">Assistant</option>
                <option value="build">Build</option>
              </select>

              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as PacketType | 'all')}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Types</option>
                <option value="research">Research</option>
                <option value="protocol">Protocol</option>
                <option value="insight">Insight</option>
                <option value="documentation">Documentation</option>
                <option value="pattern">Pattern</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'browse' ? (
          /* Browse Tab */
          loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          ) : filteredPackets.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No knowledge packets found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredPackets.map((packet) => renderPacketCard(packet))}
            </div>
          )
        ) : (
          /* Applied Tab */
          <div className="space-y-6">
            {/* Assistant packets */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <h3 className="font-medium text-white">Assistant Mode</h3>
                <span className="text-xs text-gray-500">
                  ({appliedPackets.assistant.length} packets)
                </span>
              </div>
              {appliedPackets.assistant.length === 0 ? (
                <p className="text-sm text-gray-500 ml-6">No packets applied to Assistant mode</p>
              ) : (
                <div className="grid gap-3">
                  {appliedPackets.assistant.map((packet) => (
                    <div
                      key={packet.id}
                      className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`p-1.5 rounded ${PACKET_TYPE_COLORS[packet.type]}`}>
                          {PACKET_TYPE_ICONS[packet.type]}
                        </span>
                        <div>
                          <h4 className="text-sm font-medium text-white">{packet.title}</h4>
                          <p className="text-xs text-gray-500">{packet.domain}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemovePacket(packet.id, 'assistant')}
                        disabled={applyingPacket === packet.id}
                        className="p-1.5 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        {applyingPacket === packet.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Build packets */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="w-4 h-4 text-orange-400" />
                <h3 className="font-medium text-white">Build Mode</h3>
                <span className="text-xs text-gray-500">
                  ({appliedPackets.build.length} packets)
                </span>
              </div>
              {appliedPackets.build.length === 0 ? (
                <p className="text-sm text-gray-500 ml-6">No packets applied to Build mode</p>
              ) : (
                <div className="grid gap-3">
                  {appliedPackets.build.map((packet) => (
                    <div
                      key={packet.id}
                      className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`p-1.5 rounded ${PACKET_TYPE_COLORS[packet.type]}`}>
                          {PACKET_TYPE_ICONS[packet.type]}
                        </span>
                        <div>
                          <h4 className="text-sm font-medium text-white">{packet.title}</h4>
                          <p className="text-xs text-gray-500">{packet.domain}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemovePacket(packet.id, 'build')}
                        disabled={applyingPacket === packet.id}
                        className="p-1.5 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        {applyingPacket === packet.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Packet Detail Sidebar */}
      {selectedPacket && (
        <div className="border-t border-gray-700 p-4 bg-gray-900/50">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`p-2 rounded ${PACKET_TYPE_COLORS[selectedPacket.type]}`}>
                {PACKET_TYPE_ICONS[selectedPacket.type]}
              </span>
              <div>
                <h3 className="font-medium text-white">{selectedPacket.title}</h3>
                <p className="text-xs text-gray-500">
                  {selectedPacket.domain} • v{selectedPacket.metadata.version}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedPacket(null)}
              className="p-1 text-gray-400 hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-gray-400 mb-3">{selectedPacket.summary}</p>
          <div className="flex flex-wrap gap-1 mb-3">
            {selectedPacket.metadata.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-400">
                {tag}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleApplyPacket(selectedPacket, 'assistant')}
              disabled={applyingPacket === selectedPacket.id || isPacketApplied(selectedPacket.id, 'assistant')}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${isPacketApplied(selectedPacket.id, 'assistant')
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-purple-600 text-white hover:bg-purple-500'
                }
                disabled:opacity-50
              `}
            >
              {isPacketApplied(selectedPacket.id, 'assistant') ? (
                <>
                  <Check className="w-4 h-4" /> Applied
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4" /> Apply to Assistant
                </>
              )}
            </button>
            <button
              onClick={() => handleApplyPacket(selectedPacket, 'build')}
              disabled={applyingPacket === selectedPacket.id || isPacketApplied(selectedPacket.id, 'build')}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${isPacketApplied(selectedPacket.id, 'build')
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-orange-600 text-white hover:bg-orange-500'
                }
                disabled:opacity-50
              `}
            >
              {isPacketApplied(selectedPacket.id, 'build') ? (
                <>
                  <Check className="w-4 h-4" /> Applied
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4" /> Apply to Build
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default KnowledgeMarketplace;
