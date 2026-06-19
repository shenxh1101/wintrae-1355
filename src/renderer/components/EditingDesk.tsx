import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  Merge,
  Plus,
  Trash2,
  Volume2,
  BookMarked,
  Music,
  FastForward,
  Rewind,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Flag
} from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import { useStore, useCurrentEpisode } from '../store';
import { formatDuration, formatTimestamp } from '@shared/utils';

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
        wavesurferRef.current.setVolume(selectedSegment.volume);
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
  }, [selectedSegment?.materialId, selectedMaterial?.filePath]);

  useEffect(() => {
    if (wavesurferRef.current && selectedSegment) {
      wavesurferRef.current.setVolume(selectedSegment.volume);
    }
  }, [selectedSegment?.volume, selectedSegment?.id]);

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

  const handleNormalizeVolume = () => {
    const targetDb = volumeDb;
    setExportConfig(episode!.exportFormat, episode!.exportBitrate, targetDb);
    for (const seg of segments) {
      updateSegment(seg.id, { volume: 1.0 });
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
              >
                统一音量
              </button>
            </div>
          </div>

          <div className="waveform-container mt-3">
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
                          {Math.round(seg.volume * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.05}
                        value={seg.volume}
                        className="w-24"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          updateSegment(seg.id, { volume: parseFloat(e.target.value) })
                        }
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

          {segments.length === 0 && (
            <div className="flex h-40 flex-col items-center justify-center text-dark-500">
              <Scissors className="mb-2 h-10 w-10 opacity-50" />
              <p className="text-sm">暂无剪辑片段</p>
              <p className="text-xs">请从「素材库」发送素材到剪辑台</p>
            </div>
          )}
        </div>
      </div>

      <aside className="flex w-80 flex-col border-l border-dark-800 bg-dark-900">
        <div className="relative border-b border-dark-800 p-4">
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
            <div className="mt-3 space-y-2">
              <div className="text-xs text-dark-500">片头</div>
              {templates.filter((t) => t.type === 'intro').length === 0 && (
                <div className="text-xs text-dark-600">暂无片头模板</div>
              )}
              {templates
                .filter((t) => t.type === 'intro')
                .map((tpl) => (
                  <button
                    key={tpl.id}
                    className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-dark-800 ${
                      intro?.id === tpl.id ? 'bg-primary-600/20 text-primary-300' : 'text-dark-300'
                    }`}
                    onClick={() => handleApplyIntroTemplate(tpl.id)}
                  >
                    <span>{tpl.name}</span>
                    <span className="text-xs text-dark-500">{formatDuration(tpl.duration)}</span>
                  </button>
                ))}
              <div className="mt-3 text-xs text-dark-500">片尾</div>
              {templates.filter((t) => t.type === 'outro').length === 0 && (
                <div className="text-xs text-dark-600">暂无片尾模板</div>
              )}
              {templates
                .filter((t) => t.type === 'outro')
                .map((tpl) => (
                  <button
                    key={tpl.id}
                    className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-dark-800 ${
                      outro?.id === tpl.id ? 'bg-primary-600/20 text-primary-300' : 'text-dark-300'
                    }`}
                    onClick={() => handleApplyOutroTemplate(tpl.id)}
                  >
                    <span>{tpl.name}</span>
                    <span className="text-xs text-dark-500">{formatDuration(tpl.duration)}</span>
                  </button>
                ))}
            </div>
          )}
        </div>

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
      </aside>
    </div>
  );
}
