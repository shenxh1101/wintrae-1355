import type { EpisodeProgress, ExportMode, ExportFileRecord, ExportRecord, VerificationDigest, FileVerification } from '@shared/types';
import { formatTimestamp, EPISODE_STATUS_LABELS, AUDIO_SOURCE_LABELS, formatFileSize, formatDuration } from '@shared/utils';
import { renderEpisodeAudio } from './audioProcessor';
import { encodeWav, encodeMp3 } from './audioEncoder';
import { decodeAudioFile } from './audioProcessor';

export interface PreCheckIssue {
  type: 'error' | 'warning';
  category: 'review' | 'missing_file' | 'template' | 'empty';
  message: string;
  detail?: string;
}

export interface PreCheckResult {
  passed: boolean;
  issues: PreCheckIssue[];
}

export async function runPreCheck(episode: EpisodeProgress): Promise<PreCheckResult> {
  const issues: PreCheckIssue[] = [];

  if (episode.segments.length === 0 && !episode.intro && !episode.outro) {
    issues.push({
      type: 'error',
      category: 'empty',
      message: '没有可导出的音频内容',
      detail: '请在剪辑台添加至少一个片段或片头片尾'
    });
    return { passed: false, issues };
  }

  const pendingReviews = episode.reviewItems.filter((r) => r.status !== 'resolved');
  if (pendingReviews.length > 0) {
    issues.push({
      type: 'warning',
      category: 'review',
      message: `${pendingReviews.length} 项审听问题未解决`,
      detail: pendingReviews.map((r) => `[${formatTimestamp(r.time)}] ${r.description}`).join('; ')
    });
  }

  const missingSegments: string[] = [];
  const checkedFiles = new Map<string, boolean>();

  for (const seg of episode.segments) {
    const mat = episode.materials.find((m) => m.id === seg.materialId);
    if (!mat) {
      missingSegments.push(`片段"${seg.name}"关联的素材已被删除`);
      continue;
    }
    if (!checkedFiles.has(mat.filePath)) {
      let exists = true;
      if (window.electronAPI) {
        try {
          exists = await window.electronAPI.fileExists(mat.filePath);
        } catch {
          exists = false;
        }
      }
      checkedFiles.set(mat.filePath, exists);
    }
    if (!checkedFiles.get(mat.filePath)) {
      missingSegments.push(`片段"${seg.name}"的源文件不存在: ${mat.filePath}`);
    }
  }

  if (episode.intro && !checkedFiles.has(episode.intro.filePath)) {
    let exists = true;
    if (window.electronAPI) {
      try {
        exists = await window.electronAPI.fileExists(episode.intro.filePath);
      } catch {
        exists = false;
      }
    }
    checkedFiles.set(episode.intro.filePath, exists);
    if (!exists) {
      issues.push({
        type: 'error',
        category: 'template',
        message: '片头模板源文件丢失',
        detail: episode.intro.filePath
      });
    }
  }

  if (episode.outro && !checkedFiles.has(episode.outro.filePath)) {
    let exists = true;
    if (window.electronAPI) {
      try {
        exists = await window.electronAPI.fileExists(episode.outro.filePath);
      } catch {
        exists = false;
      }
    }
    checkedFiles.set(episode.outro.filePath, exists);
    if (!exists) {
      issues.push({
        type: 'error',
        category: 'template',
        message: '片尾模板源文件丢失',
        detail: episode.outro.filePath
      });
    }
  }

  if (missingSegments.length > 0) {
    issues.push({
      type: 'error',
      category: 'missing_file',
      message: `${missingSegments.length} 个片段的源文件缺失`,
      detail: missingSegments.join('; ')
    });
  }

  const hasErrors = issues.some((i) => i.type === 'error');
  return { passed: !hasErrors, issues };
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'untitled';
}

export function buildBaseName(episode: EpisodeProgress): string {
  const number = episode.episodeNumber?.trim();
  const title = sanitizeFileName(episode.title || 'episode');
  return number ? `${number} - ${title}` : title;
}

export interface ReleasePackageOptions {
  directory: string;
  episode: EpisodeProgress;
  onProgress?: (message: string) => void;
}

export interface ExportPackageResult {
  filePaths: string[];
  fileRecords: ExportFileRecord[];
}

