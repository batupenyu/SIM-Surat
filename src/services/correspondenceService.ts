import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import type {
  LetterClassification,
  LetterDirection,
  LetterPriority,
  LetterRecord,
  LetterStatus,
  TrackingActionType,
  TrackingEventRecord,
} from '../types/correspondence';
import {
  generateAgendaNumber,
  generateSafeId,
  generateTrackingCode,
  sanitizeText,
  SCHEMA_LIMITS,
  type LetterDraftInput,
  type TrackingUpdateInput,
} from '../utils/validation';

function sortLettersDesc(items: LetterRecord[]): LetterRecord[] {
  return [...items].sort((a, b) => {
    const aMs = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
    const bMs = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
    return bMs - aMs;
  });
}

function sortEventsAsc(items: TrackingEventRecord[]): TrackingEventRecord[] {
  return [...items].sort((a, b) => {
    const aMs = a.createdAt?.toMillis?.() ?? 0;
    const bMs = b.createdAt?.toMillis?.() ?? 0;
    return aMs - bMs;
  });
}

export function subscribeToLetters(
  uid: string,
  onData: (letters: LetterRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'letters';
  const q = query(
    collection(db, 'letters'),
    where('collaboratorUids', 'array-contains', uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: LetterRecord[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<LetterRecord, 'id'>),
      }));
      onData(sortLettersDesc(list));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToTrackingEvents(
  letterId: string,
  uid: string,
  onData: (events: TrackingEventRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `letters/${letterId}/trackingEvents`;
  const q = query(
    collection(db, 'letters', letterId, 'trackingEvents'),
    where('collaboratorUids', 'array-contains', uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: TrackingEventRecord[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<TrackingEventRecord, 'id'>),
      }));
      onData(sortEventsAsc(list));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createLetterWithInitialEvent(params: {
  uid: string;
  actorName: string;
  draft: LetterDraftInput;
  existingCount: number;
  initialNote?: string;
}): Promise<{ letterId: string; trackingCode: string }> {
  const { uid, actorName, draft, existingCount, initialNote } = params;
  const letterId = generateSafeId('ltr');
  const eventId = generateSafeId('evt');
  const trackingCode = generateTrackingCode(draft.direction);
  const agendaNumber =
    draft.agendaNumber || generateAgendaNumber(draft.direction, existingCount);

  const safeActorName = sanitizeText(actorName || 'Staf Persuratan', SCHEMA_LIMITS.NAME_MAX);
  const collaborators = [uid];

  const batch = writeBatch(db);
  const letterRef = doc(db, 'letters', letterId);
  const eventRef = doc(db, 'letters', letterId, 'trackingEvents', eventId);

  batch.set(letterRef, {
    ownerId: uid,
    collaboratorUids: collaborators,
    trackingCode,
    direction: draft.direction,
    letterNumber: sanitizeText(draft.letterNumber, SCHEMA_LIMITS.LETTER_NUMBER_MAX),
    agendaNumber: sanitizeText(agendaNumber, SCHEMA_LIMITS.AGENDA_NUMBER_MAX),
    subject: sanitizeText(draft.subject, SCHEMA_LIMITS.SUBJECT_MAX),
    sender: sanitizeText(draft.sender, SCHEMA_LIMITS.PARTY_MAX),
    recipient: sanitizeText(draft.recipient, SCHEMA_LIMITS.PARTY_MAX),
    originUnit: sanitizeText(draft.originUnit, SCHEMA_LIMITS.UNIT_MAX),
    currentUnit: sanitizeText(draft.currentUnit, SCHEMA_LIMITS.UNIT_MAX),
    letterDate: draft.letterDate,
    receivedOrSentDate: draft.receivedOrSentDate,
    priority: draft.priority,
    classification: draft.classification,
    status: draft.status,
    summary: sanitizeText(draft.summary, SCHEMA_LIMITS.SUMMARY_MAX),
    attachmentUrl: sanitizeText(draft.attachmentUrl, SCHEMA_LIMITS.ATTACHMENT_URL_MAX),
    uploadedFileName: sanitizeText(draft.uploadedFileName, SCHEMA_LIMITS.FILE_NAME_MAX),
    uploadedFileUrl: sanitizeText(draft.uploadedFileUrl, SCHEMA_LIMITS.ATTACHMENT_URL_MAX),
    uploadedFileMime: sanitizeText(draft.uploadedFileMime, SCHEMA_LIMITS.FILE_MIME_MAX),
    assignedToName: sanitizeText(draft.assignedToName, SCHEMA_LIMITS.NAME_MAX),
    createdByName: safeActorName,
    eventCount: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const actionType: TrackingActionType =
    draft.direction === 'masuk' ? 'Registrasi' : 'Registrasi';

  const defaultNote =
    draft.direction === 'masuk'
      ? `Surat masuk diregistrasikan dari ${draft.sender} dan diarahkan ke ${draft.currentUnit}.`
      : `Surat keluar diregistrasikan oleh ${draft.originUnit} untuk dikirim ke ${draft.recipient}.`;

  batch.set(eventRef, {
    letterId,
    ownerId: uid,
    collaboratorUids: collaborators,
    actorUid: uid,
    actorName: safeActorName,
    actionType,
    fromUnit: sanitizeText(draft.originUnit, SCHEMA_LIMITS.UNIT_MAX),
    toUnit: sanitizeText(draft.currentUnit, SCHEMA_LIMITS.UNIT_MAX),
    statusAfter: draft.status,
    note: sanitizeText(initialNote || defaultNote, SCHEMA_LIMITS.NOTE_MAX),
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return { letterId, trackingCode };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `letters/${letterId}`);
  }
}

export async function appendTrackingEventAndUpdateLetter(params: {
  letter: LetterRecord;
  uid: string;
  actorName: string;
  update: TrackingUpdateInput;
}): Promise<void> {
  const { letter, uid, actorName, update } = params;
  const eventId = generateSafeId('evt');
  const nextCount = Math.min(letter.eventCount + 1, SCHEMA_LIMITS.EVENT_COUNT_MAX);

  const batch = writeBatch(db);
  const letterRef = doc(db, 'letters', letter.id);
  const eventRef = doc(db, 'letters', letter.id, 'trackingEvents', eventId);

  batch.update(letterRef, {
    currentUnit: sanitizeText(update.toUnit, SCHEMA_LIMITS.UNIT_MAX),
    status: update.statusAfter,
    assignedToName: sanitizeText(update.assignedToName, SCHEMA_LIMITS.NAME_MAX),
    eventCount: nextCount,
    updatedAt: serverTimestamp(),
  });

  batch.set(eventRef, {
    letterId: letter.id,
    ownerId: letter.ownerId,
    collaboratorUids: letter.collaboratorUids,
    actorUid: uid,
    actorName: sanitizeText(actorName || 'Staf Persuratan', SCHEMA_LIMITS.NAME_MAX),
    actionType: update.actionType,
    fromUnit: sanitizeText(letter.currentUnit, SCHEMA_LIMITS.UNIT_MAX),
    toUnit: sanitizeText(update.toUnit, SCHEMA_LIMITS.UNIT_MAX),
    statusAfter: update.statusAfter,
    note: sanitizeText(
      update.note || `Status diperbarui menjadi ${update.statusAfter} di ${update.toUnit}.`,
      SCHEMA_LIMITS.NOTE_MAX
    ),
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `letters/${letter.id}/trackingEvents/${eventId}`
    );
  }
}

export async function updateLetterMetadata(params: {
  letterId: string;
  draft: LetterDraftInput;
}): Promise<void> {
  const { letterId, draft } = params;
  const letterRef = doc(db, 'letters', letterId);

  try {
    const batch = writeBatch(db);
    batch.update(letterRef, {
      letterNumber: sanitizeText(draft.letterNumber, SCHEMA_LIMITS.LETTER_NUMBER_MAX),
      agendaNumber: sanitizeText(draft.agendaNumber, SCHEMA_LIMITS.AGENDA_NUMBER_MAX),
      subject: sanitizeText(draft.subject, SCHEMA_LIMITS.SUBJECT_MAX),
      sender: sanitizeText(draft.sender, SCHEMA_LIMITS.PARTY_MAX),
      recipient: sanitizeText(draft.recipient, SCHEMA_LIMITS.PARTY_MAX),
      originUnit: sanitizeText(draft.originUnit, SCHEMA_LIMITS.UNIT_MAX),
      currentUnit: sanitizeText(draft.currentUnit, SCHEMA_LIMITS.UNIT_MAX),
      letterDate: draft.letterDate,
      receivedOrSentDate: draft.receivedOrSentDate,
      priority: draft.priority,
      classification: draft.classification,
      summary: sanitizeText(draft.summary, SCHEMA_LIMITS.SUMMARY_MAX),
      attachmentUrl: sanitizeText(draft.attachmentUrl, SCHEMA_LIMITS.ATTACHMENT_URL_MAX),
      uploadedFileName: sanitizeText(draft.uploadedFileName, SCHEMA_LIMITS.FILE_NAME_MAX),
      uploadedFileUrl: sanitizeText(draft.uploadedFileUrl, SCHEMA_LIMITS.ATTACHMENT_URL_MAX),
      uploadedFileMime: sanitizeText(draft.uploadedFileMime, SCHEMA_LIMITS.FILE_MIME_MAX),
      assignedToName: sanitizeText(draft.assignedToName, SCHEMA_LIMITS.NAME_MAX),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `letters/${letterId}`);
  }
}

export interface ExtractedLetterPayload {
  extracted?: {
    direction: LetterDirection;
    letterNumber: string;
    subject: string;
    sender: string;
    recipient: string;
    letterDate: string;
    priority: LetterPriority;
    classification: LetterClassification;
    suggestedUnit: string;
    summary: string;
  };
  file?: {
    fileName: string;
    fileUrl: string;
    fileMime: string;
    fileSize: number;
  };
  error?: string;
}

async function parseJsonResponseSafely<T>(response: Response): Promise<T> {
  const rawText = await response.text();
  const trimmed = rawText.trim();
  const contentType = response.headers.get('content-type') || '';

  if (
    trimmed.startsWith('<') ||
    (!contentType.includes('application/json') && !trimmed.startsWith('{') && !trimmed.startsWith('['))
  ) {
    throw new Error(
      `Layanan API tidak merespons dalam format JSON (HTTP ${response.status}). Silakan muat ulang halaman dan coba lagi.`
    );
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      `Respons server tidak valid (HTTP ${response.status}). Silakan coba lagi.`
    );
  }
}

export async function extractLetterFromFile(
  file: File
): Promise<ExtractedLetterPayload> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Silakan masuk akun terlebih dahulu.');
  }

  const idToken = await currentUser.getIdToken();
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/extract-letter', {
    method: 'POST',
    headers: {
      'X-Firebase-Auth': idToken,
    },
    body: formData,
  });

  const payload = await parseJsonResponseSafely<ExtractedLetterPayload>(response);
  if (!response.ok) {
    if (payload.file) {
      return payload;
    }
    throw new Error(payload.error || 'Gagal mengunggah atau membaca file surat.');
  }
  return payload;
}

