import type {
  LetterClassification,
  LetterDirection,
  LetterPriority,
  LetterStatus,
  TrackingActionType,
} from '../types/correspondence';

export const SCHEMA_LIMITS = {
  UID_MAX: 128,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  TRACKING_CODE_MIN: 4,
  TRACKING_CODE_MAX: 32,
  TRACKING_CODE_PATTERN: /^[A-Z0-9-]+$/,
  LETTER_NUMBER_MAX: 100,
  AGENDA_NUMBER_MAX: 64,
  SUBJECT_MAX: 240,
  PARTY_MAX: 160,
  UNIT_MAX: 100,
  DATE_PATTERN: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  SUMMARY_MAX: 2000,
  ATTACHMENT_URL_MAX: 500,
  FILE_NAME_MAX: 255,
  FILE_MIME_MAX: 120,
  NAME_MAX: 120,
  NOTE_MAX: 1000,
  EMAIL_MAX: 200,
  COLLABORATORS_MAX: 20,
  EVENT_COUNT_MAX: 500,
} as const;

export function sanitizeText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function generateSafeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36);
  return `${prefix}_${stamp}_${random}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function generateTrackingCode(direction: LetterDirection): string {
  const year = new Date().getFullYear();
  const dirCode = direction === 'masuk' ? 'SM' : 'SK';
  const rand = Math.floor(1000 + Math.random() * 9000);
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `TRK-${dirCode}-${year}-${rand}${suffix}`;
}

export function generateAgendaNumber(
  direction: LetterDirection,
  existingCount: number
): string {
  const prefix = direction === 'masuk' ? 'AGD-M' : 'AGD-K';
  const year = new Date().getFullYear();
  const seq = String(existingCount + 1).padStart(4, '0');
  return `${prefix}/${year}/${seq}`;
}

export interface LetterDraftInput {
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
  uploadedFileName: string;
  uploadedFileUrl: string;
  uploadedFileMime: string;
  assignedToName: string;
}

export function validateLetterDraft(input: LetterDraftInput): {
  valid: boolean;
  error?: string;
  sanitized?: LetterDraftInput;
} {
  const letterNumber = sanitizeText(input.letterNumber, SCHEMA_LIMITS.LETTER_NUMBER_MAX);
  const agendaNumber = sanitizeText(input.agendaNumber, SCHEMA_LIMITS.AGENDA_NUMBER_MAX);
  const subject = sanitizeText(input.subject, SCHEMA_LIMITS.SUBJECT_MAX);
  const sender = sanitizeText(input.sender, SCHEMA_LIMITS.PARTY_MAX);
  const recipient = sanitizeText(input.recipient, SCHEMA_LIMITS.PARTY_MAX);
  const originUnit = sanitizeText(input.originUnit, SCHEMA_LIMITS.UNIT_MAX);
  const currentUnit = sanitizeText(input.currentUnit, SCHEMA_LIMITS.UNIT_MAX);
  const summary = sanitizeText(input.summary, SCHEMA_LIMITS.SUMMARY_MAX);
  const attachmentUrl = sanitizeText(input.attachmentUrl, SCHEMA_LIMITS.ATTACHMENT_URL_MAX);
  const uploadedFileName = sanitizeText(input.uploadedFileName, SCHEMA_LIMITS.FILE_NAME_MAX);
  const uploadedFileUrl = sanitizeText(input.uploadedFileUrl, SCHEMA_LIMITS.ATTACHMENT_URL_MAX);
  const uploadedFileMime = sanitizeText(input.uploadedFileMime, SCHEMA_LIMITS.FILE_MIME_MAX);
  const assignedToName = sanitizeText(input.assignedToName, SCHEMA_LIMITS.NAME_MAX);

  if (!letterNumber) {
    return { valid: false, error: 'Nomor surat wajib diisi.' };
  }
  if (!subject) {
    return { valid: false, error: 'Perihal surat wajib diisi.' };
  }
  if (!sender) {
    return { valid: false, error: 'Pengirim surat wajib diisi.' };
  }
  if (!recipient) {
    return { valid: false, error: 'Penerima surat wajib diisi.' };
  }
  if (!originUnit || !currentUnit) {
    return { valid: false, error: 'Unit asal dan unit tujuan wajib dipilih.' };
  }
  if (!SCHEMA_LIMITS.DATE_PATTERN.test(input.letterDate)) {
    return { valid: false, error: 'Format tanggal surat tidak valid (YYYY-MM-DD).' };
  }
  if (!SCHEMA_LIMITS.DATE_PATTERN.test(input.receivedOrSentDate)) {
    return { valid: false, error: 'Format tanggal terima/kirim tidak valid (YYYY-MM-DD).' };
  }
  if (attachmentUrl && !/^https?:\/\//i.test(attachmentUrl)) {
    return { valid: false, error: 'Tautan lampiran harus diawali http:// atau https://.' };
  }

  return {
    valid: true,
    sanitized: {
      ...input,
      letterNumber,
      agendaNumber,
      subject,
      sender,
      recipient,
      originUnit,
      currentUnit,
      summary,
      attachmentUrl,
      uploadedFileName,
      uploadedFileUrl,
      uploadedFileMime,
      assignedToName,
    },
  };
}

export interface TrackingUpdateInput {
  actionType: TrackingActionType;
  toUnit: string;
  statusAfter: LetterStatus;
  assignedToName: string;
  note: string;
}

export function validateTrackingUpdate(input: TrackingUpdateInput): {
  valid: boolean;
  error?: string;
  sanitized?: TrackingUpdateInput;
} {
  const toUnit = sanitizeText(input.toUnit, SCHEMA_LIMITS.UNIT_MAX);
  const assignedToName = sanitizeText(input.assignedToName, SCHEMA_LIMITS.NAME_MAX);
  const note = sanitizeText(input.note, SCHEMA_LIMITS.NOTE_MAX);

  if (!toUnit) {
    return { valid: false, error: 'Unit tujuan / posisi saat ini wajib diisi.' };
  }

  return {
    valid: true,
    sanitized: {
      ...input,
      toUnit,
      assignedToName,
      note,
    },
  };
}

export function formatIndonesianDate(isoDate: string): string {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parts[2];
  return `${day} ${months[monthIdx] ?? parts[1]} ${year}`;
}

export function formatTimestamp(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return 'Baru saja';
  const d = ts.toDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
