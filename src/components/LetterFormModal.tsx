import React, { useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Trash2, Upload, X } from 'lucide-react';
import { extractLetterFromFile } from '../services/correspondenceService';
import {
  LETTER_CLASSIFICATIONS,
  LETTER_PRIORITIES,
  ORGANIZATIONAL_UNITS,
  type LetterClassification,
  type LetterDirection,
  type LetterPriority,
  type LetterRecord,
  type LetterStatus,
} from '../types/correspondence';
import {
  generateAgendaNumber,
  SCHEMA_LIMITS,
  validateLetterDraft,
  type LetterDraftInput,
} from '../utils/validation';

interface LetterFormModalProps {
  mode: 'create' | 'edit';
  initialDirection?: LetterDirection;
  existingLetter?: LetterRecord | null;
  existingCount: number;
  defaultUnit: string;
  defaultUserName: string;
  onClose: () => void;
  onSubmit: (draft: LetterDraftInput, initialNote: string) => Promise<void>;
}

const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function LetterFormModal({
  mode,
  initialDirection = 'masuk',
  existingLetter,
  existingCount,
  defaultUnit,
  defaultUserName,
  onClose,
  onSubmit,
}: LetterFormModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [direction, setDirection] = useState<LetterDirection>(
    existingLetter?.direction ?? initialDirection
  );
  const [letterNumber, setLetterNumber] = useState(
    existingLetter?.letterNumber ?? ''
  );
  const [agendaNumber, setAgendaNumber] = useState(
    existingLetter?.agendaNumber ??
      generateAgendaNumber(initialDirection, existingCount)
  );
  const [subject, setSubject] = useState(existingLetter?.subject ?? '');
  const [sender, setSender] = useState(existingLetter?.sender ?? '');
  const [recipient, setRecipient] = useState(existingLetter?.recipient ?? '');
  const [originUnit, setOriginUnit] = useState(
    existingLetter?.originUnit ?? defaultUnit ?? ORGANIZATIONAL_UNITS[0]
  );
  const [currentUnit, setCurrentUnit] = useState(
    existingLetter?.currentUnit ??
      (initialDirection === 'masuk' ? 'Sekretariat Umum' : 'Eksternal / Instansi Luar')
  );
  const [letterDate, setLetterDate] = useState(
    existingLetter?.letterDate ?? today
  );
  const [receivedOrSentDate, setReceivedOrSentDate] = useState(
    existingLetter?.receivedOrSentDate ?? today
  );
  const [priority, setPriority] = useState<LetterPriority>(
    existingLetter?.priority ?? 'Biasa'
  );
  const [classification, setClassification] = useState<LetterClassification>(
    existingLetter?.classification ?? 'Umum'
  );
  const [status, setStatus] = useState<LetterStatus>(
    existingLetter?.status ??
      (initialDirection === 'masuk' ? 'Terdaftar' : 'Terkirim')
  );
  const [assignedToName, setAssignedToName] = useState(
    existingLetter?.assignedToName ?? defaultUserName
  );
  const [attachmentUrl, setAttachmentUrl] = useState(
    existingLetter?.attachmentUrl ?? ''
  );
  const [uploadedFileName, setUploadedFileName] = useState(
    existingLetter?.uploadedFileName ?? ''
  );
  const [uploadedFileUrl, setUploadedFileUrl] = useState(
    existingLetter?.uploadedFileUrl ?? ''
  );
  const [uploadedFileMime, setUploadedFileMime] = useState(
    existingLetter?.uploadedFileMime ?? ''
  );
  const [summary, setSummary] = useState(existingLetter?.summary ?? '');
  const [initialNote, setInitialNote] = useState('');

  const [dragActive, setDragActive] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDirectionChange = (nextDir: LetterDirection) => {
    if (mode === 'edit') return;
    setDirection(nextDir);
    setAgendaNumber(generateAgendaNumber(nextDir, existingCount));
    setStatus(nextDir === 'masuk' ? 'Terdaftar' : 'Terkirim');
    if (nextDir === 'keluar') {
      setOriginUnit(defaultUnit || 'Sekretariat Umum');
      setCurrentUnit('Eksternal / Instansi Luar');
    } else {
      setOriginUnit('Sekretariat Umum');
      setCurrentUnit('Direksi / Pimpinan');
    }
  };

  const processSelectedFile = async (file: File) => {
    setUploadNotice(null);
    setErrorMsg(null);

    const lower = file.name.toLowerCase();
    const validExt = ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
    if (!validExt) {
      setUploadNotice({
        type: 'error',
        text: 'Format file tidak didukung. Gunakan file PDF (.pdf) atau Word (.doc, .docx).',
      });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadNotice({
        type: 'error',
        text: 'Ukuran file melebihi batas maksimal 10 MB.',
      });
      return;
    }

    setExtracting(true);
    try {
      const result = await extractLetterFromFile(file);

      if (result.file) {
        setUploadedFileName(result.file.fileName);
        setUploadedFileUrl(result.file.fileUrl);
        setUploadedFileMime(result.file.fileMime);
      }

      if (result.error) {
        setUploadNotice({
          type: 'warning',
          text: result.error,
        });
        return;
      }

      if (result.extracted) {
        const ex = result.extracted;
        if (mode === 'create' && (ex.direction === 'masuk' || ex.direction === 'keluar')) {
          setDirection(ex.direction);
          setAgendaNumber(generateAgendaNumber(ex.direction, existingCount));
          setStatus(ex.direction === 'masuk' ? 'Terdaftar' : 'Terkirim');
        }
        if (ex.letterNumber) setLetterNumber(ex.letterNumber);
        if (ex.subject) setSubject(ex.subject);
        if (ex.sender) setSender(ex.sender);
        if (ex.recipient) setRecipient(ex.recipient);
        if (ex.letterDate && SCHEMA_LIMITS.DATE_PATTERN.test(ex.letterDate)) {
          setLetterDate(ex.letterDate);
        }
        if (LETTER_PRIORITIES.includes(ex.priority)) {
          setPriority(ex.priority);
        }
        if (LETTER_CLASSIFICATIONS.includes(ex.classification)) {
          setClassification(ex.classification);
        }
        if (
          ex.suggestedUnit &&
          ORGANIZATIONAL_UNITS.includes(
            ex.suggestedUnit as (typeof ORGANIZATIONAL_UNITS)[number]
          )
        ) {
          setCurrentUnit(ex.suggestedUnit);
        }
        if (ex.summary) setSummary(ex.summary);

        setUploadNotice({
          type: 'success',
          text: `Dokumen "${file.name}" berhasil dibaca dan kolom formulir telah diisi otomatis. Periksa kembali sebelum menyimpan.`,
        });
      }
    } catch (err) {
      setUploadNotice({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Gagal mengunggah dan memproses dokumen.',
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validation = validateLetterDraft({
      direction,
      letterNumber,
      agendaNumber,
      subject,
      sender,
      recipient,
      originUnit,
      currentUnit,
      letterDate,
      receivedOrSentDate,
      priority,
      classification,
      status,
      summary,
      attachmentUrl,
      uploadedFileName,
      uploadedFileUrl,
      uploadedFileMime,
      assignedToName,
    });

    if (!validation.valid || !validation.sanitized) {
      setErrorMsg(validation.error ?? 'Periksa kembali isian formulir.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(validation.sanitized, initialNote.trim());
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menyimpan data surat.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="letter-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2
            id="letter-modal-title"
            className="text-base font-semibold font-display text-slate-900"
          >
            {mode === 'create'
              ? 'Catat Surat Baru'
              : 'Sunting Metadata & Berkas Surat'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-5">
          {/* Upload PDF / Word Document Dropzone */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-medium text-slate-700">
                Unggah Dokumen Surat (PDF atau Word)
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                .pdf · .docx · .doc (Maks. 10 MB)
              </span>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`border border-dashed rounded-xl p-4 transition-colors ${
                dragActive
                  ? 'border-blue-600 bg-blue-50/70'
                  : 'border-slate-300 bg-slate-50/70 hover:border-slate-400'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {extracting ? (
                <div className="flex items-center justify-center gap-3 py-3 text-sm text-blue-700">
                  <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                  <span>
                    Mengunggah berkas & mengekstrak isi surat secara otomatis...
                  </span>
                </div>
              ) : uploadedFileName ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-5 h-5 text-blue-700 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {uploadedFileName}
                      </p>
                      <p className="text-xs text-slate-500">
                        Berkas terlampir dan siap disimpan bersama agenda surat
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Ganti Berkas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedFileName('');
                        setUploadedFileUrl('');
                        setUploadedFileMime('');
                        setUploadNotice(null);
                      }}
                      aria-label="Hapus berkas terlampir"
                      className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-1">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      <Upload className="w-4 h-4 text-blue-700" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Tarik file surat ke sini atau pilih berkas
                      </p>
                      <p className="text-xs text-slate-500">
                        Nomor surat, perihal, pengirim, penerima, tanggal & ringkasan akan terisi otomatis.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 text-xs font-medium text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Pilih PDF / Word
                  </button>
                </div>
              )}
            </div>

            {uploadNotice && (
              <div
                className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${
                  uploadNotice.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : uploadNotice.type === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {uploadNotice.type === 'success' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <span>{uploadNotice.text}</span>
              </div>
            )}
          </div>

          {mode === 'create' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Jenis Alur Surat
              </label>
              <div className="inline-flex p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => handleDirectionChange('masuk')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    direction === 'masuk'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Surat Masuk
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectionChange('keluar')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    direction === 'keluar'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Surat Keluar
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nomor Surat <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={letterNumber}
                onChange={(e) => setLetterNumber(e.target.value)}
                placeholder="Contoh: 045/SETJEN/XI/2026"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nomor Agenda Internal
              </label>
              <input
                type="text"
                maxLength={64}
                value={agendaNumber}
                onChange={(e) => setAgendaNumber(e.target.value)}
                placeholder="Otomatis jika dikosongkan"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Perihal Surat <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={240}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ringkasan judul atau perihal pokok surat"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Pengirim / Instansi Asal <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={160}
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder={
                  direction === 'masuk'
                    ? 'Nama instansi atau pengirim'
                    : 'Unit internal penerbit surat'
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Penerima / Tujuan Surat <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={160}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={
                  direction === 'masuk'
                    ? 'Pejabat atau unit tujuan'
                    : 'Instansi atau pihak penerima'
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Unit Registrasi / Asal
              </label>
              <select
                value={originUnit}
                onChange={(e) => setOriginUnit(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
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
                Posisi Unit Saat Ini
              </label>
              <select
                value={currentUnit}
                onChange={(e) => setCurrentUnit(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
              >
                {ORGANIZATIONAL_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tanggal Surat
              </label>
              <input
                type="date"
                required
                value={letterDate}
                onChange={(e) => setLetterDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {direction === 'masuk' ? 'Tanggal Diterima' : 'Tanggal Dikirim'}
              </label>
              <input
                type="date"
                required
                value={receivedOrSentDate}
                onChange={(e) => setReceivedOrSentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
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
                placeholder="Nama staf PIC"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Sifat / Prioritas
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as LetterPriority)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
              >
                {LETTER_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Klasifikasi Surat
              </label>
              <select
                value={classification}
                onChange={(e) =>
                  setClassification(e.target.value as LetterClassification)
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
              >
                {LETTER_CLASSIFICATIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Tautan Dokumen Eksternal (Opsional)
            </label>
            <input
              type="url"
              maxLength={500}
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Ringkasan Isi Surat
            </label>
            <textarea
              rows={3}
              maxLength={2000}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Ringkasan singkat isi atau poin penting surat..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 resize-y"
            />
          </div>

          {mode === 'create' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Catatan Jejak Awal (Opsional)
              </label>
              <input
                type="text"
                maxLength={1000}
                value={initialNote}
                onChange={(e) => setInitialNote(e.target.value)}
                placeholder="Contoh: Berkas PDF/Word diterima dan diregistrasikan ke agenda"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || extracting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              {submitting
                ? 'Menyimpan...'
                : mode === 'create'
                ? 'Daftarkan Surat'
                : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
