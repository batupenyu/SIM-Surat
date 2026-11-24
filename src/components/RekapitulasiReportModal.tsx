import { useMemo, useState } from 'react';
import { Check, Copy, Download, Printer, X } from 'lucide-react';
import type { LetterDirection, LetterRecord } from '../types/correspondence';
import { formatIndonesianDate } from '../utils/validation';

interface RekapitulasiReportModalProps {
  allLetters: LetterRecord[];
  initialFilteredLetters: LetterRecord[];
  activeScopeLabel: string;
  preparedByName: string;
  preparedByUnit: string;
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

export function RekapitulasiReportModal({
  allLetters,
  initialFilteredLetters,
  activeScopeLabel,
  preparedByName,
  preparedByUnit,
  onClose,
}: RekapitulasiReportModalProps) {
  const [scopeSource, setScopeSource] = useState<'filtered' | 'all'>(
    initialFilteredLetters.length === allLetters.length ? 'all' : 'filtered'
  );
  const [directionFilter, setDirectionFilter] = useState<
    'all' | LetterDirection
  >('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [copied, setCopied] = useState(false);
  const [printAttempted, setPrintAttempted] = useState(false);

  const reportLetters = useMemo(() => {
    const base = scopeSource === 'filtered' ? initialFilteredLetters : allLetters;
    return base.filter((l) => {
      if (directionFilter !== 'all' && l.direction !== directionFilter) {
        return false;
      }
      if (startDate && l.receivedOrSentDate < startDate) {
        return false;
      }
      if (endDate && l.receivedOrSentDate > endDate) {
        return false;
      }
      return true;
    });
  }, [
    scopeSource,
    initialFilteredLetters,
    allLetters,
    directionFilter,
    startDate,
    endDate,
  ]);

  const summary = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    let selesai = 0;
    let aktif = 0;

    const unitMap: Record<
      string,
      { unit: string; masuk: number; keluar: number; selesai: number; total: number }
    > = {};

    for (const l of reportLetters) {
      if (l.direction === 'masuk') masuk++;
      else keluar++;

      const isDone = l.status === 'Selesai' || l.status === 'Diarsipkan';
      if (isDone) selesai++;
      else aktif++;

      if (!unitMap[l.currentUnit]) {
        unitMap[l.currentUnit] = {
          unit: l.currentUnit,
          masuk: 0,
          keluar: 0,
          selesai: 0,
          total: 0,
        };
      }
      const entry = unitMap[l.currentUnit];
      if (l.direction === 'masuk') entry.masuk++;
      else entry.keluar++;
      if (isDone) entry.selesai++;
      entry.total++;
    }

    const byUnit = Object.values(unitMap).sort((a, b) => b.total - a.total);
    return {
      total: reportLetters.length,
      masuk,
      keluar,
      selesai,
      aktif,
      byUnit,
    };
  }, [reportLetters]);

  const periodText = useMemo(() => {
    if (startDate && endDate) {
      return `${formatIndonesianDate(startDate)} s.d. ${formatIndonesianDate(endDate)}`;
    }
    if (startDate) return `Mulai ${formatIndonesianDate(startDate)}`;
    if (endDate) return `Sampai ${formatIndonesianDate(endDate)}`;
    return 'Semua Tanggal';
  }, [startDate, endDate]);

  const directionLabel =
    directionFilter === 'all'
      ? 'Surat Masuk & Keluar'
      : directionFilter === 'masuk'
      ? 'Surat Masuk'
      : 'Surat Keluar';

  const scopeLabel =
    scopeSource === 'all' ? 'Seluruh Agenda' : activeScopeLabel;

  const handleBrowserPrint = () => {
    setPrintAttempted(true);
    try {
      window.print();
    } catch {
      // Blocked in restricted iframe
    }
  };

