import { useState, useMemo } from 'react';
import {
  Plus,
  Filter,
  AlertCircle,
  MicOff,
  AlertTriangle,
  VolumeX,
  MoreHorizontal,
  Trash2,
  Check,
  Clock,
  MessageSquare,
  Edit3,
  Search,
  MessageCircle
} from 'lucide-react';
import { useStore, useCurrentEpisode } from '../store';
import {
  formatTimestamp,
  REVIEW_ISSUE_LABELS,
  REVIEW_STATUS_LABELS
} from '@shared/utils';
import type { ReviewIssueType, ReviewStatus } from '@shared/types';

const ISSUE_ICONS: Record<ReviewIssueType, React.ComponentType<{ className?: string }>> = {
  slip: AlertCircle,
  silence: MicOff,
  sensitive: AlertTriangle,
  noise: VolumeX,
  other: MoreHorizontal
};

const ISSUE_COLORS: Record<ReviewIssueType, string> = {
  slip: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  silence: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  sensitive: 'bg-red-500/20 text-red-300 border-red-500/30',
  noise: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  other: 'bg-dark-600/50 text-dark-300 border-dark-600'
};

const STATUS_COLORS: Record<ReviewStatus, string> = {
  pending: 'bg-amber-500/20 text-amber-300',
  in_progress: 'bg-blue-500/20 text-blue-300',
  resolved: 'bg-green-500/20 text-green-300'
};

