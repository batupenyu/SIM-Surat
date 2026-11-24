import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Pencil,
  Printer,
  Trash2,
  X,
} from 'lucide-react';
import {
  appendTrackingEventAndUpdateLetter,
  deleteLetterAndEvents,
  fetchAuthenticatedFileBlob,
  fetchAuthenticatedFileBytes,
  subscribeToTrackingEvents,
} from '../services/correspondenceService';
import {
  LETTER_STATUSES,
  ORGANIZATIONAL_UNITS,
  TRACKING_ACTIONS,
  type LetterRecord,
  type LetterStatus,
  type TrackingActionType,
  type TrackingEventRecord,
} from '../types/correspondence';
import {
  formatIndonesianDate,
  formatTimestamp,
  validateTrackingUpdate,
} from '../utils/validation';
import {
  DirectionLabel,
  PriorityLabel,
  StatusLabel,
} from './StatusIndicator';
import { DispositionPrintModal } from './DispositionPrintModal';
import { PdfPreviewModal } from './PdfPreviewModal';

interface LetterDetailDrawerProps {
  letter: LetterRecord;
  currentUid: string;
  currentUserName: string;
  isAdmin: boolean;
  onClose: () => void;
  onEditClick: (letter: LetterRecord) => void;
}

const PROGRESS_STAGES: { label: string; statuses: LetterStatus[] }[] = [
  { label: 'Terdaftar', statuses: ['Terdaftar'] },
  { label: 'Diproses / Disposisi', statuses: ['Diproses', 'Didisposisikan'] },
  { label: 'Terkirim / Diterima', statuses: ['Terkirim', 'Diterima'] },
  { label: 'Selesai', statuses: ['Selesai'] },
  { label: 'Diarsipkan', statuses: ['Diarsipkan'] },
];

function getStageIndex(status: LetterStatus): number {
  const idx = PROGRESS_STAGES.findIndex((s) => s.statuses.includes(status));
  return idx === -1 ? 0 : idx;
}

