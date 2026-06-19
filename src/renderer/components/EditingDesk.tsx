import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  Merge,
  Trash2,
  Volume2,
  BookMarked,
  Music,
  FastForward,
  Rewind,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Flag,
  Upload,
  Loader2,
  Check,
  List,
  ListOrdered,
  MapPin
} from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import { useStore, useCurrentEpisode } from '../store';
import { formatDuration, formatTimestamp } from '@shared/utils';
import { measureSegmentLufs, calculateGainForTarget } from '../utils/audioProcessor';

export default function EditingDesk() {
  const episode = useCurrentEpisode();
  const segments = episode?.segments || [];
  const chapters = episode?.chapters || [];
  const templates = useStore((s) => s.templates);
  const intro = episode?.intro;
  const outro = episode?.outro;

  const updateSegment = useStore((s) => s.updateSegment);
  const deleteSegment = useStore((s) => s.deleteSegment);
  const splitSegment = useStore((s) => s.splitSegment);
  const mergeSegments = useStore((s) => s.mergeSegments);
  const addChapter = useStore((s) => s.addChapter);
  const updateChapter = useStore((s) => s.updateChapter);
  const deleteChapter = useStore((s) => s.deleteChapter);
  const setIntro = useStore((s) => s.setIntro);
  const setOutro = useStore((s) => s.setOutro);
  const setExportConfig = useStore((s) => s.setExportConfig);
  const addTemplate = useStore((s) => s.addTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);

  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    segments.length > 0 ? segments[0].id : null
  );
  const [selectedSegmentsForMerge, setSelectedSegmentsForMerge] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newChapterTime, setNewChapterTime] = useState('');
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [volumeDb, setVolumeDb] = useState(episode?.targetVolumeDb || -16);
  const [normalizing, setNormalizing] = useState(false);
  const [normalizeResult, setNormalizeResult] = useState('');
  const [activeSidebarTab, setActiveSidebarTab] = useState<'templates' | 'chapters' | 'timeline'>('timeline');
  const [highlightedTimelineId, setHighlightedTimelineId] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<'segment' | 'intro' | 'outro'>('segment');
  const [waveformReloadTrigger, setWaveformReloadTrigger] = useState(0);

  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  const selectedSegment = segments.find((s) => s.id === selectedSegmentId);
  const selectedMaterial = episode?.materials.find((m) => m.id === selectedSegment?.materialId);

  const totalDuration = useMemo(() => {
    let dur = 0;
    if (intro) dur += intro.duration;
    for (const seg of segments) {
      dur += seg.endTime - seg.startTime;
    }
    if (outro) dur += outro.duration;
    return dur;
  }, [segments, intro, outro]);

  type TimelineItem =
    | { type: 'intro'; id: string; time: number; duration: number; title: string }
    | { type: 'outro'; id: string; time: number; duration: number; title: string }
    | { type: 'segment'; id: string; time: number; duration: number; title: string; segmentId: string; materialId: string; segStartTime: number }
    | { type: 'chapter'; id: string; time: number; title: string; chapterId: string };

  const timelinePreview = useMemo((): TimelineItem[] => {
    const items: TimelineItem[] = [];
    let cursor = 0;

    if (intro) {
      items.push({
        type: 'intro',
        id: 'intro',
        time: 0,
        duration: intro.duration,
        title: intro.name
      });
      cursor += intro.duration;
    }

    for (const seg of segments) {
      const segDuration = seg.endTime - seg.startTime;
      items.push({
        type: 'segment',
        id: `seg-${seg.id}`,
        time: cursor,
        duration: segDuration,
        title: seg.name,
        segmentId: seg.id,
        materialId: seg.materialId,
        segStartTime: seg.startTime
      });

      const segStart = cursor;
      const segEnd = cursor + segDuration;
      for (const ch of chapters) {
        if (ch.time >= seg.startTime && ch.time <= seg.endTime) {
          const absTime = segStart + (ch.time - seg.startTime);
          items.push({
            type: 'chapter',
            id: `ch-${ch.id}`,
            time: absTime,
            title: ch.title,
            chapterId: ch.id
          });
        }
      }

      cursor += segDuration;
    }

    if (outro) {
      items.push({
        type: 'outro',
        id: 'outro',
        time: cursor,
        duration: outro.duration,
        title: outro.name
      });
    }

    items.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      const order = { intro: 0, segment: 1, chapter: 2, outro: 3 };
      return order[a.type] - order[b.type];
    });

    return items;
  }, [segments, chapters, intro, outro]);

  const playTemplatePreview = (template: { filePath: string; volume: number }) => {
    if (!waveformRef.current) return;
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }
    wavesurferRef.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#475569',
      progressColor: '#8b5cf6',
      cursorColor: '#f8fafc',
      cursorWidth: 2,
      height: 120,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true
    });
    const filePath = 'file:///' + template.filePath.replace(/\\/g, '/');
    wavesurferRef.current.load(filePath);
    wavesurferRef.current.on('ready', () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.setVolume(template.volume);
        wavesurferRef.current.seekTo(0);
        wavesurferRef.current.play();
        setTimeout(() => wavesurferRef.current?.pause(), 1500);
      }
    });
    wavesurferRef.current.on('audioprocess', () => {
      if (wavesurferRef.current) {
        setCurrentTime(wavesurferRef.current.getCurrentTime());
      }
    });
    wavesurferRef.current.on('finish', () => setIsPlaying(false));
    wavesurferRef.current.on('play', () => setIsPlaying(true));
    wavesurferRef.current.on('pause', () => setIsPlaying(false));
  };

  const jumpToTimelineItem = async (item: TimelineItem) => {
    setHighlightedTimelineId(item.id);

    if (item.type === 'intro') {
      setPreviewSource('intro');
      if (intro) playTemplatePreview(intro);
      return;
    }
    if (item.type === 'outro') {
      setPreviewSource('outro');
      if (outro) playTemplatePreview(outro);
      return;
    }

    setPreviewSource('segment');
    setWaveformReloadTrigger((prev) => prev + 1);

    if (item.type === 'segment' || item.type === 'chapter') {
      let targetMaterialId: string | null = null;
      let targetSegStartTime = 0;
      let offsetInSeg = 0;

      if (item.type === 'segment') {
        targetMaterialId = item.materialId;
        targetSegStartTime = item.segStartTime;
        offsetInSeg = 0;
      } else {
        const seg = segments.find((s) => {
          let segStart = 0;
          if (intro) segStart += intro.duration;
          for (const prevSeg of segments) {
            if (prevSeg.id === s.id) break;
            segStart += prevSeg.endTime - prevSeg.startTime;
          }
          const segEnd = segStart + (s.endTime - s.startTime);
          return item.time >= segStart && item.time <= segEnd;
        });
        if (!seg) return;
        targetMaterialId = seg.materialId;
        targetSegStartTime = seg.startTime;
        let segStart = intro ? intro.duration : 0;
        for (const prevSeg of segments) {
          if (prevSeg.id === seg.id) break;
          segStart += prevSeg.endTime - prevSeg.startTime;
        }
        offsetInSeg = item.time - segStart;
      }

      if (selectedSegment?.materialId !== targetMaterialId) {
        const targetSeg = segments.find((s) => s.materialId === targetMaterialId) || segments[0];
        if (targetSeg) {
          setSelectedSegmentId(targetSeg.id);
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      setSelectedSegmentId(
        segments.find((s) => s.materialId === targetMaterialId)?.id || selectedSegmentId
      );

      if (wavesurferRef.current) {
        await new Promise((resolve) => {
          const checkReady = () => {
            if (wavesurferRef.current && wavesurferRef.current.getDuration() > 0) {
              resolve(undefined);
            } else {
              setTimeout(checkReady, 50);
            }
          };
          checkReady();
        });

        const targetSourceTime = targetSegStartTime + offsetInSeg;
        const dur = wavesurferRef.current.getDuration();
        wavesurferRef.current.seekTo(Math.max(0, Math.min(1, targetSourceTime / dur)));
        wavesurferRef.current.play();
        setTimeout(() => wavesurferRef.current?.pause(), 500);
      }
    }
  };

  useEffect(() => {
    if (!waveformRef.current) return;
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }
    if (!selectedMaterial) return;

    wavesurferRef.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#475569',
      progressColor: '#0ea5e9',
      cursorColor: '#f8fafc',
      cursorWidth: 2,
      height: 120,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true
    });

    const filePath = 'file:///' + selectedMaterial.filePath.replace(/\\/g, '/');
    wavesurferRef.current.load(filePath);

    wavesurferRef.current.on('ready', () => {
      if (selectedSegment && wavesurferRef.current) {
        const vol = selectedSegment.normalizedVolume ?? selectedSegment.volume;
        wavesurferRef.current.setVolume(vol);
      }
    });
    wavesurferRef.current.on('audioprocess', () => {
      if (wavesurferRef.current) {
        setCurrentTime(wavesurferRef.current.getCurrentTime());
      }
    });
    wavesurferRef.current.on('finish', () => setIsPlaying(false));
    wavesurferRef.current.on('play', () => setIsPlaying(true));
    wavesurferRef.current.on('pause', () => setIsPlaying(false));

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [selectedSegment?.materialId, selectedMaterial?.filePath, waveformReloadTrigger]);

  useEffect(() => {
    if (wavesurferRef.current && selectedSegment) {
      const vol = selectedSegment.normalizedVolume ?? selectedSegment.volume;
      wavesurferRef.current.setVolume(vol);
    }
  }, [selectedSegment?.volume, selectedSegment?.normalizedVolume, selectedSegment?.id]);

  const togglePlay = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const seekTo = (time: number) => {
    if (wavesurferRef.current) {
      wavesurferRef.current.seekTo(Math.max(0, Math.min(1, time / wavesurferRef.current.getDuration())));
    }
  };

  const skipBack = () => {
    if (wavesurferRef.current) {
      const t = Math.max(0, wavesurferRef.current.getCurrentTime() - 5);
      wavesurferRef.current.seekTo(t / wavesurferRef.current.getDuration());
    }
  };

  const skipForward = () => {
    if (wavesurferRef.current) {
      const dur = wavesurferRef.current.getDuration();
      const t = Math.min(dur, wavesurferRef.current.getCurrentTime() + 5);
      wavesurferRef.current.seekTo(t / dur);
    }
  };

  const handleSplit = () => {
    if (selectedSegmentId && wavesurferRef.current) {
      const t = wavesurferRef.current.getCurrentTime();
      splitSegment(selectedSegmentId, t);
    }
  };

  const toggleMergeSelection = (id: string) => {
    setSelectedSegmentsForMerge((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleMerge = () => {
    if (selectedSegmentsForMerge.length >= 2) {
      mergeSegments(selectedSegmentsForMerge);
      setSelectedSegmentsForMerge([]);
    }
  };

  const handleAddChapter = () => {
    const time = wavesurferRef.current?.getCurrentTime() || 0;
    if (!newChapterTitle.trim()) return;
    addChapter({
      time: newChapterTime ? parseFloat(newChapterTime) || time : time,
      title: newChapterTitle.trim()
    });
    setNewChapterTitle('');
    setNewChapterTime('');
  };

  const handleApplyIntroTemplate = (tplId: string) => {
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl && tpl.type === 'intro') setIntro(tpl);
    setShowTemplates(false);
  };

  const handleApplyOutroTemplate = (tplId: string) => {
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl && tpl.type === 'outro') setOutro(tpl);
    setShowTemplates(false);
  };

  const handleImportTemplate = async (type: 'intro' | 'outro') => {
    try {
      const filePaths: string[] = window.electronAPI
        ? await window.electronAPI.openAudioFiles()
        : [];
      for (const fp of filePaths) {
        const name = fp.split(/[\\/]/).pop() || '模板音频';
        const baseName = name.replace(/\.[^.]+$/, '');
        let duration = 0;
        try {
          const audio = new Audio();
          audio.src = 'file:///' + fp.replace(/\\/g, '/');
          await new Promise<void>((resolve) => {
            audio.addEventListener('loadedmetadata', () => resolve(), { once: true });
            audio.addEventListener('error', () => resolve(), { once: true });
            setTimeout(() => resolve(), 3000);
          });
          duration = audio.duration || 0;
        } catch {
          /* ignore */
        }
        addTemplate({
          name: baseName,
          type,
          filePath: fp,
          duration,
          volume: 1.0
        });
      }
    } catch (e) {
      console.error('Import template failed:', e);
    }
  };

  const handleNormalizeVolume = async () => {
    if (!episode || normalizing) return;
    setNormalizing(true);
    setNormalizeResult('正在分析片段响度...');

    try {
      const targetDb = volumeDb;
      setExportConfig(episode.exportFormat, episode.exportBitrate, targetDb);

      let processed = 0;
      for (const seg of segments) {
        const mat = episode.materials.find((m) => m.id === seg.materialId);
        if (!mat) {
          processed++;
          continue;
        }
        try {
          setNormalizeResult(`正在分析 ${seg.name} (${processed + 1}/${segments.length})...`);
          const measuredLufs = await measureSegmentLufs(mat.filePath, seg.startTime, seg.endTime);
          const gain = calculateGainForTarget(measuredLufs, targetDb);
          const newVolume = seg.volume * gain;
          const clampedVolume = Math.max(0, Math.min(3, newVolume));
          updateSegment(seg.id, {
            measuredLufs,
            gainAdjustment: gain,
            normalizedVolume: clampedVolume
          });
        } catch (e) {
          console.error(`Failed to measure segment ${seg.name}:`, e);
          updateSegment(seg.id, {
            measuredLufs: -70,
            gainAdjustment: 1,
            normalizedVolume: seg.volume
          });
        }
        processed++;
      }

      setNormalizeResult(`音量统一完成！目标 ${targetDb} LUFS，已处理 ${processed} 个片段`);
      setTimeout(() => setNormalizeResult(''), 5000);
    } catch (e) {
      console.error('Normalize failed:', e);
      setNormalizeResult(`处理失败: ${e instanceof Error ? e.message : String(e)}`);
      setTimeout(() => setNormalizeResult(''), 5000);
    } finally {
      setNormalizing(false);
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col">
        <div className="border-b border-dark-800 bg-dark-900 p-4">
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary" onClick={skipBack} title="后退5秒">
              <SkipBack className="h-4 w-4" />
            </button>
            <button className="btn btn-primary px-4" onClick={togglePlay}>
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button className="btn btn-secondary" onClick={skipForward} title="前进5秒">
              <SkipForward className="h-4 w-4" />
            </button>

            <div className="ml-4 text-sm text-dark-300">
              <span className="font-mono">{formatTimestamp(currentTime)}</span>
              <span className="mx-1 text-dark-500">/</span>
              <span className="font-mono text-dark-500">
                {formatTimestamp(wavesurferRef.current?.getDuration() || 0)}
              </span>
            </div>

            <div className="mx-4 h-6 w-px bg-dark-700" />

            <button
              className="btn btn-secondary flex items-center gap-1.5"
              onClick={handleSplit}
              disabled={!selectedSegmentId}
              title="在当前位置拆分片段"
            >
              <Scissors className="h-4 w-4" />
              拆分
            </button>
            <button
              className={`btn flex items-center gap-1.5 ${
                selectedSegmentsForMerge.length >= 2 ? 'btn-primary' : 'btn-secondary'
              }`}
              onClick={handleMerge}
              disabled={selectedSegmentsForMerge.length < 2}
              title={`选择多个片段进行合并 (已选 ${selectedSegmentsForMerge.length})`}
            >
              <Merge className="h-4 w-4" />
              合并 ({selectedSegmentsForMerge.length})
            </button>

            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-dark-400" />
                <input
                  type="number"
                  className="input w-20 text-right"
                  value={volumeDb}
                  onChange={(e) => setVolumeDb(parseFloat(e.target.value) || 0)}
                  step={0.5}
                />
                <span className="text-xs text-dark-400">LUFS</span>
              </div>
              <button
                className="btn btn-secondary flex items-center gap-1.5"
                onClick={handleNormalizeVolume}
                disabled={normalizing}
              >
                {normalizing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    处理中...
                  </>
                ) : (
                  '统一音量'
                )}
              </button>
            </div>
          </div>

          {normalizeResult && (
            <div className={`mt-2 rounded-md px-3 py-2 text-xs ${
              normalizeResult.includes('失败') ? 'bg-red-500/10 text-red-300' :
              normalizeResult.includes('完成') ? 'bg-green-500/10 text-green-300' :
              'bg-primary-500/10 text-primary-300'
            }`}>
              {normalizeResult}
            </div>
          )}

          <div className="mt-2 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-dark-500">
                当前预览：
              </span>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                previewSource === 'segment'
                  ? 'bg-primary-600/20 text-primary-300'
                  : 'bg-purple-600/20 text-purple-300'
              }`}>
                {previewSource === 'segment'
                  ? selectedSegment?.name || '片段'
                  : previewSource === 'intro'
                  ? `片头：${intro?.name || ''}`
                  : `片尾：${outro?.name || ''}`}
              </span>
            </div>
            {previewSource !== 'segment' && (
              <button
                className="btn btn-ghost text-xs text-dark-400 hover:text-dark-200"
                onClick={() => {
                  setPreviewSource('segment');
                  setWaveformReloadTrigger((prev) => prev + 1);
                }}
              >
                返回片段
              </button>
            )}
          </div>

          <div className="waveform-container">
            <div ref={waveformRef} />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder="章节标题"
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddChapter()}
            />
            <input
              type="text"
              className="input w-32 font-mono text-center"
              placeholder={formatTimestamp(currentTime)}
              value={newChapterTime}
              onChange={(e) => setNewChapterTime(e.target.value)}
            />
            <button className="btn btn-primary flex items-center gap-1.5" onClick={handleAddChapter}>
              <Flag className="h-4 w-4" />
              添加章节
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-dark-300">片段时间线 ({segments.length})</h3>
            <div className="text-xs text-dark-500">总时长: {formatDuration(totalDuration)}</div>
          </div>

          {intro && (
            <div className="mb-3 rounded-lg border border-primary-600/40 bg-primary-600/10 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Rewind className="h-4 w-4 text-primary-400" />
                  <span className="font-medium text-primary-200">片头：{intro.name}</span>
                  <span className="text-xs text-primary-400">{formatDuration(intro.duration)}</span>
                </div>
                <button
                  className="btn btn-ghost text-xs text-red-400 hover:text-red-300"
                  onClick={() => setIntro(undefined)}
                >
                  移除
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {segments.map((seg, idx) => {
              const mat = episode?.materials.find((m) => m.id === seg.materialId);
              const isSelected = seg.id === selectedSegmentId;
              const isMergeSelected = selectedSegmentsForMerge.includes(seg.id);
              const effectiveVolume = seg.normalizedVolume ?? seg.volume;
              const hasNormalization = seg.normalizedVolume !== undefined;
              return (
                <div
                  key={seg.id}
                  className={`card p-3 transition-all ${
                    isSelected ? 'border-primary-500 ring-1 ring-primary-500/50' : ''
                  } ${isMergeSelected ? 'bg-primary-600/10' : ''}`}
                  onClick={() => setSelectedSegmentId(seg.id)}
                >
                  <div className="flex items-center gap-2">
                    <button
                      className={`cursor-pointer rounded p-1 ${
                        isMergeSelected
                          ? 'bg-primary-600 text-white'
                          : 'text-dark-500 hover:bg-dark-700 hover:text-dark-300'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMergeSelection(seg.id);
                      }}
                      title="选择合并"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-dark-500">#{idx + 1}</span>
                        <input
                          type="text"
                          className="bg-transparent text-sm font-medium text-dark-100 focus:outline-none"
                          value={seg.name}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateSegment(seg.id, { name: e.target.value })}
                        />
                        {mat && (
                          <span className="text-xs text-dark-500">· {mat.name}</span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-dark-400">
                        <span className="font-mono">
                          {formatTimestamp(seg.startTime)} → {formatTimestamp(seg.endTime)}
                        </span>
                        <span>
                          时长 {formatDuration(seg.endTime - seg.startTime)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Volume2 className="h-3 w-3" />
                          {Math.round(effectiveVolume * 100)}%
                        </span>
                        {hasNormalization && seg.measuredLufs !== undefined && (
                          <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-1.5 py-0.5 text-green-300">
                            <Check className="h-3 w-3" />
                            {seg.measuredLufs} LUFS → {volumeDb} LUFS
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={3}
                        step={0.05}
                        value={effectiveVolume}
                        className="w-24"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          updateSegment(seg.id, {
                            volume: val,
                            normalizedVolume: hasNormalization ? val : undefined
                          });
                        }}
                      />
                      <button
                        className="btn btn-ghost p-1.5 text-red-400 hover:text-red-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSegment(seg.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mt-3 flex items-center gap-2 border-t border-dark-700 pt-3">
                      <span className="text-xs text-dark-500">起始</span>
                      <input
                        type="text"
                        className="input w-28 font-mono text-xs"
                        value={formatTimestamp(seg.startTime)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) updateSegment(seg.id, { startTime: val });
                        }}
                      />
                      <span className="text-xs text-dark-500">结束</span>
                      <input
                        type="text"
                        className="input w-28 font-mono text-xs"
                        value={formatTimestamp(seg.endTime)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) updateSegment(seg.id, { endTime: val });
                        }}
                      />
                      <button
                        className="btn btn-secondary ml-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          seekTo(seg.startTime);
                        }}
                      >
                        跳到起始
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {outro && (
            <div className="mt-3 rounded-lg border border-primary-600/40 bg-primary-600/10 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FastForward className="h-4 w-4 text-primary-400" />
                  <span className="font-medium text-primary-200">片尾：{outro.name}</span>
                  <span className="text-xs text-primary-400">{formatDuration(outro.duration)}</span>
                </div>
                <button
                  className="btn btn-ghost text-xs text-red-400 hover:text-red-300"
                  onClick={() => setOutro(undefined)}
                >
                  移除
                </button>
              </div>
            </div>
          )}

          {segments.length === 0 && !intro && !outro && (
            <div className="flex h-40 flex-col items-center justify-center text-dark-500">
              <Scissors className="mb-2 h-10 w-10 opacity-50" />
              <p className="text-sm">暂无剪辑片段</p>
              <p className="text-xs">请从「素材库」发送素材到剪辑台</p>
            </div>
          )}
        </div>
      </div>

      <aside className="flex w-80 flex-col border-l border-dark-800 bg-dark-900">
        <div className="flex border-b border-dark-800">
          <button
            className={`flex-1 px-2 py-2.5 text-xs font-medium transition-colors ${
              activeSidebarTab === 'templates'
                ? 'border-b-2 border-primary-500 bg-primary-600/10 text-primary-300'
                : 'text-dark-400 hover:text-dark-200'
            }`}
            onClick={() => setActiveSidebarTab('templates')}
          >
            <div className="flex items-center justify-center gap-1">
              <Music className="h-3.5 w-3.5" />
              模板
            </div>
          </button>
          <button
            className={`flex-1 px-2 py-2.5 text-xs font-medium transition-colors ${
              activeSidebarTab === 'chapters'
                ? 'border-b-2 border-primary-500 bg-primary-600/10 text-primary-300'
                : 'text-dark-400 hover:text-dark-200'
            }`}
            onClick={() => setActiveSidebarTab('chapters')}
          >
            <div className="flex items-center justify-center gap-1">
              <BookMarked className="h-3.5 w-3.5" />
              章节
            </div>
          </button>
          <button
            className={`flex-1 px-2 py-2.5 text-xs font-medium transition-colors ${
              activeSidebarTab === 'timeline'
                ? 'border-b-2 border-primary-500 bg-primary-600/10 text-primary-300'
                : 'text-dark-400 hover:text-dark-200'
            }`}
            onClick={() => setActiveSidebarTab('timeline')}
          >
            <div className="flex items-center justify-center gap-1">
              <ListOrdered className="h-3.5 w-3.5" />
              发布顺序
            </div>
          </button>
        </div>

        {activeSidebarTab === 'templates' && (
          <div className="flex-1 overflow-y-auto p-4">
            <button
              className="flex w-full items-center justify-between"
              onClick={() => setShowTemplates((v) => !v)}
            >
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-primary-400" />
                <span className="font-semibold">片头片尾模板</span>
              </div>
              {showTemplates ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {showTemplates && (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-dark-500">片头模板</span>
                    <button
                      className="btn btn-ghost flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
                      onClick={() => handleImportTemplate('intro')}
                    >
                      <Upload className="h-3 w-3" />
                      添加
                    </button>
                  </div>
                  {templates.filter((t) => t.type === 'intro').length === 0 ? (
                    <div className="text-xs text-dark-600">暂无，点击「添加」导入本地音频</div>
                  ) : (
                    <div className="space-y-1">
                      {templates
                        .filter((t) => t.type === 'intro')
                        .map((tpl) => (
                          <div
                            key={tpl.id}
                            className={`flex items-center justify-between rounded px-2 py-1.5 text-sm ${
                              intro?.id === tpl.id
                                ? 'bg-primary-600/20 text-primary-300'
                                : 'text-dark-300 hover:bg-dark-800'
                            }`}
                          >
                            <button
                              className="flex-1 text-left"
                              onClick={() => handleApplyIntroTemplate(tpl.id)}
                            >
                              <span>{tpl.name}</span>
                              <span className="ml-2 text-xs text-dark-500">{formatDuration(tpl.duration)}</span>
                            </button>
                            <button
                              className="btn btn-ghost p-0.5 text-dark-500 hover:text-red-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTemplate(tpl.id);
                                if (intro?.id === tpl.id) setIntro(undefined);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-dark-500">片尾模板</span>
                    <button
                      className="btn btn-ghost flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
                      onClick={() => handleImportTemplate('outro')}
                    >
                      <Upload className="h-3 w-3" />
                      添加
                    </button>
                  </div>
                  {templates.filter((t) => t.type === 'outro').length === 0 ? (
                    <div className="text-xs text-dark-600">暂无，点击「添加」导入本地音频</div>
                  ) : (
                    <div className="space-y-1">
                      {templates
                        .filter((t) => t.type === 'outro')
                        .map((tpl) => (
                          <div
                            key={tpl.id}
                            className={`flex items-center justify-between rounded px-2 py-1.5 text-sm ${
                              outro?.id === tpl.id
                                ? 'bg-primary-600/20 text-primary-300'
                                : 'text-dark-300 hover:bg-dark-800'
                            }`}
                          >
                            <button
                              className="flex-1 text-left"
                              onClick={() => handleApplyOutroTemplate(tpl.id)}
                            >
                              <span>{tpl.name}</span>
                              <span className="ml-2 text-xs text-dark-500">{formatDuration(tpl.duration)}</span>
                            </button>
                            <button
                              className="btn btn-ghost p-0.5 text-dark-500 hover:text-red-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTemplate(tpl.id);
                                if (outro?.id === tpl.id) setOutro(undefined);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSidebarTab === 'chapters' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-dark-300 flex items-center gap-1.5">
                <BookMarked className="h-4 w-4" />
                章节标记 ({chapters.length})
              </h3>
            </div>

            {chapters.length === 0 ? (
              <div className="py-8 text-center text-xs text-dark-500">
                播放音频时点击「添加章节」创建标记
              </div>
            ) : (
              <div className="space-y-2">
                {chapters.map((ch) => (
                  <div key={ch.id} className="rounded border border-dark-700 bg-dark-800 p-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-primary-400">
                        {formatTimestamp(ch.time)}
                      </span>
                      <input
                        type="text"
                        className="flex-1 bg-transparent text-sm text-dark-100 focus:outline-none"
                        value={ch.title}
                        onChange={(e) => updateChapter(ch.id, { title: e.target.value })}
                      />
                      <button
                        className="btn btn-ghost p-1 text-red-400 hover:text-red-300"
                        onClick={() => deleteChapter(ch.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSidebarTab === 'timeline' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="border-b border-dark-800 p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-dark-300 flex items-center gap-1.5">
                  <ListOrdered className="h-4 w-4" />
                  发布顺序预览
                </h3>
                <span className="text-xs text-dark-500">
                  {formatDuration(totalDuration)}
                </span>
              </div>
              <p className="mt-1 text-xs text-dark-500">
                点击项目跳转到对应音频位置
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {timelinePreview.length === 0 ? (
                <div className="py-8 text-center text-xs text-dark-500">
                  暂无内容，请从素材库添加片段
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[17px] top-2 bottom-2 w-px bg-dark-700" />
                  <div className="space-y-0.5">
                    {timelinePreview.map((item) => {
                      const isChapter = item.type === 'chapter';
                      const hasTemplate = item.type === 'intro' ? !!intro : item.type === 'outro' ? !!outro : true;
                      const canJump = hasTemplate;
                      const isHighlighted = highlightedTimelineId === item.id;
                      const TypeIcon =
                        item.type === 'intro' ? Rewind :
                        item.type === 'outro' ? FastForward :
                        item.type === 'chapter' ? MapPin : List;
                      const itemColor =
                        item.type === 'intro' ? 'text-primary-400' :
                        item.type === 'outro' ? 'text-primary-400' :
                        item.type === 'chapter' ? 'text-amber-400' :
                        'text-dark-300';
                      return (
                        <button
                          key={item.id}
                          className={`group relative flex w-full items-start gap-2 rounded p-1.5 text-left transition-all ${
                            canJump ? 'cursor-pointer hover:bg-dark-800' : 'cursor-default opacity-50'
                          } ${isChapter ? 'pl-6' : ''} ${
                            isHighlighted
                              ? 'bg-primary-600/15 border border-primary-500/40 ring-1 ring-primary-500/30'
                              : 'border border-transparent'
                          }`}
                          onClick={() => canJump && jumpToTimelineItem(item)}
                          disabled={!canJump}
                        >
                          <div className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
                            isHighlighted ? 'bg-primary-500/40' : isChapter ? 'bg-dark-800' : 'bg-dark-700'
                          }`}>
                            <TypeIcon className={`h-3 w-3 ${isHighlighted ? 'text-primary-200' : itemColor}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`font-mono text-xs ${
                                isHighlighted ? 'text-primary-300' : 'text-dark-500'
                              }`}>
                                {formatTimestamp(item.time)}
                              </span>
                              {item.type !== 'chapter' && (
                                <span className="text-xs text-dark-600">
                                  ({formatDuration(item.duration)})
                                </span>
                              )}
                            </div>
                            <div className={`text-sm ${
                              isChapter ? 'text-amber-300' : isHighlighted ? 'text-primary-100' : 'text-dark-200'
                            } ${isChapter ? 'text-xs' : ''} truncate font-medium`}>
                              {item.title}
                            </div>
                          </div>
                          {canJump && (
                            <div className={`transition-opacity ${
                              isHighlighted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}>
                              <Play className={`h-3 w-3 ${
                                isHighlighted ? 'text-primary-200' : 'text-primary-400'
                              }`} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-dark-800 p-3">
              <div className="flex flex-wrap gap-2 text-[10px] text-dark-500">
                <span className="inline-flex items-center gap-1">
                  <Rewind className="h-2.5 w-2.5 text-primary-400" /> 片头
                </span>
                <span className="inline-flex items-center gap-1">
                  <List className="h-2.5 w-2.5 text-dark-300" /> 片段
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5 text-amber-400" /> 章节
                </span>
                <span className="inline-flex items-center gap-1">
                  <FastForward className="h-2.5 w-2.5 text-primary-400" /> 片尾
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
