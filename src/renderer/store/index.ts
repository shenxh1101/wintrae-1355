import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  EpisodeProgress,
  AudioMaterial,
  ClipSegment,
  ChapterMarker,
  IntroOutroTemplate,
  ReviewItem,
  TimelineEntry,
  CoverCheckItem,
  AppState,
  ExportRecord
} from '@shared/types';

const DEFAULT_COVER_CHECKS: Omit<CoverCheckItem, 'id'>[] = [
  { label: '封面尺寸 3000x3000px', checked: false },
  { label: '图片格式为 JPG/PNG', checked: false },
  { label: '节目标题清晰可见', checked: false },
  { label: 'Logo 位置正确', checked: false },
  { label: '配色符合品牌规范', checked: false },
  { label: '无版权风险素材', checked: false }
];

function createNewEpisode(): EpisodeProgress {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    episodeNumber: '',
    title: '未命名节目',
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    deliveryStatus: 'pending',
    materials: [],
    segments: [],
    chapters: [],
    reviewItems: [],
    description: '',
    timeline: [],
    coverChecks: DEFAULT_COVER_CHECKS.map((c) => ({ ...c, id: uuidv4() })),
    exportFormat: 'mp3',
    exportBitrate: 192,
    targetVolumeDb: -16
  };
}

interface Store extends AppState {
  setCurrentEpisode: (id: string | null) => void;
  createEpisode: () => string;
  deleteEpisode: (id: string) => void;
  updateEpisode: (id: string, updates: Partial<EpisodeProgress>) => void;

  addMaterial: (material: Omit<AudioMaterial, 'id' | 'importedAt'>) => void;
  updateMaterial: (id: string, updates: Partial<AudioMaterial>) => void;
  deleteMaterial: (id: string) => void;

  addSegment: (segment: Omit<ClipSegment, 'id'>) => void;
  updateSegment: (id: string, updates: Partial<ClipSegment>) => void;
  deleteSegment: (id: string) => void;
  splitSegment: (id: string, splitTime: number) => void;
  mergeSegments: (segmentIds: string[]) => void;

  addChapter: (chapter: Omit<ChapterMarker, 'id'>) => void;
  updateChapter: (id: string, updates: Partial<ChapterMarker>) => void;
  deleteChapter: (id: string) => void;

  setIntro: (template: IntroOutroTemplate | undefined) => void;
  setOutro: (template: IntroOutroTemplate | undefined) => void;

