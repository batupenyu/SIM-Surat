import type { Timestamp } from 'firebase/firestore';

export type LetterDirection = 'masuk' | 'keluar';

export type LetterPriority = 'Biasa' | 'Penting' | 'Segera' | 'Rahasia';

export type LetterClassification =
  | 'Umum'
  | 'Undangan'
  | 'Keputusan'
  | 'Keuangan'
  | 'Kepegawaian'
  | 'Nota Dinas';

export type LetterStatus =
  | 'Terdaftar'
  | 'Diproses'
  | 'Didisposisikan'
  | 'Terkirim'
  | 'Diterima'
  | 'Selesai'
  | 'Diarsipkan';

export type TrackingActionType =
  | 'Registrasi'
  | 'Verifikasi'
  | 'Disposisi'
  | 'Pengiriman'
  | 'Penerimaan'
  | 'Tindak Lanjut'
  | 'Selesai'
  | 'Arsip';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  unit: string;
  role: 'staff';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LetterRecord {
  id: string;
  ownerId: string;
  collaboratorUids: string[];
  trackingCode: string;
  direction: LetterDirection;
  letterNumber: string;
  agendaNumber: string;
  subject: string;
  sender: string;
  recipient: string;
  originUnit: string;
  currentUnit: string;
  letterDate: string;
  receivedOrSentDate: string;
  priority: LetterPriority;
  classification: LetterClassification;
  status: LetterStatus;
  summary: string;
  attachmentUrl: string;
  uploadedFileName?: string;
  uploadedFileUrl?: string;
  uploadedFileMime?: string;
  assignedToName: string;
  createdByName: string;
  eventCount: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface TrackingEventRecord {
  id: string;
  letterId: string;
  ownerId: string;
  collaboratorUids: string[];
  actorUid: string;
  actorName: string;
  actionType: TrackingActionType;
  fromUnit: string;
  toUnit: string;
  statusAfter: LetterStatus;
  note: string;
  createdAt: Timestamp | null;
}

export const ORGANIZATIONAL_UNITS = [
  'Sekretariat Umum',
  'Direksi / Pimpinan',
  'Bagian Keuangan',
  'Bagian SDM & Kepegawaian',
  'Hukum & Kepatuhan',
  'Operasional & Layanan',
  'Teknologi Informasi',
  'Pengadaan & Aset',
  'Eksternal / Instansi Luar',
] as const;

export const LETTER_STATUSES: LetterStatus[] = [
  'Terdaftar',
  'Diproses',
  'Didisposisikan',
  'Terkirim',
  'Diterima',
  'Selesai',
  'Diarsipkan',
];

export const LETTER_PRIORITIES: LetterPriority[] = [
  'Biasa',
  'Penting',
  'Segera',
  'Rahasia',
];

export const LETTER_CLASSIFICATIONS: LetterClassification[] = [
  'Umum',
  'Undangan',
  'Keputusan',
  'Keuangan',
  'Kepegawaian',
  'Nota Dinas',
];

export const TRACKING_ACTIONS: TrackingActionType[] = [
  'Registrasi',
  'Verifikasi',
  'Disposisi',
  'Pengiriman',
  'Penerimaan',
  'Tindak Lanjut',
  'Selesai',
  'Arsip',
];