export async function exportReleasePackage(options: ReleasePackageOptions): Promise<ExportPackageResult> {
  const { directory, episode, onProgress } = options;
  const baseName = buildBaseName(episode);
  const exportedFiles: string[] = [];
  const fileRecords: ExportFileRecord[] = [];
  const ext = episode.exportFormat;

  const audioFileName = `${baseName}.${ext}`;
  const audioFilePath = `${directory}\\${audioFileName}`;

  onProgress?.('正在渲染音频...');
  const rendered = await renderEpisodeAudio(episode, episode.targetVolumeDb);

  onProgress?.(`正在编码为 ${ext.toUpperCase()}...`);
  let fileData: ArrayBuffer | Int8Array;
  if (ext === 'wav') {
    fileData = encodeWav(rendered);
  } else {
    fileData = await encodeMp3(rendered, episode.exportBitrate);
  }

  onProgress?.('正在写入音频文件...');
  if (window.electronAPI) {
    const arr = fileData instanceof Int8Array
      ? Array.from(fileData)
      : Array.from(new Uint8Array(fileData));
    await window.electronAPI.writeBinaryFile(audioFilePath, arr);
    exportedFiles.push(audioFilePath);
    fileRecords.push({ fileName: audioFileName, fileType: 'audio', sizeBytes: arr.length });
  }

  const descFileName = `${baseName} - 节目简介.txt`;
  const descFilePath = `${directory}\\${descFileName}`;
  const descContent = buildDescriptionText(episode);
  if (window.electronAPI) {
    await window.electronAPI.writeFile(descFilePath, descContent);
    exportedFiles.push(descFilePath);
    fileRecords.push({ fileName: descFileName, fileType: 'description', sizeBytes: descContent.length });
  }

  const timelineFileName = `${baseName} - 时间轴文案.txt`;
  const timelineFilePath = `${directory}\\${timelineFileName}`;
  const timelineContent = buildTimelineText(episode);
  if (window.electronAPI) {
    await window.electronAPI.writeFile(timelineFilePath, timelineContent);
    exportedFiles.push(timelineFilePath);
    fileRecords.push({ fileName: timelineFileName, fileType: 'timeline', sizeBytes: timelineContent.length });
  }

  const coverFileName = `${baseName} - 封面检查清单.txt`;
  const coverFilePath = `${directory}\\${coverFileName}`;
  const coverContent = buildCoverCheckText(episode);
  if (window.electronAPI) {
    await window.electronAPI.writeFile(coverFilePath, coverContent);
    exportedFiles.push(coverFilePath);
    fileRecords.push({ fileName: coverFileName, fileType: 'cover', sizeBytes: coverContent.length });
  }

  const releaseNotesFileName = `${baseName} - 发布说明.txt`;
  const releaseNotesFilePath = `${directory}\\${releaseNotesFileName}`;
  const releaseNotesContent = buildReleaseNotesText(episode);
  if (window.electronAPI) {
    await window.electronAPI.writeFile(releaseNotesFilePath, releaseNotesContent);
    exportedFiles.push(releaseNotesFilePath);
    fileRecords.push({ fileName: releaseNotesFileName, fileType: 'releaseNotes', sizeBytes: releaseNotesContent.length });
  }

  return { filePaths: exportedFiles, fileRecords };
}

