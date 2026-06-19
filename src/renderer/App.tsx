import { useState } from 'react';
import {
  Library,
  Scissors,
  ClipboardCheck,
  Download,
  Plus,
  FolderKanban,
  Radio,
  Mic2,
  Settings
} from 'lucide-react';
import { useStore, useCurrentEpisode } from './store';
import MaterialLibrary from './components/MaterialLibrary';
import EditingDesk from './components/EditingDesk';
import ReviewList from './components/ReviewList';
import ExportCenter from './components/ExportCenter';
import { usePersistence } from './hooks/usePersistence';
import { EPISODE_STATUS_LABELS } from '@shared/utils';
import type { EpisodeProgress } from '@shared/types';

type TabId = 'library' | 'editing' | 'review' | 'export';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'library', label: '素材库', icon: Library },
  { id: 'editing', label: '剪辑台', icon: Scissors },
  { id: 'review', label: '审听清单', icon: ClipboardCheck },
  { id: 'export', label: '导出中心', icon: Download }
];

export default function App() {
  usePersistence();
  const [activeTab, setActiveTab] = useState<TabId>('library');
  const episode = useCurrentEpisode();
  const episodes = useStore((s) => s.episodes);
  const currentEpisodeId = useStore((s) => s.currentEpisodeId);
  const setCurrentEpisode = useStore((s) => s.setCurrentEpisode);
  const createEpisode = useStore((s) => s.createEpisode);
  const updateEpisode = useStore((s) => s.updateEpisode);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dark-950 text-dark-100">
      <aside className="flex w-64 flex-col border-r border-dark-800 bg-dark-900">
        <div className="flex items-center gap-2 border-b border-dark-800 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <Radio className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold">播客工作室</h1>
            <p className="text-xs text-dark-400">Podcast Studio</p>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <span className="label">节目列表</span>
          <button
            className="rounded p-1 text-dark-400 hover:bg-dark-800 hover:text-dark-100"
            onClick={() => createEpisode()}
            title="新建节目"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {episodes.map((ep) => (
            <button
              key={ep.id}
              className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors ${
                ep.id === currentEpisodeId
                  ? 'bg-primary-600/20 text-primary-200'
                  : 'text-dark-300 hover:bg-dark-800'
              }`}
              onClick={() => setCurrentEpisode(ep.id)}
            >
              <FolderKanban className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{ep.title || '未命名节目'}</div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-dark-500">
                  {ep.episodeNumber && <span>#{ep.episodeNumber}</span>}
                  {ep.episodeNumber && <span>·</span>}
                  <span>{EPISODE_STATUS_LABELS[ep.status]}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="border-t border-dark-800 p-4">
          {episode && (
            <div className="space-y-3">
              <div>
                <label className="label mb-1 block">节目标题</label>
                <input
                  type="text"
                  className="input w-full"
                  value={episode.title}
                  onChange={(e) => updateEpisode(episode.id, { title: e.target.value })}
                />
              </div>
              <div>
                <label className="label mb-1 block">期数编号</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="如 EP.042"
                  value={episode.episodeNumber}
                  onChange={(e) => updateEpisode(episode.id, { episodeNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="label mb-1 block">制作状态</label>
                <select
                  className="input w-full"
                  value={episode.status}
                  onChange={(e) =>
                    updateEpisode(episode.id, {
                      status: e.target.value as EpisodeProgress['status']
                    })
                  }
                >
                  <option value="draft">草稿</option>
                  <option value="editing">剪辑中</option>
                  <option value="reviewing">审听中</option>
                  <option value="ready">待发布</option>
                  <option value="published">已发布</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <nav className="flex items-center gap-1 border-b border-dark-800 bg-dark-900 px-2 py-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-600 text-white'
                    : 'text-dark-300 hover:bg-dark-800 hover:text-dark-100'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
          <div className="flex-1" />
          <div className="flex items-center gap-2 px-3 text-sm text-dark-400">
            <Mic2 className="h-4 w-4" />
            <span>素材 {episode?.materials.length || 0} · 片段 {episode?.segments.length || 0} · 审听项 {episode?.reviewItems.length || 0}</span>
          </div>
        </nav>

        <main className="flex-1 overflow-hidden">
          {activeTab === 'library' && <MaterialLibrary />}
          {activeTab === 'editing' && <EditingDesk />}
          {activeTab === 'review' && <ReviewList />}
          {activeTab === 'export' && <ExportCenter />}
        </main>
      </div>
    </div>
  );
}
