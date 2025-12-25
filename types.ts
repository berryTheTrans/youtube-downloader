
export enum DownloadStatus {
  IDLE = 'IDLE',
  FETCHING = 'FETCHING',
  READY = 'READY',
  DOWNLOADING = 'DOWNLOADING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface VideoMetadata {
  title: string;
  thumbnail: string;
  author: string;
  duration: string;
  views: string;
  aiSummary?: string;
  formats?: VideoFormat[];
}

export interface VideoFormat {
  quality: string;
  label: string;
  size: string;
  ext: string;
}

export const DEFAULT_FORMATS: VideoFormat[] = [
  { quality: '2160p', label: '4K Ultra HD', size: 'Calculating...', ext: 'MP4' },
  { quality: '1080p', label: 'Full HD', size: 'Calculating...', ext: 'MP4' },
  { quality: '720p', label: 'HD', size: 'Calculating...', ext: 'MP4' },
  { quality: '360p', label: 'Low Quality', size: 'Calculating...', ext: 'MP4' },
  { quality: 'audio', label: 'Audio Only', size: 'Calculating...', ext: 'M4A' },
];