function buildDescriptionText(episode: EpisodeProgress): string {
  const lines: string[] = [];
  lines.push('='.repeat(60));
  lines.push('节目简介');
  lines.push('='.repeat(60));
  lines.push('');
  if (episode.episodeNumber) {
    lines.push(`期数：${episode.episodeNumber}`);
  }
  lines.push(`标题：${episode.title || '未命名节目'}`);
  lines.push(`时长：${formatTimestamp(calculateTotalDuration(episode))}`);
  lines.push(`格式：${episode.exportFormat.toUpperCase()} · ${episode.exportBitrate} kbps`);
  lines.push(`目标响度：${episode.targetVolumeDb} LUFS`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('');
  lines.push(episode.description || '（暂无节目简介）');
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('');
  lines.push('嘉宾：');
  const allGuests = new Set<string>();
  for (const mat of episode.materials) {
    for (const g of mat.guests) allGuests.add(g);
  }
  if (allGuests.size > 0) {
    lines.push(Array.from(allGuests).join('、'));
  } else {
    lines.push('（无）');
  }
  lines.push('');
  lines.push('主题标签：');
  const allTopics = new Set<string>();
  for (const mat of episode.materials) {
    for (const t of mat.topics) allTopics.add(t);
  }
  if (allTopics.size > 0) {
    lines.push(Array.from(allTopics).map((t) => `#${t}`).join(' '));
  } else {
    lines.push('（无）');
  }
  lines.push('');
  return lines.join('\n');
}

function buildTimelineText(episode: EpisodeProgress): string {
  const lines: string[] = [];
  lines.push('='.repeat(60));
  lines.push('时间轴文案');
  lines.push('='.repeat(60));
  lines.push('');

  const allEntries = [...episode.timeline].sort((a, b) => a.time - b.time);
  if (allEntries.length === 0 && episode.chapters.length === 0) {
    lines.push('（暂无时间轴文案，请在导出中心添加或从章节标记生成）');
  } else {
    const all = [...allEntries];
    for (const ch of episode.chapters) {
      if (!all.find((e) => Math.abs(e.time - ch.time) < 0.1 && e.title === ch.title)) {
        all.push({ time: ch.time, title: ch.title, description: ch.description });
      }
    }
    all.sort((a, b) => a.time - b.time);

    for (const entry of all) {
      const ts = formatTimestamp(entry.time);
      if (entry.description) {
        lines.push(`${ts}  ${entry.title}`);
        lines.push(`        ${entry.description}`);
      } else {
        lines.push(`${ts}  ${entry.title}`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

function buildCoverCheckText(episode: EpisodeProgress): string {
  const lines: string[] = [];
  lines.push('='.repeat(60));
  lines.push('封面检查清单');
  lines.push('='.repeat(60));
  lines.push('');

  const checkedCount = episode.coverChecks.filter((c) => c.checked).length;
  lines.push(`完成进度：${checkedCount} / ${episode.coverChecks.length}`);
  lines.push('');

  for (const check of episode.coverChecks) {
    const mark = check.checked ? '[✓]' : '[ ]';
    lines.push(`${mark} ${check.label}`);
  }

  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('');
  lines.push('说明：');
  lines.push('  - 封面尺寸建议 3000×3000 px（各平台通用）');
  lines.push('  - 图片格式建议 JPG 或 PNG');
  lines.push('  - 文件大小建议 < 5MB');
  lines.push('');
  return lines.join('\n');
}

function buildReleaseNotesText(episode: EpisodeProgress): string {
  const lines: string[] = [];
  lines.push('='.repeat(60));
  lines.push('发布说明');
  lines.push('='.repeat(60));
  lines.push('');

  lines.push('【基本信息】');
  lines.push(`  节目标题：${episode.title || '未命名节目'}`);
  lines.push(`  期数：${episode.episodeNumber || '（未设置）'}`);
  lines.push(`  节目状态：${EPISODE_STATUS_LABELS[episode.status]}`);
  lines.push(`  总时长：${formatTimestamp(calculateTotalDuration(episode))}`);
  lines.push('');

  lines.push('【导出配置】');
  lines.push(`  音频格式：${episode.exportFormat.toUpperCase()}`);
  lines.push(`  比特率：${episode.exportBitrate} kbps`);
  lines.push(`  目标响度：${episode.targetVolumeDb} LUFS`);
  lines.push('');

  const resolved = episode.reviewItems.filter((r) => r.status === 'resolved').length;
  const total = episode.reviewItems.length;
  lines.push('【审听状态】');
  lines.push(`  审听项总数：${total}`);
  lines.push(`  已解决：${resolved}`);
  lines.push(`  待处理：${total - resolved}`);
  if (total === 0) {
    lines.push(`  状态：未创建审听项`);
  } else if (resolved === total) {
    lines.push(`  状态：✅ 全部已解决`);
  } else {
    lines.push(`  状态：⚠️ 还有 ${total - resolved} 项未处理`);
  }
  lines.push('');

  const coverChecked = episode.coverChecks.filter((c) => c.checked).length;
  const coverTotal = episode.coverChecks.length;
  lines.push('【封面完成情况】');
  lines.push(`  完成进度：${coverChecked} / ${coverTotal}`);
  if (coverTotal > 0) {
    lines.push(`  完成度：${Math.round((coverChecked / coverTotal) * 100)}%`);
  }
  for (const c of episode.coverChecks) {
    lines.push(`  ${c.checked ? '[✓]' : '[ ]'} ${c.label}`);
  }
  lines.push('');

  lines.push('【素材来源】');
  lines.push(`  素材总数：${episode.materials.length}`);
  for (const mat of episode.materials) {
    const src = AUDIO_SOURCE_LABELS?.[mat.source] || mat.source;
    lines.push(`  · ${mat.name}`);
    lines.push(`      时长：${formatTimestamp(mat.duration)}  |  来源：${src}`);
    if (mat.guests.length > 0) {
      lines.push(`      嘉宾：${mat.guests.join('、')}`);
    }
    if (mat.topics.length > 0) {
      lines.push(`      主题：${mat.topics.map((t) => `#${t}`).join(' ')}`);
    }
  }
  lines.push('');

  lines.push('【片段编排】');
  lines.push(`  片头：${episode.intro ? `${episode.intro.name}（${formatTimestamp(episode.intro.duration)}）` : '未设置'}`);
  lines.push(`  片段数量：${episode.segments.length}`);
  for (let i = 0; i < episode.segments.length; i++) {
    const seg = episode.segments[i];
    const mat = episode.materials.find((m) => m.id === seg.materialId);
    lines.push(`  ${i + 1}. ${seg.name}`);
    lines.push(`      源：${mat?.name || '（素材已删除）'}  |  截取：${formatTimestamp(seg.startTime)} - ${formatTimestamp(seg.endTime)}`);
  }
  lines.push(`  片尾：${episode.outro ? `${episode.outro.name}（${formatTimestamp(episode.outro.duration)}）` : '未设置'}`);
  lines.push('');

  lines.push('【章节数量】');
  lines.push(`  共 ${episode.chapters.length} 个章节标记`);
  lines.push('');

  lines.push('');
  lines.push('-'.repeat(60));
  lines.push(`生成时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push('');
  return lines.join('\n');
}

function calculateTotalDuration(episode: EpisodeProgress): number {
  let dur = 0;
  if (episode.intro) dur += episode.intro.duration;
  for (const seg of episode.segments) {
    dur += seg.endTime - seg.startTime;
  }
  if (episode.outro) dur += episode.outro.duration;
  return dur;
}

export async function verifyExportRecord(record: ExportRecord): Promise<VerificationDigest> {
  const fileVerifications: FileVerification[] = [];
  let totalAudioDuration = 0;
  let allFilesExist = true;
  let allSizesMatch = true;

  for (const f of record.files) {
    const filePath =
      record.mode === 'package'
        ? `${record.targetPath}\\${f.fileName}`
        : record.targetPath;

    const exists = !!(await window.electronAPI?.fileExists(filePath));
    let actualSize: number | undefined;
    let audioDuration: number | undefined;
    let sizeMatch = true;
    let durationMatch = true;

    if (exists) {
      try {
        const stat = await window.electronAPI?.stat(filePath);
        actualSize = stat?.size;
        if (f.sizeBytes != null && actualSize != null) {
          const diff = Math.abs(actualSize - f.sizeBytes);
          sizeMatch = diff / f.sizeBytes < 0.01;
          if (!sizeMatch) allSizesMatch = false;
        }
        if (f.fileType === 'audio' && window.electronAPI) {
          try {
            const buf = await decodeAudioFile(filePath);
            audioDuration = buf.duration;
            totalAudioDuration += audioDuration;
            durationMatch = Math.abs(audioDuration - record.totalDurationSeconds) < 1.0;
          } catch {
            durationMatch = false;
          }
        }
      } catch {
        /* ignore */
      }
    } else {
      allFilesExist = false;
      sizeMatch = false;
      if (f.fileType === 'audio') durationMatch = false;
    }

    fileVerifications.push({
      fileName: f.fileName,
      fileType: f.fileType,
      expectedSizeBytes: f.sizeBytes,
      actualSizeBytes: actualSize,
      exists,
      audioDurationSeconds: audioDuration,
      sizeMatch,
      durationMatch: f.fileType === 'audio' ? durationMatch : undefined
    });
  }

  const audioFile = fileVerifications.find((f) => f.fileType === 'audio');
  const durationMatch = audioFile ? !!audioFile.durationMatch : true;

  const parts: string[] = [];
  parts.push(allFilesExist ? '✅ 所有文件存在' : '❌ 存在文件缺失');
  parts.push(allSizesMatch ? '✅ 文件大小匹配' : '⚠️ 文件大小不一致');
  if (audioFile) {
    parts.push(
      durationMatch
        ? `✅ 音频时长匹配（${formatDuration(totalAudioDuration)}）`
        : `⚠️ 音频时长不符（预期 ${formatDuration(record.totalDurationSeconds)}，实际 ${formatDuration(totalAudioDuration)}）`
    );
  }

  return {
    verifiedAt: new Date().toISOString(),
    allFilesExist,
    allSizesMatch,
    durationMatch,
    totalAudioDurationSeconds: totalAudioDuration || undefined,
    expectedDurationSeconds: record.totalDurationSeconds,
    files: fileVerifications,
    summary: parts.join(' · ')
  };
}
