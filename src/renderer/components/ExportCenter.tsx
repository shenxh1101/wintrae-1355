import { useState, useMemo } from 'react';
import {
  Download,
  FileText,
  ListOrdered,
  Image,
  Copy,
  Check,
  Plus,
  Trash2,
  Settings2,
  Save,
  Calendar,
  Hash,
  Clock,
  Volume2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useStore, useCurrentEpisode } from '../store';
import { formatDuration, formatTimestamp, EPISODE_STATUS_LABELS, parseTimeString } from '@shared/utils';
import type { TimelineEntry, EpisodeProgress } from '@shared/types';
import { renderEpisodeAudio } from '../utils/audioProcessor';
import { encodeWav, encodeMp3 } from '../utils/audioEncoder';

export default function ExportCenter() {
  const episode = useCurrentEpisode();
  const setDescription = useStore((s) => s.setDescription);
  const setTimeline = useStore((s) => s.setTimeline);
  const setCoverCheck = useStore((s) => s.setCoverCheck);
  const setExportConfig = useStore((s) => s.setExportConfig);

  const [copiedDesc, setCopiedDesc] = useState(false);
  const [copiedTimeline, setCopiedTimeline] = useState(false);
  const [newTimelineTime, setNewTimelineTime] = useState('');
  const [newTimelineTitle, setNewTimelineTitle] = useState('');
  const [newTimelineDesc, setNewTimelineDesc] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  if (!episode) return null;

  const totalDuration = useMemo(() => {
    let dur = 0;
    if (episode.intro) dur += episode.intro.duration;
    for (const seg of episode.segments) {
      dur += seg.endTime - seg.startTime;
    }
    if (episode.outro) dur += episode.outro.duration;
    return dur;
  }, [episode]);

  const pendingReviews = episode.reviewItems.filter((r) => r.status !== 'resolved').length;

  const timelineText = useMemo(() => {
    const lines: string[] = [];
    const allEntries = [...episode.timeline].sort((a, b) => a.time - b.time);
    for (const entry of allEntries) {
      const ts = formatTimestamp(entry.time);
      if (entry.description) {
        lines.push(`${ts} ${entry.title} — ${entry.description}`);
      } else {
        lines.push(`${ts} ${entry.title}`);
      }
    }
    return lines.join('\n');
  }, [episode.timeline]);

  const copyText = async (text: string, type: 'desc' | 'timeline') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'desc') {
        setCopiedDesc(true);
        setTimeout(() => setCopiedDesc(false), 2000);
      } else {
        setCopiedTimeline(true);
        setTimeout(() => setCopiedTimeline(false), 2000);
      }
    } catch {
      /* ignore */
    }
  };

  const handleAddTimeline = () => {
    if (!newTimelineTitle.trim()) return;
    const parsed = parseTimeString(newTimelineTime);
    const time = parsed !== null ? parsed : 0;
    const entry: TimelineEntry = {
      time,
      title: newTimelineTitle.trim(),
      description: newTimelineDesc.trim() || undefined
    };
    setTimeline([...episode.timeline, entry].sort((a, b) => a.time - b.time));
    setNewTimelineTime('');
    setNewTimelineTitle('');
    setNewTimelineDesc('');
  };

  const handleDeleteTimeline = (idx: number) => {
    const updated = episode.timeline.filter((_, i) => i !== idx);
    setTimeline(updated);
  };

  const handleExportAudio = async () => {
    if (exporting || !episode) return;
    if (episode.segments.length === 0 && !episode.intro && !episode.outro) {
      alert('没有可导出的音频内容，请先在剪辑台添加片段。');
      return;
    }

    setExporting(true);
    setExportProgress('正在选择保存路径...');

    try {
      const ext = episode.exportFormat;
      const safeTitle = (episode.title || 'episode').replace(/[\\/:*?"<>|]/g, '_');
      const defaultName = `${episode.episodeNumber ? episode.episodeNumber + ' - ' : ''}${safeTitle}.${ext}`;

      let filePath: string | undefined;
      if (window.electronAPI) {
        filePath = await window.electronAPI.saveFile(defaultName);
      }
      if (!filePath) {
        setExporting(false);
        setExportProgress('');
        return;
      }

      setExportProgress('正在解码音频素材...');
      const rendered = await renderEpisodeAudio(episode, episode.targetVolumeDb);

      setExportProgress(`正在编码为 ${ext.toUpperCase()} ...`);
      let fileData: ArrayBuffer | Int8Array;

      if (ext === 'wav') {
        fileData = encodeWav(rendered);
      } else if (ext === 'mp3') {
        fileData = await encodeMp3(rendered, episode.exportBitrate);
      } else {
        fileData = encodeWav(rendered);
        filePath = filePath.replace(/\.[^.]+$/, '.wav');
      }

      setExportProgress('正在写入文件...');
      if (window.electronAPI) {
        const arr = fileData instanceof Int8Array
          ? Array.from(fileData)
          : Array.from(new Uint8Array(fileData));
        await window.electronAPI.writeBinaryFile(filePath, arr);
      }

      setExportProgress('导出完成！');
      setTimeout(() => setExportProgress(''), 3000);
    } catch (e) {
      console.error('Export failed:', e);
      setExportProgress(`导出失败: ${e instanceof Error ? e.message : String(e)}`);
      setTimeout(() => setExportProgress(''), 5000);
    } finally {
      setExporting(false);
    }
  };

  const handleGenerateTimelineFromChapters = () => {
    const fromChapters = episode.chapters.map((c) => ({
      time: c.time,
      title: c.title,
      description: c.description
    }));
    const merged: TimelineEntry[] = [...fromChapters];
    for (const existing of episode.timeline) {
      if (!merged.find((m) => Math.abs(m.time - existing.time) < 0.1 && m.title === existing.title)) {
        merged.push(existing);
      }
    }
    setTimeline(merged.sort((a, b) => a.time - b.time));
  };

  const progressPercent = useMemo(() => {
    let score = 0;
    if (episode.title) score += 10;
    if (episode.description && episode.description.length > 50) score += 15;
    if (episode.segments.length > 0) score += 20;
    if (episode.chapters.length > 0) score += 10;
    if (episode.timeline.length > 0) score += 15;
    const coverDone = episode.coverChecks.filter((c) => c.checked).length;
    score += Math.round((coverDone / episode.coverChecks.length) * 15);
    if (pendingReviews === 0 && episode.reviewItems.length > 0) score += 15;
    else if (episode.reviewItems.length === 0) score += 0;
    return Math.min(100, score);
  }, [episode, pendingReviews]);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-1 flex-col overflow-y-auto p-4">
        <div className="mb-4 card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">制作进度总览</h2>
              <div className="mt-1 flex items-center gap-3 text-sm text-dark-400">
                <span className="inline-flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" />
                  {episode.episodeNumber || '未编号'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(totalDuration)}
                </span>
                <span className="rounded bg-dark-700 px-2 py-0.5 text-xs font-medium text-dark-200">
                  {EPISODE_STATUS_LABELS[episode.status]}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary-400">{progressPercent}%</div>
              <div className="text-xs text-dark-500">完成度</div>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-dark-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3 text-center text-xs">
            <div className="rounded bg-dark-800 p-2">
              <div className="text-lg font-semibold text-dark-100">{episode.materials.length}</div>
              <div className="text-dark-400">素材</div>
            </div>
            <div className="rounded bg-dark-800 p-2">
              <div className="text-lg font-semibold text-dark-100">{episode.segments.length}</div>
              <div className="text-dark-400">片段</div>
            </div>
            <div className="rounded bg-dark-800 p-2">
              <div className="text-lg font-semibold text-dark-100">{episode.chapters.length}</div>
              <div className="text-dark-400">章节</div>
            </div>
            <div className={`rounded p-2 ${pendingReviews > 0 ? 'bg-amber-500/10' : 'bg-green-500/10'}`}>
              <div className={`text-lg font-semibold ${pendingReviews > 0 ? 'text-amber-300' : 'text-green-300'}`}>
                {pendingReviews}/{episode.reviewItems.length}
              </div>
              <div className="text-dark-400">待处理审听</div>
            </div>
          </div>
          {pendingReviews > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              <AlertCircle className="h-4 w-4" />
              还有 {pendingReviews} 项审听问题未解决，建议处理完成后再导出
            </div>
          )}
        </div>

        <div className="mb-4 card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold">
              <FileText className="h-4 w-4 text-primary-400" />
              节目简介
            </h3>
            <button
              className="btn btn-secondary flex items-center gap-1 text-xs"
              onClick={() => copyText(episode.description, 'desc')}
            >
              {copiedDesc ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedDesc ? '已复制' : '复制'}
            </button>
          </div>
          <textarea
            className="input min-h-[160px] w-full resize-y leading-relaxed"
            placeholder="在这里填写本期节目简介，包括主要话题、亮点介绍、嘉宾信息等..."
            value={episode.description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="mt-1 text-right text-xs text-dark-500">
            {episode.description.length} 字符
          </div>
        </div>

        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold">
              <ListOrdered className="h-4 w-4 text-primary-400" />
              时间轴文案
            </h3>
            <div className="flex items-center gap-2">
              {episode.chapters.length > 0 && (
                <button
                  className="btn btn-secondary text-xs"
                  onClick={handleGenerateTimelineFromChapters}
                >
                  从章节标记生成
                </button>
              )}
              <button
                className="btn btn-secondary flex items-center gap-1 text-xs"
                onClick={() => copyText(timelineText, 'timeline')}
              >
                {copiedTimeline ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedTimeline ? '已复制' : '复制全部'}
              </button>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-12 gap-2">
            <input
              type="text"
              className="input col-span-3 font-mono"
              placeholder="时间 如 120"
              value={newTimelineTime}
              onChange={(e) => setNewTimelineTime(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTimeline()}
            />
            <input
              type="text"
              className="input col-span-4"
              placeholder="小节标题"
              value={newTimelineTitle}
              onChange={(e) => setNewTimelineTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTimeline()}
            />
            <input
              type="text"
              className="input col-span-4"
              placeholder="简要描述 (可选)"
              value={newTimelineDesc}
              onChange={(e) => setNewTimelineDesc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTimeline()}
            />
            <button
              className="btn btn-primary col-span-1 flex items-center justify-center gap-1"
              onClick={handleAddTimeline}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[280px] space-y-1.5 overflow-y-auto">
            {episode.timeline.length === 0 ? (
              <div className="py-6 text-center text-sm text-dark-500">
                暂无时间轴文案，请手动添加或从章节标记生成
              </div>
            ) : (
              [...episode.timeline]
                .sort((a, b) => a.time - b.time)
                .map((entry, idx) => (
                  <div
                    key={idx}
                    className="group flex items-start gap-3 rounded-md border border-dark-700 bg-dark-800/50 p-2"
                  >
                    <span className="mt-0.5 w-24 flex-shrink-0 font-mono text-xs text-primary-400">
                      {formatTimestamp(entry.time)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <input
                        type="text"
                        className="w-full bg-transparent text-sm font-medium text-dark-100 focus:outline-none"
                        value={entry.title}
                        onChange={(e) => {
                          const updated = [...episode.timeline];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setTimeline(updated);
                        }}
                      />
                      {entry.description && (
                        <input
                          type="text"
                          className="mt-0.5 w-full bg-transparent text-xs text-dark-400 focus:outline-none"
                          value={entry.description}
                          onChange={(e) => {
                            const updated = [...episode.timeline];
                            updated[idx] = { ...updated[idx], description: e.target.value };
                            setTimeline(updated);
                          }}
                        />
                      )}
                    </div>
                    <button
                      className="btn btn-ghost p-1 opacity-0 transition-opacity group-hover:opacity-100 text-red-400 hover:text-red-300"
                      onClick={() => handleDeleteTimeline(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      <aside className="flex w-80 flex-col border-l border-dark-800 bg-dark-900">
        <div className="border-b border-dark-800 p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Image className="h-4 w-4 text-primary-400" />
            封面检查项
          </h3>
          <div className="space-y-2">
            {episode.coverChecks.map((check) => (
              <label
                key={check.id}
                className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-dark-800"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-dark-600 bg-dark-800 text-primary-600 focus:ring-primary-500"
                  checked={check.checked}
                  onChange={(e) => setCoverCheck(check.id, e.target.checked)}
                />
                <span className={`text-sm ${check.checked ? 'text-dark-400 line-through' : 'text-dark-200'}`}>
                  {check.label}
                </span>
              </label>
            ))}
          </div>
          <div className="mt-2 text-xs text-dark-500">
            已完成 {episode.coverChecks.filter((c) => c.checked).length}/{episode.coverChecks.length}
          </div>
        </div>

        <div className="border-b border-dark-800 p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Settings2 className="h-4 w-4 text-primary-400" />
            导出配置
          </h3>
          <div className="space-y-3">
            <div>
              <label className="label mb-1 block">音频格式</label>
              <select
                className="input w-full"
                value={episode.exportFormat}
                onChange={(e) =>
                  setExportConfig(
                    e.target.value as EpisodeProgress['exportFormat'],
                    episode.exportBitrate,
                    episode.targetVolumeDb
                  )
                }
              >
                <option value="mp3">MP3 (通用)</option>
                <option value="wav">WAV (无损)</option>
                <option value="m4a">M4A/AAC (高效)</option>
                <option value="flac">FLAC (无损压缩)</option>
              </select>
            </div>
            <div>
              <label className="label mb-1 block flex items-center justify-between">
                <span>比特率</span>
                <span className="font-mono text-primary-400">{episode.exportBitrate} kbps</span>
              </label>
              <input
                type="range"
                min={64}
                max={320}
                step={32}
                value={episode.exportBitrate}
                onChange={(e) =>
                  setExportConfig(
                    episode.exportFormat,
                    parseInt(e.target.value),
                    episode.targetVolumeDb
                  )
                }
                className="w-full"
              />
              <div className="mt-0.5 flex justify-between text-xs text-dark-500">
                <span>64</span>
                <span>192</span>
                <span>320</span>
              </div>
            </div>
            <div>
              <label className="label mb-1 block flex items-center gap-1">
                <Volume2 className="h-3 w-3" /> 目标响度
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="input flex-1"
                  value={episode.targetVolumeDb}
                  onChange={(e) =>
                    setExportConfig(
                      episode.exportFormat,
                      episode.exportBitrate,
                      parseFloat(e.target.value) || 0
                    )
                  }
                  step={0.5}
                />
                <span className="text-sm text-dark-400">LUFS</span>
              </div>
              <p className="mt-1 text-xs text-dark-500">播客推荐 -16 ~ -14 LUFS</p>
            </div>
          </div>
        </div>

        <div className="flex-1" />

        <div className="border-t border-dark-800 p-4">
          <div className="mb-2 text-xs text-dark-500 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            最后更新：{new Date(episode.updatedAt).toLocaleString('zh-CN')}
          </div>
          <button
            className="btn btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-base"
            onClick={handleExportAudio}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Download className="h-5 w-5" />
                导出音频文件
              </>
            )}
          </button>
          {exportProgress && (
            <div className={`mt-2 rounded-md px-3 py-2 text-xs ${
              exportProgress.includes('失败') ? 'bg-red-500/10 text-red-300' :
              exportProgress.includes('完成') ? 'bg-green-500/10 text-green-300' :
              'bg-primary-500/10 text-primary-300'
            }`}>
              {exportProgress}
            </div>
          )}
          <button
            className="btn btn-secondary mt-2 flex w-full items-center justify-center gap-1.5"
            onClick={() => {
              alert('进度已自动保存。所有数据实时持久化到本地存储。');
            }}
          >
            <Save className="h-4 w-4" />
            手动保存进度
          </button>
        </div>
      </aside>
    </div>
  );
}
