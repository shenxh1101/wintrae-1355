export type AudioSource = 'host' | 'guest' | 'remote' | 'field' | 'music' | 'other';

export type ExportMode = 'audio' | 'package';

export type DeliveryStatus = 'pending' | 'exported' | 'verified' | 'delivered';

export interface FileVerification {
  fileName: string;
  fileType: string;
  expectedSizeBytes?: number;
  actualSizeBytes?: number;
  exists: boolean;
  audioDurationSeconds?: number;
  sizeMatch?: boolean;
  durationMatch?: boolean;
}

export interface VerificationDigest {
  verifiedAt: string;
  allFilesExist: boolean;
  allSizesMatch: boolean;
  durationMatch: boolean;
  totalAudioDurationSeconds?: number;
  expectedDurationSeconds?: number;
  files: FileVerification[];
  summary: string;
}

export interface ExportFileRecord {
  fileName: string;
  fileType: 'audio' | 'description' | 'timeline' | 'cover' | 'releaseNotes';
  sizeBytes?: number;
}

export interface ExportRecord {
  id: string;
  episodeId: string;
  mode: ExportMode;
  status: DeliveryStatus;
  exportedAt: string;
  targetPath: string;
  format: 'mp3' | 'wav';
  bitrate: number;
  targetVolumeDb: number;
  totalDurationSeconds: number;
  reviewItemsTotal: number;
  reviewItemsResolved: number;
  coverChecked: number;
  coverTotal: number;
  files: ExportFileRecord[];
  preCheckWarnings: number;
  verificationDigest?: VerificationDigest;
  deliveredBy?: string;
  deliveryNotes?: string;
}

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
  deliveryStatus: DeliveryStatus;
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
  exportRecords: ExportRecord[];
}