export function LetterDetailDrawer({
  letter,
  currentUid,
  currentUserName,
  isAdmin,
  onClose,
  onEditClick,
}: LetterDetailDrawerProps) {
  const [events, setEvents] = useState<TrackingEventRecord[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pdfPreviewData, setPdfPreviewData] = useState<Uint8Array | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Tracking Update Form State
  const [actionType, setActionType] = useState<TrackingActionType>('Disposisi');
  const [toUnit, setToUnit] = useState<string>(letter.currentUnit);
  const [statusAfter, setStatusAfter] = useState<LetterStatus>(
    letter.status === 'Terdaftar' ? 'Didisposisikan' : letter.status
  );
  const [assignedToName, setAssignedToName] = useState<string>(
    letter.assignedToName
  );
  const [note, setNote] = useState('');
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    setToUnit(letter.currentUnit);
    setAssignedToName(letter.assignedToName);
    if (letter.status === 'Terdaftar') {
      setStatusAfter('Didisposisikan');
      setActionType('Disposisi');
    } else if (letter.status === 'Didisposisikan') {
      setStatusAfter('Diproses');
      setActionType('Tindak Lanjut');
    } else if (letter.status === 'Diproses') {
      setStatusAfter('Selesai');
      setActionType('Selesai');
    } else {
      setStatusAfter(letter.status);
    }
  }, [letter.id, letter.currentUnit, letter.status, letter.assignedToName]);

  useEffect(() => {
    setLoadingEvents(true);
    setEventsError(null);
    const unsub = subscribeToTrackingEvents(
      letter.id,
      currentUid,
      (list) => {
        setEvents(list);
        setLoadingEvents(false);
      },
      (err) => {
        setEventsError(err.message);
        setLoadingEvents(false);
      }
    );
    return () => unsub();
  }, [letter.id, currentUid]);

  const isLocked = letter.status === 'Diarsipkan' && !isAdmin;
  const isOwner = letter.ownerId === currentUid;
  const stageIndex = getStageIndex(letter.status);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(letter.trackingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in restricted frame
    }
  };

  const handleLogTrackingUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError(null);

    const validation = validateTrackingUpdate({
      actionType,
      toUnit,
      statusAfter,
      assignedToName,
      note,
    });

    if (!validation.valid || !validation.sanitized) {
      setUpdateError(validation.error ?? 'Periksa data tindak lanjut.');
      return;
    }

    setSubmittingUpdate(true);
    try {
      await appendTrackingEventAndUpdateLetter({
        letter,
        uid: currentUid,
        actorName: currentUserName,
        update: validation.sanitized,
      });
      setNote('');
    } catch (err) {
      setUpdateError(
        err instanceof Error
          ? err.message
          : 'Gagal memperbarui status pelacakan.'
      );
    } finally {
      setSubmittingUpdate(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteLetterAndEvents(letter.id, currentUid);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenUploadedFile = async (mode: 'preview' | 'download') => {
    if (!letter.uploadedFileUrl) return;
    setFileError(null);
    setFileBusy(true);
    try {
      if (mode === 'preview' && letter.uploadedFileMime === 'application/pdf') {
        const { data } = await fetchAuthenticatedFileBytes(letter.uploadedFileUrl);
        setPdfPreviewData(data);
      } else {
        const { blobUrl } = await fetchAuthenticatedFileBlob(letter.uploadedFileUrl);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = letter.uploadedFileName || 'dokumen-surat';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      }
    } catch (err) {
      setFileError(
        err instanceof Error ? err.message : 'Gagal membuka berkas surat.'
      );
    } finally {
      setFileBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/30 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-letter-subject"
    >
      <div
        className="flex-1 no-print"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`w-full max-w-2xl bg-white border-l border-slate-200 h-full flex flex-col overflow-hidden ${printModalOpen ? 'no-print' : ''}`}>
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <DirectionLabel direction={letter.direction} />
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              title="Salin kode tracking"
              className="inline-flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-700 hover:text-blue-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>{letter.trackingCode}</span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setPrintModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Disposisi
            </button>
            {(isOwner || isAdmin) && !isLocked && (
              <button
                type="button"
                onClick={() => onEditClick(letter)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                Sunting
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup panel"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Print Header (visible only when printing) */}
          <div className="hidden print-only border-b-2 border-slate-900 pb-4 mb-4">
            <p className="text-xs font-mono text-slate-600">
              LEMBAR DISPOSISI & PELACAKAN SURAT · {letter.trackingCode}
            </p>
            <h1 className="text-xl font-bold font-display text-slate-900 mt-1">
              TataSurat — Catatan Perjalanan Naskah Dinas
            </h1>
          </div>

          {/* Primary Title & Status */}
          <div>
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 mb-2">
              <span className="font-mono tabular-nums text-slate-800 font-medium">
                {letter.letterNumber}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {letter.agendaNumber || '-'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{letter.classification}</span>
              <span aria-hidden="true">·</span>
              <PriorityLabel priority={letter.priority} />
            </div>

            <h2
              id="drawer-letter-subject"
              className="text-xl font-semibold font-display text-slate-900 leading-snug mb-3"
              style={{ textWrap: 'balance' }}
            >
              {letter.subject}
            </h2>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <StatusLabel status={letter.status} />
              <span className="text-slate-300" aria-hidden="true">
                |
              </span>
              <span>
                Posisi saat ini:{' '}
                <strong className="font-medium text-slate-900">
                  {letter.currentUnit}
                </strong>
              </span>
              {letter.assignedToName && (
                <>
                  <span className="text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <span>PIC: {letter.assignedToName}</span>
                </>
              )}
            </div>
          </div>

          {/* Real-Time Lifecycle Milestone Stepper */}
          <div className="border-t border-b border-slate-200 py-4">
            <p className="text-xs font-medium text-slate-500 mb-3">
              Progres Siklus Surat
            </p>
            <div className="grid grid-cols-5 gap-2">
              {PROGRESS_STAGES.map((stage, idx) => {
                const reached = idx <= stageIndex;
                const isCurrent = idx === stageIndex;
                return (
                  <div key={stage.label} className="flex flex-col gap-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-colors ${
                        isCurrent
                          ? 'bg-blue-700'
                          : reached
                          ? 'bg-emerald-600'
                          : 'bg-slate-200'
                      }`}
                    />
                    <span
                      className={`text-[11px] leading-tight ${
                        isCurrent
                          ? 'font-semibold text-blue-700'
                          : reached
                          ? 'font-medium text-slate-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Metadata Detail Grid */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-xs text-slate-500 mb-0.5">Pengirim</dt>
              <dd className="font-medium text-slate-900">{letter.sender}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 mb-0.5">Penerima</dt>
              <dd className="font-medium text-slate-900">{letter.recipient}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 mb-0.5">Unit Registrasi</dt>
              <dd className="text-slate-800">{letter.originUnit}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 mb-0.5">
                Tanggal Surat / {letter.direction === 'masuk' ? 'Diterima' : 'Dikirim'}
              </dt>
              <dd className="font-mono tabular-nums text-xs text-slate-800 pt-0.5">
                {formatIndonesianDate(letter.letterDate)} ·{' '}
                {formatIndonesianDate(letter.receivedOrSentDate)}
              </dd>
            </div>
            {letter.summary && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500 mb-1">Ringkasan Isi</dt>
                <dd className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {letter.summary}
                </dd>
              </div>
            )}
            {letter.uploadedFileName && letter.uploadedFileUrl && (
              <div className="sm:col-span-2 no-print">
                <dt className="text-xs text-slate-500 mb-1.5">
                  Berkas Surat Terunggah (PDF / Word)
                </dt>
                <dd className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 rounded-lg px-3.5 py-2.5 bg-slate-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-blue-700 shrink-0" />
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {letter.uploadedFileName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {letter.uploadedFileMime === 'application/pdf' && (
                      <button
                        type="button"
                        disabled={fileBusy}
                        onClick={() => handleOpenUploadedFile('preview')}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded-md cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Pratinjau PDF
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={fileBusy}
                      onClick={() => handleOpenUploadedFile('download')}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Unduh Berkas
                    </button>
                  </div>
                </dd>
                {fileError && (
                  <p className="text-xs text-red-700 mt-1.5">{fileError}</p>
                )}
              </div>
            )}
            {letter.attachmentUrl && (
              <div className="sm:col-span-2 no-print">
                <dt className="text-xs text-slate-500 mb-1">Tautan Dokumen Eksternal</dt>
                <dd>
                  <a
                    href={letter.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline"
                  >
                    <span>Buka Tautan Dokumen</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </dd>
              </div>
            )}
          </dl>

          {/* Update Status / Disposisi Form (Hidden on Print) */}
          <div className="border-t border-slate-200 pt-5 no-print">
            <h3 className="text-sm font-semibold font-display text-slate-900 mb-3">
              Catat Pergerakan / Disposisi Real-Time
            </h3>

            {isLocked ? (
              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                Surat berstatus Diarsipkan telah dikunci untuk perubahan reguler.
              </p>
            ) : (
              <form
                onSubmit={handleLogTrackingUpdate}
                className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Jenis Aksi
                    </label>
                    <select
                      value={actionType}
                      onChange={(e) =>
                        setActionType(e.target.value as TrackingActionType)
                      }
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                    >
                      {TRACKING_ACTIONS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Status Baru
                    </label>
                    <select
                      value={statusAfter}
                      onChange={(e) =>
                        setStatusAfter(e.target.value as LetterStatus)
                      }
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                    >
                      {LETTER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Unit Tujuan / Pemegang Berkas
                    </label>
                    <select
                      value={toUnit}
                      onChange={(e) => setToUnit(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                    >
                      {ORGANIZATIONAL_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Penanggung Jawab (PIC)
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={assignedToName}
                      onChange={(e) => setAssignedToName(e.target.value)}
                      placeholder="Nama penerima/PIC"
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Instruksi Disposisi / Catatan Tindak Lanjut
                  </label>
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Contoh: Diteruskan ke Bagian Keuangan untuk verifikasi pembayaran..."
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>

                {updateError && (
                  <p className="text-xs text-red-700">{updateError}</p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingUpdate}
                    className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {submittingUpdate
                      ? 'Menyimpan...'
                      : 'Perbarui Status & Catat Jejak'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Real-Time Tracking Timeline */}
          <div className="border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold font-display text-slate-900">
                Riwayat Pelacakan Real-Time
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {events.length} catatan
              </span>
            </div>

            {eventsError && (
              <p className="text-xs text-red-700 mb-3">{eventsError}</p>
            )}

            {loadingEvents ? (
              <div className="space-y-3">
                <div className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                <div className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              </div>
            ) : events.length === 0 ? (
              <p className="text-sm text-slate-500">
                Belum ada riwayat pergerakan surat.
              </p>
            ) : (
              <ol className="relative border-l border-slate-200 ml-2.5 space-y-5">
                {events.map((evt, index) => {
                  const isLatest = index === events.length - 1;
                  return (
                    <li key={evt.id} className="pl-5 relative">
                      <span
                        className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                          isLatest ? 'bg-blue-700' : 'bg-slate-400'
                        }`}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1">
                        <div className="flex items-center gap-2 font-medium text-slate-900">
                          <span>{evt.actionType}</span>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-slate-700">
                            {evt.statusAfter}
                          </span>
                        </div>
                        <time className="font-mono tabular-nums text-slate-500">
                          {formatTimestamp(evt.createdAt)}
                        </time>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 mb-1">
                        <span>{evt.fromUnit}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="font-medium text-slate-900">
                          {evt.toUnit}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span>Oleh {evt.actorName}</span>
                      </div>

                      {evt.note && (
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {evt.note}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Delete Zone (Owner or Admin only) */}
          {(isOwner || isAdmin) && (
            <div className="border-t border-slate-200 pt-5 no-print">
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-800 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus Surat dari Agenda
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <span className="text-xs text-red-800">
                    Hapus surat ini beserta seluruh riwayat pelacakannya secara permanen?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="px-3 py-1 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-md cursor-pointer"
                    >
                      {deleting ? 'Menghapus...' : 'Ya, Hapus'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Canvas-based PDF Preview Modal (immune to Chrome iframe PDF block) */}
      {pdfPreviewData && (
        <PdfPreviewModal
          fileName={letter.uploadedFileName || 'Dokumen Surat.pdf'}
          pdfData={pdfPreviewData}
          onDownload={() => void handleOpenUploadedFile('download')}
          onClose={() => setPdfPreviewData(null)}
        />
      )}
      {/* Disposition Print Preview & Export Modal */}
      {printModalOpen && (
        <DispositionPrintModal
          letter={letter}
          events={events}
          onClose={() => setPrintModalOpen(false)}
        />
      )}
    </div>
  );
}