export async function fetchAuthenticatedFileBlob(
  fileUrl: string
): Promise<{ blobUrl: string; mimeType: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Silakan masuk akun terlebih dahulu.');
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch(fileUrl, {
    headers: {
      'X-Firebase-Auth': idToken,
    },
  });

  if (!response.ok) {
    let msg = `Gagal mengunduh berkas surat (HTTP ${response.status}).`;
    try {
      const errBody = await parseJsonResponseSafely<{ error?: string }>(response);
      if (errBody.error) msg = errBody.error;
    } catch (parseErr) {
      if (parseErr instanceof Error) {
        msg = parseErr.message;
      }
    }
    throw new Error(msg);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  return { blobUrl, mimeType: blob.type };
}

export async function fetchAuthenticatedFileBytes(
  fileUrl: string
): Promise<{ data: Uint8Array; mimeType: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Silakan masuk akun terlebih dahulu.');
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch(fileUrl, {
    headers: {
      'X-Firebase-Auth': idToken,
    },
  });

  if (!response.ok) {
    let msg = `Gagal membuka berkas surat (HTTP ${response.status}).`;
    try {
      const errBody = await parseJsonResponseSafely<{ error?: string }>(response);
      if (errBody.error) msg = errBody.error;
    } catch (parseErr) {
      if (parseErr instanceof Error) {
        msg = parseErr.message;
      }
    }
    throw new Error(msg);
  }

  const buffer = await response.arrayBuffer();
  return {
    data: new Uint8Array(buffer),
    mimeType: response.headers.get('content-type') || 'application/pdf',
  };
}

export async function deleteLetterAndEvents(
  letterId: string,
  uid: string
): Promise<void> {
  const path = `letters/${letterId}`;
  try {
    const eventsQuery = query(
      collection(db, 'letters', letterId, 'trackingEvents'),
      where('collaboratorUids', 'array-contains', uid)
    );
    const eventsSnap = await getDocs(eventsQuery);

    const batch = writeBatch(db);
    eventsSnap.docs.forEach((evtDoc) => {
      batch.delete(evtDoc.ref);
    });
    batch.delete(doc(db, 'letters', letterId));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function seedSampleCorrespondence(
  uid: string,
  actorName: string
): Promise<void> {
  const safeActor = sanitizeText(actorName || 'Admin Sekretariat', SCHEMA_LIMITS.NAME_MAX);
  const today = new Date().toISOString().slice(0, 10);
  const collaborators = [uid];

  interface SeedSpec {
    letterId: string;
    trackingCode: string;
    direction: 'masuk' | 'keluar';
    letterNumber: string;
    agendaNumber: string;
    subject: string;
    sender: string;
    recipient: string;
    originUnit: string;
    currentUnit: string;
    priority: 'Biasa' | 'Penting' | 'Segera' | 'Rahasia';
    classification: 'Umum' | 'Undangan' | 'Keputusan' | 'Keuangan' | 'Kepegawaian' | 'Nota Dinas';
    initialStatus: LetterStatus;
    finalStatus: LetterStatus;
    summary: string;
    assignedToName: string;
    initialNote: string;
    followUp?: {
      actionType: TrackingActionType;
      fromUnit: string;
      toUnit: string;
      statusAfter: LetterStatus;
      note: string;
    };
  }

  const specs: SeedSpec[] = [
    {
      letterId: generateSafeId('ltr'),
      trackingCode: 'TRK-SM-2026-1042',
      direction: 'masuk',
      letterNumber: '045/KEMENKEU-DJP/XI/2026',
      agendaNumber: 'AGD-M/2026/0001',
      subject: 'Undangan Rapat Koordinasi Evaluasi Anggaran Triwulan IV',
      sender: 'Direktorat Jenderal Anggaran',
      recipient: 'Kepala Bagian Keuangan',
      originUnit: 'Sekretariat Umum',
      currentUnit: 'Bagian Keuangan',
      priority: 'Segera',
      classification: 'Undangan',
      initialStatus: 'Terdaftar',
      finalStatus: 'Didisposisikan',
      summary:
        'Undangan pembahasan rekonsiliasi realisasi anggaran triwulan IV beserta permintaan dokumen pendukung.',
      assignedToName: 'Raka Pratama',
      initialNote: 'Diterima di loket Sekretariat Umum dan diverifikasi kelengkapan lampiran.',
      followUp: {
        actionType: 'Disposisi',
        fromUnit: 'Sekretariat Umum',
        toUnit: 'Bagian Keuangan',
        statusAfter: 'Didisposisikan',
        note: 'Mohon Bagian Keuangan menyiapkan laporan realisasi sebelum hari Kamis.',
      },
    },
    {
      letterId: generateSafeId('ltr'),
      trackingCode: 'TRK-SM-2026-1043',
      direction: 'masuk',
      letterNumber: '882/BKN-SDM/XI/2026',
      agendaNumber: 'AGD-M/2026/0002',
      subject: 'Permintaan Pembaruan Data Kompetensi Pegawai Tahun 2026',
      sender: 'Badan Kepegawaian Daerah',
      recipient: 'Kepala Bagian SDM & Kepegawaian',
      originUnit: 'Sekretariat Umum',
      currentUnit: 'Bagian SDM & Kepegawaian',
      priority: 'Penting',
      classification: 'Kepegawaian',
      initialStatus: 'Terdaftar',
      finalStatus: 'Diproses',
      summary:
        'Instruksi pemutakhiran data sertifikasi dan kompetensi pegawai melalui portal kepegawaian.',
      assignedToName: 'Nadia Kusuma',
      initialNote: 'Surat masuk dicatat dan diteruskan ke unit SDM.',
      followUp: {
        actionType: 'Tindak Lanjut',
        fromUnit: 'Sekretariat Umum',
        toUnit: 'Bagian SDM & Kepegawaian',
        statusAfter: 'Diproses',
        note: 'Sedang dilakukan rekapitulasi daftar sertifikat pegawai aktif.',
      },
    },
    {
      letterId: generateSafeId('ltr'),
      trackingCode: 'TRK-SK-2026-2011',
      direction: 'keluar',
      letterNumber: '112/SK-DIR/XI/2026',
      agendaNumber: 'AGD-K/2026/0001',
      subject: 'Surat Keputusan Penetapan Tim Audit Internal Sistem Informasi',
      sender: 'Direksi / Pimpinan',
      recipient: 'Seluruh Kepala Unit Kerja',
      originUnit: 'Direksi / Pimpinan',
      currentUnit: 'Hukum & Kepatuhan',
      priority: 'Penting',
      classification: 'Keputusan',
      initialStatus: 'Terdaftar',
      finalStatus: 'Terkirim',
      summary:
        'Penetapan susunan tim audit internal keamanan dan tata kelola sistem informasi periode 2026-2027.',
      assignedToName: 'Dian Maharani',
      initialNote: 'Draf SK ditandatangani Direksi dan didaftarkan ke agenda surat keluar.',
      followUp: {
        actionType: 'Pengiriman',
        fromUnit: 'Direksi / Pimpinan',
        toUnit: 'Hukum & Kepatuhan',
        statusAfter: 'Terkirim',
        note: 'Salinan resmi telah didistribusikan ke seluruh unit terkait.',
      },
    },
    {
      letterId: generateSafeId('ltr'),
      trackingCode: 'TRK-SK-2026-2012',
      direction: 'keluar',
      letterNumber: '118/ND-TI/XI/2026',
      agendaNumber: 'AGD-K/2026/0002',
      subject: 'Nota Dinas Permohonan Pengadaan Lisensi Cloud & Keamanan Jaringan',
      sender: 'Teknologi Informasi',
      recipient: 'Pengadaan & Aset',
      originUnit: 'Teknologi Informasi',
      currentUnit: 'Pengadaan & Aset',
      priority: 'Segera',
      classification: 'Nota Dinas',
      initialStatus: 'Terdaftar',
      finalStatus: 'Diterima',
      summary:
        'Pengajuan pembaruan lisensi firewall dan sertifikat TLS tahunan untuk infrastruktur server produksi.',
      assignedToName: 'Bima Wijaya',
      initialNote: 'Nota dinas diterbitkan oleh divisi TI.',
      followUp: {
        actionType: 'Penerimaan',
        fromUnit: 'Teknologi Informasi',
        toUnit: 'Pengadaan & Aset',
        statusAfter: 'Diterima',
        note: 'Berkas telah diterima loket Pengadaan & Aset untuk evaluasi vendor.',
      },
    },
    {
      letterId: generateSafeId('ltr'),
      trackingCode: 'TRK-SM-2026-1044',
      direction: 'masuk',
      letterNumber: '310/PT-MITRA/XI/2026',
      agendaNumber: 'AGD-M/2026/0003',
      subject: 'Berita Acara Serah Terima Pekerjaan Pemeliharaan Gedung',
      sender: 'PT Mitra Bangun Persada',
      recipient: 'Operasional & Layanan',
      originUnit: 'Sekretariat Umum',
      currentUnit: 'Operasional & Layanan',
      priority: 'Biasa',
      classification: 'Umum',
      initialStatus: 'Terdaftar',
      finalStatus: 'Selesai',
      summary:
        'Penyampaian dokumen BAST tahap II pekerjaan pemeliharaan fasilitas ruang arsip dan pendingin udara.',
      assignedToName: 'Hendra Saputra',
      initialNote: 'Dokumen fisik BAST diterima dengan lengkap.',
      followUp: {
        actionType: 'Selesai',
        fromUnit: 'Sekretariat Umum',
        toUnit: 'Operasional & Layanan',
        statusAfter: 'Selesai',
        note: 'Verifikasi lapangan selesai dan BAST telah disetujui.',
      },
    },
    {
      letterId: generateSafeId('ltr'),
      trackingCode: 'TRK-SK-2026-2013',
      direction: 'keluar',
      letterNumber: '121/UND-UMUM/XI/2026',
      agendaNumber: 'AGD-K/2026/0003',
      subject: 'Undangan Sosialisasi Penerapan Arsip Persuratan Digital',
      sender: 'Sekretariat Umum',
      recipient: 'Eksternal / Instansi Luar',
      originUnit: 'Sekretariat Umum',
      currentUnit: 'Eksternal / Instansi Luar',
      priority: 'Biasa',
      classification: 'Undangan',
      initialStatus: 'Terdaftar',
      finalStatus: 'Terkirim',
      summary:
        'Undangan kegiatan sosialisasi tata naskah dinas elektronik bersama instansi mitra daerah.',
      assignedToName: 'Siti Aminah',
      initialNote: 'Surat undangan dibuat dan diberi nomor keluar resmi.',
      followUp: {
        actionType: 'Pengiriman',
        fromUnit: 'Sekretariat Umum',
        toUnit: 'Eksternal / Instansi Luar',
        statusAfter: 'Terkirim',
        note: 'Dikirimkan via kurir resmi dan salinan elektronik.',
      },
    },
  ];

  // Batch 1: Atomic creation of parent letters (eventCount: 1) + initial Registrasi tracking events
  const batch1 = writeBatch(db);
  for (const s of specs) {
    const letterRef = doc(db, 'letters', s.letterId);
    const evtRef = doc(db, 'letters', s.letterId, 'trackingEvents', generateSafeId('evt'));

    batch1.set(letterRef, {
      ownerId: uid,
      collaboratorUids: collaborators,
      trackingCode: s.trackingCode,
      direction: s.direction,
      letterNumber: s.letterNumber,
      agendaNumber: s.agendaNumber,
      subject: s.subject,
      sender: s.sender,
      recipient: s.recipient,
      originUnit: s.originUnit,
      currentUnit: s.originUnit,
      letterDate: today,
      receivedOrSentDate: today,
      priority: s.priority,
      classification: s.classification,
      status: s.initialStatus,
      summary: s.summary,
      attachmentUrl: '',
      assignedToName: s.assignedToName,
      createdByName: safeActor,
      eventCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch1.set(evtRef, {
      letterId: s.letterId,
      ownerId: uid,
      collaboratorUids: collaborators,
      actorUid: uid,
      actorName: safeActor,
      actionType: 'Registrasi',
      fromUnit: s.originUnit,
      toUnit: s.originUnit,
      statusAfter: s.initialStatus,
      note: s.initialNote,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch1.commit();

    // Batch 2: Append follow-up disposition/delivery events atomically
    const batch2 = writeBatch(db);
    for (const s of specs) {
      if (!s.followUp) continue;
      const letterRef = doc(db, 'letters', s.letterId);
      const evtRef = doc(db, 'letters', s.letterId, 'trackingEvents', generateSafeId('evt'));

      batch2.update(letterRef, {
        currentUnit: s.followUp.toUnit,
        status: s.followUp.statusAfter,
        eventCount: 2,
        updatedAt: serverTimestamp(),
      });

      batch2.set(evtRef, {
        letterId: s.letterId,
        ownerId: uid,
        collaboratorUids: collaborators,
        actorUid: uid,
        actorName: safeActor,
        actionType: s.followUp.actionType,
        fromUnit: s.followUp.fromUnit,
        toUnit: s.followUp.toUnit,
        statusAfter: s.followUp.statusAfter,
        note: s.followUp.note,
        createdAt: serverTimestamp(),
      });
    }
    await batch2.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'letters');
  }
}