  addReviewItem: (item: Omit<ReviewItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateReviewItem: (id: string, updates: Partial<ReviewItem>) => void;
  deleteReviewItem: (id: string) => void;

  setDescription: (text: string) => void;
  setTimeline: (entries: TimelineEntry[]) => void;
  setCoverCheck: (id: string, checked: boolean) => void;
  setExportConfig: (format: EpisodeProgress['exportFormat'], bitrate: number, targetDb: number) => void;

  addTemplate: (template: Omit<IntroOutroTemplate, 'id'>) => void;
  deleteTemplate: (id: string) => void;

  addExportRecord: (record: Omit<ExportRecord, 'id'>) => void;
  updateExportRecord: (id: string, updates: Partial<ExportRecord>) => void;
  deleteExportRecord: (id: string) => void;

  setEpisodeDeliveryStatus: (episodeId: string, status: 'pending' | 'exported' | 'verified' | 'delivered') => void;

  loadFromStorage: (data: AppState) => void;
}

export const useStore = create<Store>((set, get) => {
  const initialEpisode = createNewEpisode();
  return {
    currentEpisodeId: initialEpisode.id,
    episodes: [initialEpisode],
    templates: [],
    exportRecords: [],

    setCurrentEpisode: (id) => set({ currentEpisodeId: id }),

    createEpisode: () => {
      const ep = createNewEpisode();
      set((state) => ({
        episodes: [...state.episodes, ep],
        currentEpisodeId: ep.id
      }));
      return ep.id;
    },

    deleteEpisode: (id) =>
      set((state) => {
        const episodes = state.episodes.filter((e) => e.id !== id);
        return {
          episodes,
          currentEpisodeId:
            state.currentEpisodeId === id
              ? episodes.length > 0
                ? episodes[0].id
                : null
              : state.currentEpisodeId
        };
      }),

    updateEpisode: (id, updates) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
        )
      })),

    addMaterial: (material) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? {
                ...e,
                materials: [
                  ...e.materials,
                  { ...material, id: uuidv4(), importedAt: new Date().toISOString() }
                ],
                updatedAt: new Date().toISOString()
              }
            : e
        )
      })),

    updateMaterial: (id, updates) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? {
                ...e,
                materials: e.materials.map((m) => (m.id === id ? { ...m, ...updates } : m)),
                updatedAt: new Date().toISOString()
              }
            : e
        )
      })),

    deleteMaterial: (id) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? {
                ...e,
                materials: e.materials.filter((m) => m.id !== id),
                segments: e.segments.filter((s) => s.materialId !== id),
                updatedAt: new Date().toISOString()
              }
            : e
        )
      })),

    addSegment: (segment) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? {
                ...e,
                segments: [...e.segments, { ...segment, id: uuidv4() }],
                updatedAt: new Date().toISOString()
              }
            : e
        )
      })),

    updateSegment: (id, updates) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? {
                ...e,
                segments: e.segments.map((s) => (s.id === id ? { ...s, ...updates } : s)),
                updatedAt: new Date().toISOString()
              }
            : e
        )
      })),

    deleteSegment: (id) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? {
                ...e,
                segments: e.segments.filter((s) => s.id !== id),
                updatedAt: new Date().toISOString()
              }
            : e
        )
      })),

    splitSegment: (id, splitTime) =>
      set((state) => ({
        episodes: state.episodes.map((e) => {
          if (e.id !== state.currentEpisodeId) return e;
          const idx = e.segments.findIndex((s) => s.id === id);
          if (idx === -1) return e;
          const seg = e.segments[idx];
          if (splitTime <= seg.startTime || splitTime >= seg.endTime) return e;
          const seg1: ClipSegment = {
            ...seg,
            id: uuidv4(),
            name: `${seg.name} (上)`,
            endTime: splitTime
          };
          const seg2: ClipSegment = {
            ...seg,
            id: uuidv4(),
            name: `${seg.name} (下)`,
            startTime: splitTime
          };
          const newSegments = [...e.segments];
          newSegments.splice(idx, 1, seg1, seg2);
          return { ...e, segments: newSegments, updatedAt: new Date().toISOString() };
        })
      })),

    mergeSegments: (segmentIds) =>
      set((state) => ({
        episodes: state.episodes.map((e) => {
          if (e.id !== state.currentEpisodeId) return e;
          const toMerge = e.segments.filter((s) => segmentIds.includes(s.id));
          if (toMerge.length < 2) return e;
          const materialIds = [...new Set(toMerge.map((s) => s.materialId))];
          if (materialIds.length > 1) return e;
          const sorted = [...toMerge].sort((a, b) => a.startTime - b.startTime);
          const merged: ClipSegment = {
            id: uuidv4(),
            materialId: sorted[0].materialId,
            name: `${sorted[0].name} (合并)`,
            startTime: sorted[0].startTime,
            endTime: sorted[sorted.length - 1].endTime,
            volume: sorted[0].volume
          };
          const remaining = e.segments.filter((s) => !segmentIds.includes(s.id));
          remaining.push(merged);
          remaining.sort((a, b) => a.startTime - b.startTime);
          return { ...e, segments: remaining, updatedAt: new Date().toISOString() };
        })
      })),

    addChapter: (chapter) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? {
                ...e,
                chapters: [...e.chapters, { ...chapter, id: uuidv4() }].sort(
                  (a, b) => a.time - b.time
                ),
                updatedAt: new Date().toISOString()
              }
            : e
        )
      })),

    updateChapter: (id, updates) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? {
                ...e,
                chapters: e.chapters
                  .map((c) => (c.id === id ? { ...c, ...updates } : c))
                  .sort((a, b) => a.time - b.time),
                updatedAt: new Date().toISOString()
              }
            : e
        )
      })),

    deleteChapter: (id) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? {
                ...e,
                chapters: e.chapters.filter((c) => c.id !== id),
                updatedAt: new Date().toISOString()
              }
            : e
        )
      })),

    setIntro: (template) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? { ...e, intro: template, updatedAt: new Date().toISOString() }
            : e
        )
      })),

    setOutro: (template) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? { ...e, outro: template, updatedAt: new Date().toISOString() }
            : e
        )
      })),

    addReviewItem: (item) => {
      const now = new Date().toISOString();
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? {
                ...e,
                reviewItems: [...e.reviewItems, { ...item, id: uuidv4(), createdAt: now, updatedAt: now }],
                updatedAt: now
              }
            : e
        )
      }));
    },

    updateReviewItem: (id, updates) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? {
                ...e,
                reviewItems: e.reviewItems.map((r) =>
                  r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
                ),
                updatedAt: new Date().toISOString()
              }
            : e
        )
      })),

    deleteReviewItem: (id) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? {
                ...e,
                reviewItems: e.reviewItems.filter((r) => r.id !== id),
                updatedAt: new Date().toISOString()
              }
            : e
        )
      })),

    setDescription: (text) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? { ...e, description: text, updatedAt: new Date().toISOString() }
            : e
        )
      })),

    setTimeline: (entries) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? { ...e, timeline: entries, updatedAt: new Date().toISOString() }
            : e
        )
      })),

    setCoverCheck: (id, checked) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? {
                ...e,
                coverChecks: e.coverChecks.map((c) => (c.id === id ? { ...c, checked } : c)),
                updatedAt: new Date().toISOString()
              }
            : e
        )
      })),

    setExportConfig: (format, bitrate, targetDb) =>
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === state.currentEpisodeId
            ? {
                ...e,
                exportFormat: format,
                exportBitrate: bitrate,
                targetVolumeDb: targetDb,
                updatedAt: new Date().toISOString()
              }
            : e
        )
      })),

    addTemplate: (template) =>
      set((state) => ({
        templates: [...state.templates, { ...template, id: uuidv4() }]
      })),

    deleteTemplate: (id) =>
      set((state) => ({
        templates: state.templates.filter((t) => t.id !== id)
      })),

    addExportRecord: (record) =>
      set((state) => ({
        exportRecords: [{ ...record, id: uuidv4(), status: record.status || 'exported' }, ...state.exportRecords]
      })),

    updateExportRecord: (id, updates) =>
      set((state) => ({
        exportRecords: state.exportRecords.map((r) =>
          r.id === id ? { ...r, ...updates } : r
        )
      })),

    deleteExportRecord: (id) =>
      set((state) => ({
        exportRecords: state.exportRecords.filter((r) => r.id !== id)
      })),

    setEpisodeDeliveryStatus: (episodeId, status) =>
      set((state) => ({
        episodes: state.episodes.map((ep) =>
          ep.id === episodeId
            ? { ...ep, deliveryStatus: status, updatedAt: new Date().toISOString() }
            : ep
        )
      })),

    loadFromStorage: (data) => set(data)
  };
});

export const useCurrentEpisode = () => {
  const { currentEpisodeId, episodes } = useStore();
  return episodes.find((e) => e.id === currentEpisodeId) || null;
};
