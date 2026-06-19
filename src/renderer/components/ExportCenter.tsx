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
  Loader2,
  X,
  AlertTriangle,
  CheckCircle,
  FolderOpen,
  Package,
  Music,
  History,
  RefreshCw,
  ExternalLink,
  File,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { useStore, useCurrentEpisode } from '../store';
import { formatDuration, formatTimestamp, EPISODE_STATUS_LABELS, parseTimeString, formatFileSize } from '@shared/utils';
import type { TimelineEntry, EpisodeProgress, ExportRecord } from '@shared/types';
import { renderEpisodeAudio } from '../utils/audioProcessor';
import { encodeWav, encodeMp3 } from '../utils/audioEncoder';
import {
  runPreCheck,
  exportReleasePackage,
  buildBaseName,
  type PreCheckResult,
  type PreCheckIssue,
  type ExportPackageResult
} from '../utils/exportUtils';

export default function ExportCenter() {
  const episode = useCurrentEpisode();
  const setDescription = useStore((s) => s.setDescription);
  const setTimeline = useStore((s) => s.setTimeline);
  const setCoverCheck = useStore((s) => s.setCoverCheck);
  const setExportConfig = useStore((s) => s.setExportConfig);
  const addExportRecord = useStore((s) => s.addExportRecord);
  const deleteExportRecord = useStore((s) => s.deleteExportRecord);
  const allExportRecords = useStore((s) => s.exportRecords);

  const [copiedDesc, setCopiedDesc] = useState(false);
  const [copiedTimeline, setCopiedTimeline] = useState(false);
  const [newTimelineTime, setNewTimelineTime] = useState('');
  const [newTimelineTitle, setNewTimelineTitle] = useState('');
  const [newTimelineDesc, setNewTimelineDesc] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [showPreCheck, setShowPreCheck] = useState(false);
  const [preCheckResult, setPreCheckResult] = useState<PreCheckResult | null>(null);
  const [preCheckRunning, setPreCheckRunning] = useState(false);
  const [pendingExportMode, setPendingExportMode] = useState<'audio' | 'package' | null>(null);
  const [exportedFiles, setExportedFiles] = useState<string[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

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

  const currentExportRecords = useMemo(
    () => allExportRecords.filter((r) => r.episodeId === episode.id),
    [allExportRecords, episode?.id]
  );

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

  const doPreCheck = async (mode: 'audio' | 'package') => {
    setPreCheckRunning(true);
    setShowPreCheck(true);
    setPendingExportMode(mode);
    setPreCheckResult(null);

    try {
      const result = await runPreCheck(episode);
      setPreCheckResult(result);
    } finally {
      setPreCheckRunning(false);
    }
  };

  const handleExportAudio = async () => {
    if (exporting) return;
    await doPreCheck('audio');
  };

  const proceedWithExportAudio = async () => {
    if (!episode) return;
    setExporting(true);
    setExportProgress('正在选择保存路径...');
    setShowPreCheck(false);
    setPendingExportMode(null);

    try {
      const ext = episode.exportFormat;
      const defaultName = `${buildBaseName(episode)}.${ext}`;

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
      } else {
        fileData = await encodeMp3(rendered, episode.exportBitrate);
      }

      setExportProgress('正在写入文件...');
      if (window.electronAPI) {
        const arr = fileData instanceof Int8Array
          ? Array.from(fileData)
          : Array.from(new Uint8Array(fileData));
        await window.electronAPI.writeBinaryFile(filePath, arr);
        setExportedFiles([filePath]);

        const warnings = preCheckResult?.issues.filter((i) => i.type === 'warning').length || 0;
        const resolved = episode.reviewItems.filter((r) => r.status === 'resolved').length;
        const coverChecked = episode.coverChecks.filter((c) => c.checked).length;

        addExportRecord({
          episodeId: episode.id,
          mode: 'audio',
          exportedAt: new Date().toISOString(),
          targetPath: filePath,
          format: ext,
          bitrate: episode.exportBitrate,
          targetVolumeDb: episode.targetVolumeDb,
          totalDurationSeconds: totalDuration,
          reviewItemsTotal: episode.reviewItems.length,
          reviewItemsResolved: resolved,
          coverChecked,
          coverTotal: episode.coverChecks.length,
          preCheckWarnings: warnings,
          files: [
            {
              fileName: filePath.split('\\').pop() || defaultName,
              fileType: 'audio',
              sizeBytes: arr.length
            }
          ]
        });
      }

      setExportProgress('导出完成！');
      setTimeout(() => setExportProgress(''), 5000);
    } catch (e) {
      console.error('Export failed:', e);
      setExportProgress(`导出失败: ${e instanceof Error ? e.message : String(e)}`);
      setTimeout(() => setExportProgress(''), 8000);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPackage = async () => {
    if (exporting) return;
    await doPreCheck('package');
  };

  const proceedWithExportPackage = async () => {
    if (!episode) return;
    setExporting(true);
    setExportProgress('正在选择输出目录...');
    setShowPreCheck(false);
    setPendingExportMode(null);

    try {
      let directory: string | null = null;
      if (window.electronAPI) {
        directory = await window.electronAPI.selectDirectory();
      }
      if (!directory) {
        setExporting(false);
        setExportProgress('');
        return;
      }

      const result: ExportPackageResult = await exportReleasePackage({
        directory,
        episode,
        onProgress: (msg) => setExportProgress(msg)
      });

      setExportedFiles(result.filePaths);

      const warnings = preCheckResult?.issues.filter((i) => i.type === 'warning').length || 0;
      const resolved = episode.reviewItems.filter((r) => r.status === 'resolved').length;
      const coverChecked = episode.coverChecks.filter((c) => c.checked).length;

      addExportRecord({
        episodeId: episode.id,
        mode: 'package',
        exportedAt: new Date().toISOString(),
        targetPath: directory,
        format: episode.exportFormat,
        bitrate: episode.exportBitrate,
        targetVolumeDb: episode.targetVolumeDb,
        totalDurationSeconds: totalDuration,
        reviewItemsTotal: episode.reviewItems.length,
        reviewItemsResolved: resolved,
        coverChecked,
        coverTotal: episode.coverChecks.length,
        preCheckWarnings: warnings,
        files: result.fileRecords
      });

      setExportProgress(`发布包导出完成！共生成 ${result.filePaths.length} 个文件`);
      setTimeout(() => setExportProgress(''), 8000);
    } catch (e) {
      console.error('Package export failed:', e);
      setExportProgress(`导出失败: ${e instanceof Error ? e.message : String(e)}`);
      setTimeout(() => setExportProgress(''), 10000);
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

  const handleForceExport = () => {
    if (pendingExportMode === 'audio') {
      proceedWithExportAudio();
    } else if (pendingExportMode === 'package') {
      proceedWithExportPackage();
    }
  };

  const openRecordLocation = async (record: ExportRecord) => {
    if (!window.electronAPI) return;
    try {
      if (record.mode === 'audio') {
        await window.electronAPI.showItemInFolder(record.targetPath);
      } else {
        await window.electronAPI.openPath(record.targetPath);
      }
    } catch {
      /* ignore */
    }
  };

  const reExportFromRecord = async (record: ExportRecord) => {
    if (exporting) return;
    if (record.mode === 'audio') {
      await doPreCheck('audio');
    } else {
      await doPreCheck('package');
    }
  };

  const fileTypeLabel: Record<string, string> = {
    audio: '音频',
    description: '节目简介',
    timeline: '时间轴文案',
    cover: '封面检查清单',
    releaseNotes: '发布说明'
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

  const getIssueIcon = (issue: PreCheckIssue) => {
    if (issue.type === 'error') return <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />;
    return <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />;
  };

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
              placeholder="时间 如 120 / 02:00.500"
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
                <option value="mp3">MP3 (通用，兼容性好)</option>
                <option value="wav">WAV (无损，高质量)</option>
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

        <div className="flex-1 overflow-y-auto border-b border-dark-800">
          <button
            className="flex w-full items-center justify-between px-4 py-3 hover:bg-dark-800/50 transition-colors"
            onClick={() => setShowHistory((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary-400" />
              <span className="font-semibold text-sm">
                导出历史
              </span>
              <span className="rounded bg-dark-700 px-1.5 py-0.5 text-[10px] text-dark-300">
                {currentExportRecords.length}
              </span>
            </div>
            {showHistory ? (
              <ChevronDown className="h-4 w-4 text-dark-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-dark-400" />
            )}
          </button>
          {showHistory && (
            <div className="px-3 pb-3 space-y-2">
              {currentExportRecords.length === 0 ? (
                <div className="py-4 text-center text-xs text-dark-500">
                  暂无导出记录
                </div>
              ) : (
                currentExportRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded border border-dark-700 bg-dark-800/50 overflow-hidden"
                  >
                    <button
                      className="flex w-full items-center justify-between px-2.5 py-2 hover:bg-dark-800"
                      onClick={() =>
                        setHistoryExpanded((cur) => (cur === rec.id ? null : rec.id))
                      }
                    >
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-1.5">
                          {rec.mode === 'package' ? (
                            <Package className="h-3.5 w-3.5 text-primary-400" />
                          ) : (
                            <Music className="h-3.5 w-3.5 text-primary-400" />
                          )}
                          <span className="text-xs font-medium text-dark-200 truncate">
                            {rec.mode === 'package' ? '完整发布包' : '单音频'}
                          </span>
                          {rec.preCheckWarnings > 0 && (
                            <span className="rounded bg-amber-500/10 px-1 text-[10px] text-amber-300">
                              ⚠ {rec.preCheckWarnings}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-dark-500">
                          {new Date(rec.exportedAt).toLocaleString('zh-CN')}
                        </div>
                      </div>
                      {historyExpanded === rec.id ? (
                        <ChevronDown className="h-3.5 w-3.5 text-dark-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-dark-400 flex-shrink-0" />
                      )}
                    </button>
                    {historyExpanded === rec.id && (
                      <div className="border-t border-dark-700 bg-dark-850 p-2.5" style={{ background: '#0c1320' }}>
                        <div className="mb-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                          <div className="text-dark-500">格式</div>
                          <div className="text-dark-300">
                            {rec.format.toUpperCase()} · {rec.bitrate} kbps
                          </div>
                          <div className="text-dark-500">时长</div>
                          <div className="text-dark-300">{formatDuration(rec.totalDurationSeconds)}</div>
                          <div className="text-dark-500">审听</div>
                          <div className="text-dark-300">
                            {rec.reviewItemsResolved}/{rec.reviewItemsTotal}
                            {rec.reviewItemsTotal > 0 &&
                              rec.reviewItemsResolved === rec.reviewItemsTotal && (
                                <Check className="inline h-3 w-3 ml-1 text-green-400" />
                              )}
                          </div>
                          <div className="text-dark-500">封面</div>
                          <div className="text-dark-300">
                            {rec.coverChecked}/{rec.coverTotal}
                          </div>
                          <div className="text-dark-500 col-span-2 truncate">
                            {rec.targetPath}
                          </div>
                        </div>
                        <div className="mb-2">
                          <div className="mb-1 text-[11px] text-dark-500">文件清单</div>
                          <div className="space-y-1">
                            {rec.files.map((f, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-1.5 rounded bg-dark-800 px-2 py-1"
                              >
                                <File className="h-3 w-3 text-dark-400 flex-shrink-0" />
                                <span className="min-w-0 flex-1 truncate text-[11px] text-dark-300">
                                  {f.fileName}
                                </span>
                                <span className="text-[10px] text-dark-500">
                                  {fileTypeLabel[f.fileType]}
                                </span>
                                {typeof f.sizeBytes === 'number' && (
                                  <span className="text-[10px] text-dark-500">
                                    {formatFileSize(f.sizeBytes)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            className="btn btn-secondary flex-1 flex items-center justify-center gap-1 text-xs py-1"
                            onClick={() => openRecordLocation(rec)}
                          >
                            <FolderOpen className="h-3 w-3" />
                            打开文件夹
                          </button>
                          <button
                            className="btn btn-secondary flex-1 flex items-center justify-center gap-1 text-xs py-1"
                            onClick={() => reExportFromRecord(rec)}
                            disabled={exporting}
                          >
                            <RefreshCw className="h-3 w-3" />
                            按配置重新导出
                          </button>
                          <button
                            className="btn btn-ghost p-1 text-dark-500 hover:text-red-400"
                            onClick={() => deleteExportRecord(rec.id)}
                            title="删除此记录"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="border-t border-dark-800 p-4">
          <div className="mb-2 text-xs text-dark-500 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            最后更新：{new Date(episode.updatedAt).toLocaleString('zh-CN')}
          </div>
          <button
            className="btn btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-base"
            onClick={handleExportAudio}
            disabled={exporting || preCheckRunning}
          >
            {exporting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Music className="h-5 w-5" />
                仅导出音频
              </>
            )}
          </button>
          <button
            className="btn btn-primary mt-2 flex w-full items-center justify-center gap-2 py-2.5 text-base"
            onClick={handleExportPackage}
            disabled={exporting || preCheckRunning}
            style={{ background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)' }}
          >
            {exporting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Package className="h-5 w-5" />
                导出完整发布包
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
          {exportedFiles.length > 0 && !exportProgress && (
            <div className="mt-2 rounded-md bg-dark-800 px-3 py-2">
              <div className="mb-1 text-xs font-medium text-dark-400">已生成文件：</div>
              <ul className="space-y-0.5 text-xs text-dark-300 break-all">
                {exportedFiles.map((f, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-400" />
                    <span>{f.split('\\').pop()}</span>
                  </li>
                ))}
              </ul>
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

      {showPreCheck && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-[520px] max-w-[90vw] overflow-hidden rounded-xl border border-dark-700 bg-dark-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-dark-700 px-5 py-4">
              <h3 className="text-lg font-bold">导出前预检</h3>
              <button
                className="btn btn-ghost p-1 text-dark-400 hover:text-dark-100"
                onClick={() => {
                  setShowPreCheck(false);
                  setPendingExportMode(null);
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              {preCheckRunning ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary-400" />
                  <p className="text-sm text-dark-300">正在检查...</p>
                  <p className="mt-1 text-xs text-dark-500">
                    验证审听项、文件完整性、模板可用性
                  </p>
                </div>
              ) : preCheckResult ? (
                <>
                  {(() => {
                    const hasErrors = preCheckResult.issues.some((i) => i.type === 'error');
                    const hasWarnings = preCheckResult.issues.some((i) => i.type === 'warning');
                    let boxClass = 'bg-green-500/10';
                    let icon = <CheckCircle className="h-8 w-8 text-green-400 flex-shrink-0" />;
                    let titleClass = 'text-green-300';
                    let titleText = '预检通过，可以开始导出';
                    if (hasErrors) {
                      boxClass = 'bg-red-500/10';
                      icon = <AlertCircle className="h-8 w-8 text-red-400 flex-shrink-0" />;
                      titleClass = 'text-red-300';
                      titleText = '发现错误，请修复后再导出';
                    } else if (hasWarnings) {
                      boxClass = 'bg-amber-500/10';
                      icon = <AlertTriangle className="h-8 w-8 text-amber-400 flex-shrink-0" />;
                      titleClass = 'text-amber-300';
                      titleText = '发现提醒项，建议处理后导出';
                    }
                    return (
                      <div className={`mb-4 flex items-center gap-3 rounded-lg p-3 ${boxClass}`}>
                        {icon}
                        <div>
                          <div className={`font-semibold ${titleClass}`}>
                            {titleText}
                          </div>
                          <div className="text-xs text-dark-400">
                            {preCheckResult.issues.length} 项问题 ·
                            {preCheckResult.issues.filter((i) => i.type === 'error').length} 项错误 ·
                            {preCheckResult.issues.filter((i) => i.type === 'warning').length} 项警告
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {preCheckResult.issues.length > 0 && (
                    <div className="mb-4 max-h-[220px] space-y-2 overflow-y-auto">
                      {preCheckResult.issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={`flex gap-2 rounded-lg border p-3 ${
                            issue.type === 'error'
                              ? 'border-red-500/30 bg-red-500/5'
                              : 'border-amber-500/30 bg-amber-500/5'
                          }`}
                        >
                          {getIssueIcon(issue)}
                          <div className="min-w-0 flex-1">
                            <div className={`text-sm font-medium ${
                              issue.type === 'error' ? 'text-red-300' : 'text-amber-300'
                            }`}>
                              {issue.message}
                            </div>
                            {issue.detail && (
                              <div className="mt-0.5 text-xs text-dark-400 break-all">
                                {issue.detail}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-dark-700 bg-dark-850 px-5 py-4" style={{ background: '#0c1320' }}>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowPreCheck(false);
                  setPendingExportMode(null);
                }}
              >
                取消
              </button>
              {preCheckResult && (() => {
                const hasErrors = preCheckResult.issues.some((i) => i.type === 'error');
                const hasWarnings = preCheckResult.issues.some((i) => i.type === 'warning');
                let btnLabel = pendingExportMode === 'package' ? '开始导出发布包' : '开始导出音频';
                let btnTitle = '';
                if (hasWarnings && !hasErrors) {
                  btnLabel = '继续导出（忽略警告）';
                  btnTitle = '存在未处理项，仍可继续导出';
                }
                if (hasErrors) {
                  btnLabel = '存在错误，无法导出';
                  btnTitle = '请修复错误后再导出';
                }
                return (
                  <button
                    className="btn btn-primary"
                    onClick={handleForceExport}
                    disabled={hasErrors || preCheckRunning}
                    title={btnTitle}
                  >
                    {btnLabel}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
