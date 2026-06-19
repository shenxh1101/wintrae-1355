import { useState, useMemo } from 'react';
import {
  Upload,
  Search,
  Filter,
  Trash2,
  Edit3,
  X,
  Check,
  Tag,
  User,
  Clock,
  FileAudio,
  Layers
} from 'lucide-react';
import { useStore, useCurrentEpisode } from '../store';
import {
  formatDuration,
  formatFileSize,
  AUDIO_SOURCE_LABELS
} from '@shared/utils';
import type { AudioSource } from '@shared/types';

export default function MaterialLibrary() {
  const episode = useCurrentEpisode();
  const addMaterial = useStore((s) => s.addMaterial);
  const updateMaterial = useStore((s) => s.updateMaterial);
  const deleteMaterial = useStore((s) => s.deleteMaterial);
  const addSegment = useStore((s) => s.addSegment);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<AudioSource | 'all'>('all');
  const [filterDuration, setFilterDuration] = useState<'all' | 'short' | 'medium' | 'long'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newGuest, setNewGuest] = useState('');
  const [newTopic, setNewTopic] = useState('');

  const handleImport = async () => {
    try {
      const filePaths: string[] = window.electronAPI
        ? await window.electronAPI.openAudioFiles()
        : [];
      for (const fp of filePaths) {
        const name = fp.split(/[\\/]/).pop() || '未知文件';
        let fileSize = 0;
        try {
          if (window.electronAPI) {
            const stat = await window.electronAPI.stat(fp);
            fileSize = stat.size;
          }
        } catch {
          /* ignore */
        }
        const audio = new Audio();
        audio.src = 'file:///' + fp.replace(/\\/g, '/');
        await new Promise<void>((resolve) => {
          audio.addEventListener('loadedmetadata', () => resolve(), { once: true });
          audio.addEventListener('error', () => resolve(), { once: true });
          setTimeout(() => resolve(), 3000);
        });
        addMaterial({
          name: name.replace(/\.[^.]+$/, ''),
          filePath: fp,
          duration: audio.duration || 0,
          source: 'other',
          guests: [],
          topics: [],
          fileSize,
          sampleRate: 44100,
          channels: 2
        });
      }
    } catch (e) {
      console.error('Import failed:', e);
    }
  };

  const filteredMaterials = useMemo(() => {
    if (!episode) return [];
    return episode.materials.filter((m) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !m.name.toLowerCase().includes(q) &&
          !m.guests.some((g) => g.toLowerCase().includes(q)) &&
          !m.topics.some((t) => t.toLowerCase().includes(q))
        ) {
          return false;
        }
      }
      if (filterSource !== 'all' && m.source !== filterSource) return false;
      if (filterDuration !== 'all') {
        if (filterDuration === 'short' && m.duration >= 300) return false;
        if (filterDuration === 'medium' && (m.duration < 300 || m.duration >= 1800)) return false;
        if (filterDuration === 'long' && m.duration < 1800) return false;
      }
      return true;
    });
  }, [episode, searchQuery, filterSource, filterDuration]);

  const totalDuration = useMemo(
    () => filteredMaterials.reduce((acc, m) => acc + m.duration, 0),
    [filteredMaterials]
  );

  const addGuestToMaterial = (materialId: string) => {
    if (!newGuest.trim()) return;
    const mat = episode?.materials.find((m) => m.id === materialId);
    if (mat && !mat.guests.includes(newGuest.trim())) {
      updateMaterial(materialId, { guests: [...mat.guests, newGuest.trim()] });
    }
    setNewGuest('');
  };

  const removeGuestFromMaterial = (materialId: string, guest: string) => {
    const mat = episode?.materials.find((m) => m.id === materialId);
    if (mat) {
      updateMaterial(materialId, { guests: mat.guests.filter((g) => g !== guest) });
    }
  };

  const addTopicToMaterial = (materialId: string) => {
    if (!newTopic.trim()) return;
    const mat = episode?.materials.find((m) => m.id === materialId);
    if (mat && !mat.topics.includes(newTopic.trim())) {
      updateMaterial(materialId, { topics: [...mat.topics, newTopic.trim()] });
    }
    setNewTopic('');
  };

  const removeTopicFromMaterial = (materialId: string, topic: string) => {
    const mat = episode?.materials.find((m) => m.id === materialId);
    if (mat) {
      updateMaterial(materialId, { topics: mat.topics.filter((t) => t !== topic) });
    }
  };

  const sendToEditing = (materialId: string) => {
    const mat = episode?.materials.find((m) => m.id === materialId);
    if (mat) {
      addSegment({
        materialId: mat.id,
        name: mat.name,
        startTime: 0,
        endTime: mat.duration,
        volume: 1.0
      });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-dark-800 bg-dark-900 p-4">
        <button className="btn btn-primary flex items-center gap-2" onClick={handleImport}>
          <Upload className="h-4 w-4" />
          导入音频
        </button>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
          <input
            type="text"
            className="input w-full pl-9"
            placeholder="搜索素材名称、嘉宾、主题..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-dark-500" />
          <select
            className="input"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as AudioSource | 'all')}
          >
            <option value="all">全部来源</option>
            <option value="host">主持人</option>
            <option value="guest">嘉宾</option>
            <option value="remote">远程连线</option>
            <option value="field">现场录音</option>
            <option value="music">背景音乐</option>
            <option value="other">其他</option>
          </select>
          <select
            className="input"
            value={filterDuration}
            onChange={(e) =>
              setFilterDuration(e.target.value as 'all' | 'short' | 'medium' | 'long')
            }
          >
            <option value="all">全部时长</option>
            <option value="short">5分钟以下</option>
            <option value="medium">5-30分钟</option>
            <option value="long">30分钟以上</option>
          </select>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-dark-800 px-3 py-1.5 text-sm text-dark-300">
          <Layers className="h-4 w-4" />
          <span>
            {filteredMaterials.length} 条 · {formatDuration(totalDuration)}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {filteredMaterials.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-dark-500">
            <FileAudio className="mb-3 h-16 w-16 opacity-50" />
            <p className="text-lg font-medium">暂无音频素材</p>
            <p className="mt-1 text-sm">点击「导入音频」按钮添加录音文件</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filteredMaterials.map((mat) => (
              <div key={mat.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {editingId === mat.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className="input flex-1"
                          defaultValue={mat.name}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateMaterial(mat.id, {
                                name: (e.target as HTMLInputElement).value
                              });
                              setEditingId(null);
                            }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <button
                          className="btn btn-ghost p-1.5"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <h3 className="truncate text-base font-semibold text-dark-100">
                        {mat.name}
                      </h3>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-dark-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(mat.duration)}
                      </span>
                      <span>·</span>
                      <span>{formatFileSize(mat.fileSize)}</span>
                      <span>·</span>
                      <span className="rounded bg-dark-700 px-1.5 py-0.5 font-medium text-dark-200">
                        {AUDIO_SOURCE_LABELS[mat.source]}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="btn btn-ghost p-1.5"
                      onClick={() => setEditingId(mat.id)}
                      title="重命名"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      className="btn btn-ghost p-1.5 text-red-400 hover:text-red-300"
                      onClick={() => deleteMaterial(mat.id)}
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="label mb-1 flex items-center gap-1">
                    音频来源
                  </label>
                  <select
                    className="input w-full"
                    value={mat.source}
                    onChange={(e) =>
                      updateMaterial(mat.id, { source: e.target.value as AudioSource })
                    }
                  >
                    <option value="host">主持人</option>
                    <option value="guest">嘉宾</option>
                    <option value="remote">远程连线</option>
                    <option value="field">现场录音</option>
                    <option value="music">背景音乐</option>
                    <option value="other">其他</option>
                  </select>
                </div>

                <div className="mt-3">
                  <label className="label mb-1 flex items-center gap-1">
                    <User className="h-3 w-3" /> 嘉宾标签
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {mat.guests.map((g) => (
                      <span
                        key={g}
                        className="tag-chip bg-primary-600/20 text-primary-300"
                      >
                        {g}
                        <button
                          className="ml-1 text-primary-400 hover:text-primary-200"
                          onClick={() => removeGuestFromMaterial(mat.id, g)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        className="input !py-0.5 text-xs"
                        style={{ width: 100 }}
                        placeholder="添加嘉宾"
                        value={editingId === mat.id + '-guest' ? newGuest : ''}
                        onFocus={() => {
                          setEditingId(mat.id + '-guest');
                          setNewGuest('');
                        }}
                        onChange={(e) => setNewGuest(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addGuestToMaterial(mat.id);
                        }}
                        onBlur={() => {
                          if (newGuest.trim()) addGuestToMaterial(mat.id);
                          setEditingId(null);
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="label mb-1 flex items-center gap-1">
                    <Tag className="h-3 w-3" /> 主题标签
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {mat.topics.map((t) => (
                      <span
                        key={t}
                        className="tag-chip bg-amber-500/20 text-amber-300"
                      >
                        #{t}
                        <button
                          className="ml-1 text-amber-400 hover:text-amber-200"
                          onClick={() => removeTopicFromMaterial(mat.id, t)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        className="input !py-0.5 text-xs"
                        style={{ width: 100 }}
                        placeholder="添加主题"
                        value={editingId === mat.id + '-topic' ? newTopic : ''}
                        onFocus={() => {
                          setEditingId(mat.id + '-topic');
                          setNewTopic('');
                        }}
                        onChange={(e) => setNewTopic(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addTopicToMaterial(mat.id);
                        }}
                        onBlur={() => {
                          if (newTopic.trim()) addTopicToMaterial(mat.id);
                          setEditingId(null);
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    className="btn btn-secondary flex items-center gap-1.5"
                    onClick={() => sendToEditing(mat.id)}
                  >
                    <Check className="h-4 w-4" />
                    发送到剪辑台
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
