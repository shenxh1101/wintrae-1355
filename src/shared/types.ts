export type AudioSource = 'host' | 'guest' | 'remote' | 'field' | 'music' | 'other';

export interface AudioMaterial {
  id: string;
  name: string;
  filePath: string;
  duration: number;
  source: AudioSource;
  guests: string[];
  topics: string[];
  importedAt: string;
  fileSize: number;
  sampleRate?: number;
  channels?: number;
}

export interface ClipSegment {
  id: string;
  materialId: string;
  name: string;
  startTime: number;
  endTime: number;
  volume: number;
  notes?: string;
  measuredLufs?: number;
  gainAdjustment?: number;
  normalizedVolume?: number;
}

export interface ChapterMarker {
  id: string;
  time: number;
  title: string;
  description?: string;
}

export interface IntroOutroTemplate {
  id: string;
  name: string;
  type: 'intro' | 'outro';
  filePath: string;
  duration: number;
  volume: number;
}

export type ReviewIssueType = 'slip' | 'silence' | 'sensitive' | 'noise' | 'other';
export type ReviewStatus = 'pending' | 'in_progress' | 'resolved';

export interface ReviewItem {
  id: string;
  segmentId?: string;
  time: number;
  type: ReviewIssueType;
  description: string;
  suggestion?: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEntry {
  time: number;
  title: string;
  description?: string;
}

export interface CoverCheckItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface EpisodeProgress {
  id: string;
  episodeNumber: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'editing' | 'reviewing' | 'ready' | 'published';
  materials: AudioMaterial[];
  segments: ClipSegment[];
  chapters: ChapterMarker[];
  intro?: IntroOutroTemplate;
  outro?: IntroOutroTemplate;
  reviewItems: ReviewItem[];
  description: string;
  timeline: TimelineEntry[];
  coverChecks: CoverCheckItem[];
  exportFormat: 'mp3' | 'wav';
  exportBitrate: number;
  targetVolumeDb: number;
}

export interface AppState {
  currentEpisodeId: string | null;
  episodes: EpisodeProgress[];
  templates: IntroOutroTemplate[];
}