  const handleDownloadHtml = () => {
    const unitRowsHtml = summary.byUnit
      .map(
        (u) => `
      <tr>
        <td>${escapeHtml(u.unit)}</td>
        <td style="text-align:right;font-family:monospace;">${u.masuk}</td>
        <td style="text-align:right;font-family:monospace;">${u.keluar}</td>
        <td style="text-align:right;font-family:monospace;">${u.selesai}</td>
        <td style="text-align:right;font-family:monospace;font-weight:700;">${u.total}</td>
      </tr>`
      )
      .join('');

    const detailRowsHtml = reportLetters
      .map(
        (l, idx) => `
      <tr>
        <td style="text-align:center;font-family:monospace;">${idx + 1}</td>
        <td style="font-family:monospace;">
          <div><strong>${escapeHtml(l.trackingCode)}</strong></div>
          <div style="color:#475569;">${escapeHtml(l.letterNumber)}</div>
        </td>
        <td>${l.direction === 'masuk' ? 'Masuk' : 'Keluar'}</td>
        <td style="font-family:monospace;white-space:nowrap;">${escapeHtml(formatIndonesianDate(l.receivedOrSentDate))}</td>
        <td>
          <div><strong>${escapeHtml(l.subject)}</strong></div>
          <div style="color:#475569;">${escapeHtml(l.sender)} &rarr; ${escapeHtml(l.recipient)}</div>
        </td>
        <td>${escapeHtml(l.currentUnit)}</td>
        <td>${escapeHtml(l.priority)}</td>
        <td><strong>${escapeHtml(l.status)}</strong></td>
      </tr>`
      )
      .join('');

    const htmlDoc = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Laporan Rekapitulasi Persuratan</title>
  <style>
    @page { size: A4 landscape; margin: 14mm; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 0; padding: 20px; line-height: 1.4; }
    .sheet { max-width: 1080px; margin: 0 auto; border: 1.5px solid #0f172a; padding: 24px; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
    .header h1 { margin: 0; font-size: 18px; letter-spacing: 0.02em; }
    .header p { margin: 4px 0 0; font-size: 12px; color: #475569; }
    .meta { text-align: right; font-size: 11px; color: #334155; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #cbd5e1; margin-bottom: 18px; }
    .kpi-cell { padding: 10px 12px; border-right: 1px solid #cbd5e1; }
    .kpi-cell:last-child { border-right: none; }
    .kpi-label { font-size: 11px; color: #475569; }
    .kpi-val { font-size: 20px; font-weight: 700; font-family: monospace; margin-top: 2px; }
    h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; margin: 16px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-weight: 600; color: #334155; }
    .sigs { margin-top: 24px; display: flex; justify-content: space-between; font-size: 11px; }
    .sig-box { width: 220px; text-align: center; }
    .sig-line { margin-top: 48px; border-top: 1px solid #0f172a; padding-top: 4px; font-weight: 600; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="max-width:1080px;margin:0 auto 12px;text-align:right;">
    <button onclick="window.print()" style="padding:8px 14px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">Cetak / Simpan PDF</button>
  </div>
  <div class="sheet">
    <div class="header">
      <div>
        <h1>LAPORAN REKAPITULASI PERSURATAN</h1>
        <p>TataSurat &mdash; ${escapeHtml(directionLabel)} · Cakupan: ${escapeHtml(scopeLabel)}</p>
      </div>
      <div class="meta">
        <div>Periode: <strong>${escapeHtml(periodText)}</strong></div>
        <div>Dicetak: ${escapeHtml(new Date().toLocaleString('id-ID'))}</div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-cell"><div class="kpi-label">Total Surat</div><div class="kpi-val">${summary.total}</div></div>
      <div class="kpi-cell"><div class="kpi-label">Surat Masuk</div><div class="kpi-val">${summary.masuk}</div></div>
      <div class="kpi-cell"><div class="kpi-label">Surat Keluar</div><div class="kpi-val">${summary.keluar}</div></div>
      <div class="kpi-cell"><div class="kpi-label">Selesai / Diarsipkan</div><div class="kpi-val">${summary.selesai} (${summary.aktif} aktif)</div></div>
    </div>

    <h2>Ringkasan per Unit Kerja</h2>
    <table>
      <thead>
        <tr>
          <th>Unit Kerja Pemegang</th>
          <th style="text-align:right;width:90px;">Masuk</th>
          <th style="text-align:right;width:90px;">Keluar</th>
          <th style="text-align:right;width:90px;">Selesai</th>
          <th style="text-align:right;width:90px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${unitRowsHtml || '<tr><td colspan="5" style="text-align:center;">Tidak ada data.</td></tr>'}
      </tbody>
    </table>

    <h2>Rincian Daftar Surat (${summary.total} Dokumen)</h2>
    <table>
      <thead>
        <tr>
          <th style="width:28px;text-align:center;">No</th>
          <th style="width:155px;">Kode &amp; No. Surat</th>
          <th style="width:65px;">Jenis</th>
          <th style="width:90px;">Tanggal</th>
          <th>Perihal &amp; Pihak Terkait</th>
          <th style="width:140px;">Posisi Unit</th>
          <th style="width:75px;">Prioritas</th>
          <th style="width:95px;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${detailRowsHtml || '<tr><td colspan="8" style="text-align:center;">Tidak ada data pada periode/filter ini.</td></tr>'}
      </tbody>
    </table>

    <div class="sigs">
      <div class="sig-box">
        <div>Mengetahui,</div>
        <div class="sig-line">Pimpinan / Kepala Bagian</div>
      </div>
      <div class="sig-box">
        <div>Disusun oleh (${escapeHtml(preparedByUnit)}),</div>
        <div class="sig-line">${escapeHtml(preparedByName)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Rekapitulasi_Surat_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleCopySummary = async () => {
    const lines = [
      'LAPORAN REKAPITULASI PERSURATAN (TataSurat)',
      `Cakupan : ${scopeLabel}`,
      `Jenis   : ${directionLabel}`,
      `Periode : ${periodText}`,
      `Total   : ${summary.total} surat (${summary.masuk} masuk, ${summary.keluar} keluar, ${summary.selesai} selesai/arsip, ${summary.aktif} aktif)`,
      '',
      'Rincian per Unit Kerja:',
      ...summary.byUnit.map(
        (u) =>
          `- ${u.unit}: Total ${u.total} (Masuk ${u.masuk}, Keluar ${u.keluar}, Selesai ${u.selesai})`
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
      aria-labelledby="recap-report-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden print-reset-container">
        {/* Modal Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50 no-print">
          <div>
            <h2
              id="recap-report-title"
              className="text-sm font-semibold font-display text-slate-900"
            >
              Cetak Laporan Rekapitulasi Persuratan
            </h2>
            <p className="text-xs text-slate-500">
              {summary.total} surat dalam cakupan laporan
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
                  Salin Ringkasan
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadHtml}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh Laporan (.html)
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
              aria-label="Tutup laporan rekapitulasi"
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Report Scope & Period Filter Bar (Hidden in Print) */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-wrap items-end gap-4 text-xs no-print">
          <div>
            <label className="block text-slate-500 mb-1">Sumber Data</label>
            <select
              value={scopeSource}
              onChange={(e) =>
                setScopeSource(e.target.value as 'filtered' | 'all')
              }
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-600"
            >
              <option value="filtered">
                Filter Aktif ({initialFilteredLetters.length} surat)
              </option>
              <option value="all">
                Semua Agenda ({allLetters.length} surat)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1">Jenis Surat</label>
            <select
              value={directionFilter}
              onChange={(e) =>
                setDirectionFilter(e.target.value as 'all' | LetterDirection)
              }
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-600"
            >
              <option value="all">Masuk &amp; Keluar</option>
              <option value="masuk">Hanya Surat Masuk</option>
              <option value="keluar">Hanya Surat Keluar</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-slate-500 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          {(startDate || endDate || directionFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setDirectionFilter('all');
                setStartDate('');
                setEndDate('');
              }}
              className="px-2.5 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Reset Periode
            </button>
          )}
        </div>

        {printAttempted && (
          <div className="px-6 py-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-800 no-print">
            Jika dialog cetak browser tidak muncul karena pembatasan iframe pratinjau, gunakan tombol{' '}
            <strong>Unduh Laporan (.html)</strong> lalu buka berkasnya untuk mencetak atau menyimpan ke PDF.
          </div>
        )}

        {/* Printable Recap Report Sheet */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/70 print-reset-scroll">
          <div
            id="printable-recap-report"
            className="bg-white border border-slate-900 max-w-4xl mx-auto p-6 sm:p-8 text-slate-900 space-y-6"
          >
            {/* Report Header */}
            <div className="border-b-2 border-slate-900 pb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium tracking-wider text-slate-600 uppercase">
                  TataSurat · Sistem Persuratan Digital
                </p>
                <h3 className="text-lg font-bold font-display text-slate-900 mt-0.5">
                  LAPORAN REKAPITULASI PERSURATAN
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {directionLabel} · Cakupan: {scopeLabel}
                </p>
              </div>
              <div className="text-left sm:text-right text-xs text-slate-700 space-y-0.5">
                <div>
                  Periode: <strong className="font-mono">{periodText}</strong>
                </div>
                <div>
                  Dicetak: {new Date().toLocaleDateString('id-ID')}
                </div>
              </div>
            </div>

            {/* Summary KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-300 divide-y sm:divide-y-0 sm:divide-x divide-slate-300">
              <div className="p-3">
                <div className="text-[11px] text-slate-500">Total Surat</div>
                <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                  {summary.total}
                </div>
              </div>
              <div className="p-3">
                <div className="text-[11px] text-slate-500">Surat Masuk</div>
                <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                  {summary.masuk}
                </div>
              </div>
              <div className="p-3">
                <div className="text-[11px] text-slate-500">Surat Keluar</div>
                <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                  {summary.keluar}
                </div>
              </div>
              <div className="p-3">
                <div className="text-[11px] text-slate-500">
                  Selesai / Diarsipkan
                </div>
                <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                  {summary.selesai}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    ({summary.aktif} aktif)
                  </span>
                </div>
              </div>
            </div>

            {/* Summary Breakdown by Unit */}
            <div>
              <h4 className="text-xs font-bold font-display uppercase tracking-wider text-slate-900 mb-2">
                Rekapitulasi per Unit Kerja
              </h4>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700">
                    <th className="border border-slate-300 px-3 py-2 text-left">
                      Unit Kerja Pemegang
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-right w-24">
                      Masuk
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-right w-24">
                      Keluar
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-right w-24">
                      Selesai
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-right w-24">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byUnit.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="border border-slate-300 px-3 py-3 text-center text-slate-500"
                      >
                        Tidak ada data pada periode yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    summary.byUnit.map((u) => (
                      <tr key={u.unit}>
                        <td className="border border-slate-300 px-3 py-1.5 font-medium">
                          {u.unit}
                        </td>
                        <td className="border border-slate-300 px-3 py-1.5 text-right font-mono tabular-nums">
                          {u.masuk}
                        </td>
                        <td className="border border-slate-300 px-3 py-1.5 text-right font-mono tabular-nums">
                          {u.keluar}
                        </td>
                        <td className="border border-slate-300 px-3 py-1.5 text-right font-mono tabular-nums">
                          {u.selesai}
                        </td>
                        <td className="border border-slate-300 px-3 py-1.5 text-right font-mono tabular-nums font-semibold">
                          {u.total}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Detailed Letter Register Table */}
            <div>
              <h4 className="text-xs font-bold font-display uppercase tracking-wider text-slate-900 mb-2">
                Rincian Daftar Surat ({summary.total} Dokumen)
              </h4>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700">
                    <th className="border border-slate-300 px-2 py-2 text-center w-9">
                      No
                    </th>
                    <th className="border border-slate-300 px-2.5 py-2 text-left">
                      Kode &amp; Nomor Surat
                    </th>
                    <th className="border border-slate-300 px-2 py-2 text-left">
                      Jenis
                    </th>
                    <th className="border border-slate-300 px-2.5 py-2 text-left">
                      Tanggal
                    </th>
                    <th className="border border-slate-300 px-2.5 py-2 text-left">
                      Perihal &amp; Pihak Terkait
                    </th>
                    <th className="border border-slate-300 px-2.5 py-2 text-left">
                      Posisi Unit
                    </th>
                    <th className="border border-slate-300 px-2 py-2 text-left">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reportLetters.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="border border-slate-300 px-3 py-4 text-center text-slate-500"
                      >
                        Tidak ada surat pada filter atau rentang tanggal ini.
                      </td>
                    </tr>
                  ) : (
                    reportLetters.map((l, idx) => (
                      <tr key={l.id}>
                        <td className="border border-slate-300 px-2 py-1.5 text-center font-mono tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-300 px-2.5 py-1.5 font-mono tabular-nums">
                          <div className="font-semibold">{l.trackingCode}</div>
                          <div className="text-[11px] text-slate-600">
                            {l.letterNumber}
                          </div>
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 whitespace-nowrap">
                          {l.direction === 'masuk' ? 'Masuk' : 'Keluar'}
                        </td>
                        <td className="border border-slate-300 px-2.5 py-1.5 font-mono tabular-nums whitespace-nowrap">
                          {formatIndonesianDate(l.receivedOrSentDate)}
                        </td>
                        <td className="border border-slate-300 px-2.5 py-1.5">
                          <div className="font-medium">{l.subject}</div>
                          <div className="text-[11px] text-slate-600">
                            {l.sender} → {l.recipient}
                          </div>
                        </td>
                        <td className="border border-slate-300 px-2.5 py-1.5">
                          {l.currentUnit}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 font-medium whitespace-nowrap">
                          {l.status}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Signatures */}
            <div className="flex flex-wrap items-end justify-between gap-6 pt-4 text-xs text-slate-700">
              <div className="w-52 text-center">
                <p className="mb-12">Mengetahui,</p>
                <div className="border-t border-slate-900 pt-1 font-semibold text-slate-900">
                  Pimpinan / Kepala Bagian
                </div>
              </div>
              <div className="w-52 text-center">
                <p className="mb-12">Disusun oleh ({preparedByUnit}),</p>
                <div className="border-t border-slate-900 pt-1 font-semibold text-slate-900">
                  {preparedByName}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