export default function ReviewList() {
  const episode = useCurrentEpisode();
  const addReviewItem = useStore((s) => s.addReviewItem);
  const updateReviewItem = useStore((s) => s.updateReviewItem);
  const deleteReviewItem = useStore((s) => s.deleteReviewItem);

  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<ReviewIssueType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newTime, setNewTime] = useState('');
  const [newType, setNewType] = useState<ReviewIssueType>('slip');
  const [newDesc, setNewDesc] = useState('');
  const [newSuggestion, setNewSuggestion] = useState('');
  const [newSegmentId, setNewSegmentId] = useState<string | undefined>(undefined);

  const filteredItems = useMemo(() => {
    if (!episode) return [];
    return episode.reviewItems
      .filter((item) => {
        if (filterType !== 'all' && item.type !== filterType) return false;
        if (filterStatus !== 'all' && item.status !== filterStatus) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (
            !item.description.toLowerCase().includes(q) &&
            !(item.suggestion || '').toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => a.time - b.time);
  }, [episode, filterType, filterStatus, searchQuery]);

  const stats = useMemo(() => {
    if (!episode)
      return { total: 0, pending: 0, in_progress: 0, resolved: 0 };
    return {
      total: episode.reviewItems.length,
      pending: episode.reviewItems.filter((r) => r.status === 'pending').length,
      in_progress: episode.reviewItems.filter((r) => r.status === 'in_progress').length,
      resolved: episode.reviewItems.filter((r) => r.status === 'resolved').length
    };
  }, [episode]);

  const handleSubmit = () => {
    if (!newDesc.trim()) return;
    const time = parseFloat(newTime) || 0;
    addReviewItem({
      segmentId: newSegmentId,
      time,
      type: newType,
      description: newDesc.trim(),
      suggestion: newSuggestion.trim() || undefined,
      status: 'pending'
    });
    setNewTime('');
    setNewDesc('');
    setNewSuggestion('');
    setNewType('slip');
    setNewSegmentId(undefined);
    setShowForm(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-dark-800 bg-dark-900 p-4">
        <div className="flex items-center gap-3">
          <button
            className="btn btn-primary flex items-center gap-1.5"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-4 w-4" />
            记录问题
          </button>

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
            <input
              type="text"
              className="input w-full pl-9"
              placeholder="搜索问题描述..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Filter className="h-4 w-4 text-dark-500" />
          <select
            className="input"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as ReviewIssueType | 'all')}
          >
            <option value="all">全部类型</option>
            <option value="slip">口误</option>
            <option value="silence">空白</option>
            <option value="sensitive">敏感词</option>
            <option value="noise">背景噪声</option>
            <option value="other">其他</option>
          </select>
          <select
            className="input"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ReviewStatus | 'all')}
          >
            <option value="all">全部状态</option>
            <option value="pending">待处理</option>
            <option value="in_progress">处理中</option>
            <option value="resolved">已解决</option>
          </select>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg bg-dark-800 px-3 py-1.5 text-sm">
            <span className="text-dark-400">总计</span>
            <span className="font-semibold text-dark-100">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-sm">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-amber-300">{stats.pending}</span>
            <span className="text-amber-400/60">待处理</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-1.5 text-sm">
            <MessageCircle className="h-4 w-4 text-blue-400" />
            <span className="text-blue-300">{stats.in_progress}</span>
            <span className="text-blue-400/60">处理中</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-1.5 text-sm">
            <Check className="h-4 w-4 text-green-400" />
            <span className="text-green-300">{stats.resolved}</span>
            <span className="text-green-400/60">已解决</span>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="border-b border-dark-800 bg-dark-850 p-4" style={{ background: '#1a2332' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label mb-1 block">时间点 (秒)</label>
              <input
                type="text"
                className="input w-full font-mono"
                placeholder="如 120.5 或 02:00.500"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              />
            </div>
            <div>
              <label className="label mb-1 block">问题类型</label>
              <select
                className="input w-full"
                value={newType}
                onChange={(e) => setNewType(e.target.value as ReviewIssueType)}
              >
                <option value="slip">口误</option>
                <option value="silence">空白</option>
                <option value="sensitive">敏感词</option>
                <option value="noise">背景噪声</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div>
              <label className="label mb-1 block">关联片段 (可选)</label>
              <select
                className="input w-full"
                value={newSegmentId || ''}
                onChange={(e) => setNewSegmentId(e.target.value || undefined)}
              >
                <option value="">不关联</option>
                {episode?.segments.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    #{i + 1} {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div />
            <div className="col-span-2">
              <label className="label mb-1 block">问题描述</label>
              <textarea
                className="input w-full"
                rows={2}
                placeholder="详细描述发现的问题..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="label mb-1 block flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> 修改意见 (可选)
              </label>
              <textarea
                className="input w-full"
                rows={2}
                placeholder="建议如何修改..."
                value={newSuggestion}
                onChange={(e) => setNewSuggestion(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!newDesc.trim()}
            >
              添加记录
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {filteredItems.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-dark-500">
            <AlertCircle className="mb-3 h-16 w-16 opacity-50" />
            <p className="text-lg font-medium">暂无审听问题</p>
            <p className="mt-1 text-sm">点击「记录问题」按钮添加待处理项</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const Icon = ISSUE_ICONS[item.type];
              const seg = episode?.segments.find((s) => s.id === item.segmentId);
              const isEditing = editingId === item.id;
              return (
                <div
                  key={item.id}
                  className={`card p-4 ${ISSUE_COLORS[item.type]} border-l-4`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0 rounded-md bg-dark-900/60 p-2">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`tag-chip ${STATUS_COLORS[item.status]}`}>
                          {REVIEW_STATUS_LABELS[item.status]}
                        </span>
                        <span className="tag-chip bg-dark-900/60 text-dark-300">
                          {REVIEW_ISSUE_LABELS[item.type]}
                        </span>
                        <span className="font-mono text-sm text-dark-300">
                          {formatTimestamp(item.time)}
                        </span>
                        {seg && (
                          <span className="text-xs text-dark-400">· 片段: {seg.name}</span>
                        )}
                      </div>
                      {isEditing ? (
                        <textarea
                          className="input mt-2 w-full"
                          rows={2}
                          defaultValue={item.description}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onBlur={(e) => {
                            updateReviewItem(item.id, { description: e.target.value });
                            setEditingId(null);
                          }}
                        />
                      ) : (
                        <p className="mt-2 text-sm text-dark-100">{item.description}</p>
                      )}
                      {item.suggestion && (
                        <div className="mt-2 rounded-md bg-dark-900/50 p-2">
                          <div className="mb-1 flex items-center gap-1 text-xs text-dark-400">
                            <MessageSquare className="h-3 w-3" />
                            修改意见
                          </div>
                          {isEditing ? (
                            <textarea
                              className="input w-full"
                              rows={2}
                              defaultValue={item.suggestion}
                              onBlur={(e) => {
                                updateReviewItem(item.id, { suggestion: e.target.value });
                              }}
                            />
                          ) : (
                            <p className="text-xs text-dark-300">{item.suggestion}</p>
                          )}
                        </div>
                      )}
                      <div className="mt-2 text-xs text-dark-500">
                        创建于 {new Date(item.createdAt).toLocaleString('zh-CN')}
                        {item.updatedAt !== item.createdAt &&
                          ` · 更新于 ${new Date(item.updatedAt).toLocaleString('zh-CN')}`}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <select
                        className="input text-xs"
                        style={{ width: 80 }}
                        value={item.status}
                        onChange={(e) =>
                          updateReviewItem(item.id, {
                            status: e.target.value as ReviewStatus
                          })
                        }
                      >
                        <option value="pending">待处理</option>
                        <option value="in_progress">处理中</option>
                        <option value="resolved">已解决</option>
                      </select>
                      <div className="flex gap-1">
                        <button
                          className="btn btn-ghost p-1"
                          onClick={() => setEditingId(isEditing ? null : item.id)}
                          title="编辑"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          className="btn btn-ghost p-1 text-red-400 hover:text-red-300"
                          onClick={() => deleteReviewItem(item.id)}
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
