import { useState } from 'react';
import { Check, Copy, Download, Printer, X } from 'lucide-react';
import type {
  LetterRecord,
  TrackingEventRecord,
} from '../types/correspondence';
import { formatIndonesianDate, formatTimestamp } from '../utils/validation';

interface DispositionPrintModalProps {
  letter: LetterRecord;
  events: TrackingEventRecord[];
  onClose: () => void;
}

function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function DispositionPrintModal({
  letter,
  events,
  onClose,
}: DispositionPrintModalProps) {
  const [copied, setCopied] = useState(false);
  const [printAttempted, setPrintAttempted] = useState(false);

  const handleBrowserPrint = () => {
    setPrintAttempted(true);
    try {
      window.print();
    } catch {
      // Blocked in restricted iframe
    }
  };

  const handleDownloadHtmlSheet = () => {
    const rowsHtml = events
      .map(
        (evt, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td style="font-family:monospace;">${escapeHtml(formatTimestamp(evt.createdAt))}</td>
        <td><strong>${escapeHtml(evt.actionType)}</strong> (${escapeHtml(evt.statusAfter)})</td>
        <td>${escapeHtml(evt.fromUnit)} &rarr; ${escapeHtml(evt.toUnit)}</td>
        <td>${escapeHtml(evt.actorName)}</td>
        <td>${escapeHtml(evt.note || '-')}</td>
      </tr>`
      )
      .join('');

    const htmlDoc = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Lembar Disposisi - ${escapeHtml(letter.trackingCode)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 0; padding: 24px; line-height: 1.45; }
    .sheet { max-width: 780px; margin: 0 auto; border: 1.5px solid #0f172a; padding: 24px; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
    .header h1 { margin: 0; font-size: 18px; letter-spacing: 0.02em; }
    .header p { margin: 4px 0 0; font-size: 12px; color: #475569; }
    .code { font-family: monospace; font-size: 12px; text-align: right; }
    table.meta { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
    table.meta td { border: 1px solid #cbd5e1; padding: 7px 10px; vertical-align: top; }
    table.meta td.label { width: 150px; background: #f8fafc; font-weight: 600; color: #334155; }
    h2 { font-size: 13px; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: 0.04em; color: #0f172a; }
    table.events { width: 100%; border-collapse: collapse; font-size: 11px; }
    table.events th, table.events td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
    table.events th { background: #f8fafc; font-weight: 600; }
    .footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 11px; color: #475569; }
    .sig { width: 220px; text-align: center; }
    .sig-line { margin-top: 52px; border-top: 1px solid #0f172a; padding-top: 4px; color: #0f172a; font-weight: 600; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="max-width:780px;margin:0 auto 12px;text-align:right;">
    <button onclick="window.print()" style="padding:8px 14px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">Cetak / Simpan PDF</button>
  </div>
  <div class="sheet">
    <div class="header">
      <div>
        <h1>LEMBAR DISPOSISI &amp; PELACAKAN SURAT</h1>
        <p>TataSurat &mdash; Sistem Persuratan Digital Real-Time</p>
      </div>
      <div class="code">
        <div>Kode Tracking: <strong>${escapeHtml(letter.trackingCode)}</strong></div>
        <div>No. Agenda: <strong>${escapeHtml(letter.agendaNumber || '-')}</strong></div>
      </div>
    </div>

    <table class="meta">
      <tr>
        <td class="label">Jenis Surat</td>
        <td>${letter.direction === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'}</td>
        <td class="label">Sifat / Prioritas</td>
        <td>${escapeHtml(letter.priority)} (${escapeHtml(letter.classification)})</td>
      </tr>
      <tr>
        <td class="label">Nomor Surat</td>
        <td style="font-family:monospace;">${escapeHtml(letter.letterNumber)}</td>
        <td class="label">Tanggal Surat</td>
        <td style="font-family:monospace;">${escapeHtml(formatIndonesianDate(letter.letterDate))}</td>
      </tr>
      <tr>
        <td class="label">Pengirim</td>
        <td>${escapeHtml(letter.sender)}</td>
        <td class="label">Penerima</td>
        <td>${escapeHtml(letter.recipient)}</td>
      </tr>
      <tr>
        <td class="label">Posisi Unit Kini</td>
        <td><strong>${escapeHtml(letter.currentUnit)}</strong></td>
        <td class="label">Status Terkini</td>
        <td><strong>${escapeHtml(letter.status)}</strong> (PIC: ${escapeHtml(letter.assignedToName || '-')})</td>
      </tr>
      <tr>
        <td class="label">Perihal</td>
        <td colspan="3"><strong>${escapeHtml(letter.subject)}</strong></td>
      </tr>
      <tr>
        <td class="label">Ringkasan Isi</td>
        <td colspan="3">${escapeHtml(letter.summary || '-')}</td>
      </tr>
    </table>

    <h2>Riwayat Disposisi &amp; Pergerakan Surat</h2>
    <table class="events">
      <thead>
        <tr>
          <th style="width:28px;text-align:center;">No</th>
          <th style="width:110px;">Waktu</th>
          <th style="width:120px;">Aksi / Status</th>
          <th style="width:150px;">Alur Unit</th>
          <th style="width:100px;">Petugas</th>
          <th>Catatan / Instruksi</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="6" style="text-align:center;">Belum ada catatan pergerakan.</td></tr>'}
      </tbody>
    </table>

    <div class="footer">
      <div>Dicetak dari TataSurat pada ${escapeHtml(new Date().toLocaleString('id-ID'))}</div>
      <div class="sig">
        <div>Mengetahui / Pejabat Berwenang,</div>
        <div class="sig-line">Paraf &amp; Nama Terang</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lembar_Disposisi_${letter.trackingCode}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleCopySummary = async () => {
    const lines = [
      `LEMBAR DISPOSISI SURAT (${letter.trackingCode})`,
      `Nomor Surat : ${letter.letterNumber}`,
      `No. Agenda  : ${letter.agendaNumber || '-'}`,
      `Jenis/Sifat : ${letter.direction === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'} / ${letter.priority}`,
      `Perihal     : ${letter.subject}`,
      `Pengirim    : ${letter.sender}`,
      `Penerima    : ${letter.recipient}`,
      `Posisi Unit : ${letter.currentUnit} (${letter.status})`,
      '',
      'Riwayat Pergerakan:',
      ...events.map(
        (e, i) =>
          `${i + 1}. [${formatTimestamp(e.createdAt)}] ${e.actionType} (${e.fromUnit} -> ${e.toUnit}) oleh ${e.actorName}: ${e.note || '-'}`
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disposition-print-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden print-reset-container">
        {/* Modal Toolbar (hidden in print) */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50 no-print">
          <div>
            <h2
              id="disposition-print-title"
              className="text-sm font-semibold font-display text-slate-900"
            >
              Pratinjau Lembar Disposisi
            </h2>
            <p className="text-xs text-slate-500">
              {letter.trackingCode} · {letter.letterNumber}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Tersalin
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Salin Teks
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadHtmlSheet}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh Lembar (.html)
            </button>

            <button
              type="button"
              onClick={handleBrowserPrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak / PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau cetak"
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {printAttempted && (
          <div className="px-6 py-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-800 no-print">
            Jika dialog cetak browser tidak muncul karena pembatasan iframe pratinjau, gunakan tombol{' '}
            <strong>Unduh Lembar (.html)</strong> lalu buka berkasnya untuk mencetak atau menyimpan ke PDF.
          </div>
        )}

        {/* Printable Document Sheet */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-slate-100/70 print-reset-scroll">
          <div
            id="printable-disposition-sheet"
            className="bg-white border border-slate-900 max-w-3xl mx-auto p-6 sm:p-8 text-slate-900"
          >
            <div className="border-b-2 border-slate-900 pb-4 mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium tracking-wider text-slate-600 uppercase">
                  TataSurat · Sistem Persuratan Digital
                </p>
                <h3 className="text-lg font-bold font-display text-slate-900 mt-0.5">
                  LEMBAR DISPOSISI &amp; PELACAKAN SURAT
                </h3>
              </div>
              <div className="text-left sm:text-right text-xs font-mono tabular-nums space-y-0.5">
                <div>
                  Kode Tracking:{' '}
                  <strong className="text-slate-900">{letter.trackingCode}</strong>
                </div>
                <div>
                  No. Agenda:{' '}
                  <strong className="text-slate-900">
                    {letter.agendaNumber || '-'}
                  </strong>
                </div>
              </div>
            </div>

            <table className="w-full border-collapse text-xs mb-6">
              <tbody>
                <tr>
                  <td className="border border-slate-300 bg-slate-50 font-semibold text-slate-700 px-3 py-2 w-36">
                    Jenis Surat
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    {letter.direction === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'}
                  </td>
                  <td className="border border-slate-300 bg-slate-50 font-semibold text-slate-700 px-3 py-2 w-36">
                    Sifat / Klasifikasi
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    {letter.priority} · {letter.classification}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 bg-slate-50 font-semibold text-slate-700 px-3 py-2">
                    Nomor Surat
                  </td>
                  <td className="border border-slate-300 px-3 py-2 font-mono">
                    {letter.letterNumber}
                  </td>
                  <td className="border border-slate-300 bg-slate-50 font-semibold text-slate-700 px-3 py-2">
                    Tanggal Surat
                  </td>
                  <td className="border border-slate-300 px-3 py-2 font-mono tabular-nums">
                    {formatIndonesianDate(letter.letterDate)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 bg-slate-50 font-semibold text-slate-700 px-3 py-2">
                    Pengirim
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    {letter.sender}
                  </td>
                  <td className="border border-slate-300 bg-slate-50 font-semibold text-slate-700 px-3 py-2">
                    Penerima
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    {letter.recipient}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 bg-slate-50 font-semibold text-slate-700 px-3 py-2">
                    Posisi Unit Kini
                  </td>
                  <td className="border border-slate-300 px-3 py-2 font-semibold">
                    {letter.currentUnit}
                  </td>
                  <td className="border border-slate-300 bg-slate-50 font-semibold text-slate-700 px-3 py-2">
                    Status / PIC
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    {letter.status} · {letter.assignedToName || '-'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 bg-slate-50 font-semibold text-slate-700 px-3 py-2">
                    Perihal
                  </td>
                  <td
                    colSpan={3}
                    className="border border-slate-300 px-3 py-2 font-semibold"
                  >
                    {letter.subject}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 bg-slate-50 font-semibold text-slate-700 px-3 py-2">
                    Ringkasan Isi
                  </td>
                  <td colSpan={3} className="border border-slate-300 px-3 py-2">
                    {letter.summary || '-'}
                  </td>
                </tr>
              </tbody>
            </table>

            <h4 className="text-xs font-bold font-display uppercase tracking-wider text-slate-900 mb-2">
              Riwayat Disposisi &amp; Pergerakan Surat
            </h4>
            <table className="w-full border-collapse text-xs mb-8">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="border border-slate-300 px-2.5 py-2 text-center w-10">
                    No
                  </th>
                  <th className="border border-slate-300 px-2.5 py-2 text-left w-32">
                    Waktu
                  </th>
                  <th className="border border-slate-300 px-2.5 py-2 text-left w-32">
                    Aksi / Status
                  </th>
                  <th className="border border-slate-300 px-2.5 py-2 text-left">
                    Alur Unit &amp; Petugas
                  </th>
                  <th className="border border-slate-300 px-2.5 py-2 text-left">
                    Catatan / Instruksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="border border-slate-300 px-3 py-4 text-center text-slate-500"
                    >
                      Belum ada riwayat pergerakan tercatat.
                    </td>
                  </tr>
                ) : (
                  events.map((evt, idx) => (
                    <tr key={evt.id}>
                      <td className="border border-slate-300 px-2.5 py-2 text-center font-mono tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2 font-mono tabular-nums whitespace-nowrap">
                        {formatTimestamp(evt.createdAt)}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2">
                        <div className="font-semibold">{evt.actionType}</div>
                        <div className="text-slate-600">{evt.statusAfter}</div>
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2">
                        <div>
                          {evt.fromUnit} → <strong>{evt.toUnit}</strong>
                        </div>
                        <div className="text-slate-600">{evt.actorName}</div>
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2">
                        {evt.note || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="flex items-end justify-between gap-6 pt-4 text-xs text-slate-600">
              <div>
                Dicetak dari TataSurat · {new Date().toLocaleDateString('id-ID')}
              </div>
              <div className="w-48 text-center">
                <p className="mb-12">Mengetahui / Pejabat Berwenang,</p>
                <div className="border-t border-slate-900 pt-1 font-semibold text-slate-900">
                  Paraf &amp; Nama Terang
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
