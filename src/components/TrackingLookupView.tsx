import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { subscribeToTrackingEvents } from '../services/correspondenceService';
import type {
  LetterRecord,
  TrackingEventRecord,
} from '../types/correspondence';
import { formatIndonesianDate, formatTimestamp } from '../utils/validation';
import {
  DirectionLabel,
  PriorityLabel,
  StatusLabel,
} from './StatusIndicator';

interface TrackingLookupViewProps {
  letters: LetterRecord[];
  currentUid: string;
  onOpenDetail: (letter: LetterRecord) => void;
}

export function TrackingLookupView({
  letters,
  currentUid,
  onOpenDetail,
}: TrackingLookupViewProps) {
  const [queryText, setQueryText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(
    letters[0]?.id ?? null
  );
  const [events, setEvents] = useState<TrackingEventRecord[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const matchedLetters = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return letters.slice(0, 8);
    return letters.filter(
      (l) =>
        l.trackingCode.toLowerCase().includes(q) ||
        l.letterNumber.toLowerCase().includes(q) ||
        l.agendaNumber.toLowerCase().includes(q) ||
        l.subject.toLowerCase().includes(q)
    );
  }, [letters, queryText]);

  const activeLetter = useMemo(() => {
    if (selectedId) {
      const found = letters.find((l) => l.id === selectedId);
      if (found) return found;
    }
    return matchedLetters[0] ?? null;
  }, [letters, matchedLetters, selectedId]);

  useEffect(() => {
    if (!activeLetter) {
      setEvents([]);
      return;
    }
    setLoadingEvents(true);
    const unsub = subscribeToTrackingEvents(
      activeLetter.id,
      currentUid,
      (list) => {
        setEvents(list);
        setLoadingEvents(false);
      },
      () => {
        setLoadingEvents(false);
      }
    );
    return () => unsub();
  }, [activeLetter, currentUid]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold font-display text-slate-900 mb-1">
          Lacak Posisi & Riwayat Surat Real-Time
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          Masukkan Kode Tracking, Nomor Surat, atau Nomor Agenda untuk melihat posisi unit pemegang dan alur disposisi terkini.
        </p>

        <div className="relative max-w-2xl">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={queryText}
            onChange={(e) => {
              setQueryText(e.target.value);
              setSelectedId(null);
            }}
            placeholder="Cari kode tracking (contoh: TRK-SM-2026-1042) atau nomor surat..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
          />
        </div>

        {matchedLetters.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 mr-1">
              Hasil cepat:
            </span>
            {matchedLetters.slice(0, 6).map((item) => {
              const isSelected = activeLetter?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`px-3 py-1 text-xs font-mono tabular-nums rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {item.trackingCode}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!activeLetter ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-slate-800 mb-1">
            Surat tidak ditemukan
          </p>
          <p className="text-xs text-slate-500">
            Periksa kembali kode tracking atau nomor surat yang dimasukkan.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <DirectionLabel direction={activeLetter.direction} />
              <StatusLabel status={activeLetter.status} />
            </div>

            <div>
              <p className="text-xs font-mono tabular-nums text-slate-500 mb-1">
                {activeLetter.trackingCode} · {activeLetter.letterNumber}
              </p>
              <h3 className="text-base font-semibold font-display text-slate-900 leading-snug">
                {activeLetter.subject}
              </h3>
            </div>

            <dl className="space-y-2.5 text-sm border-t border-slate-200 pt-4">
              <div className="flex justify-between gap-4">
                <dt className="text-xs text-slate-500">Posisi Unit Saat Ini</dt>
                <dd className="text-xs font-semibold text-blue-700 text-right">
                  {activeLetter.currentUnit}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-xs text-slate-500">Penanggung Jawab</dt>
                <dd className="text-xs text-slate-800 text-right">
                  {activeLetter.assignedToName || '-'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-xs text-slate-500">Pengirim</dt>
                <dd className="text-xs text-slate-800 text-right">
                  {activeLetter.sender}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-xs text-slate-500">Penerima</dt>
                <dd className="text-xs text-slate-800 text-right">
                  {activeLetter.recipient}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-xs text-slate-500">Tanggal Surat</dt>
                <dd className="text-xs font-mono tabular-nums text-slate-800 text-right">
                  {formatIndonesianDate(activeLetter.letterDate)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-xs text-slate-500">Prioritas</dt>
                <dd>
                  <PriorityLabel priority={activeLetter.priority} />
                </dd>
              </div>
            </dl>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => onOpenDetail(activeLetter)}
                className="w-full px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
              >
                Perbarui Status atau Disposisi
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold font-display text-slate-900">
                Jejak Pergerakan Langsung
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {events.length} tahap tercatat
              </span>
            </div>

            {loadingEvents ? (
              <div className="space-y-3">
                <div className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                <div className="h-14 bg-slate-100 rounded-lg animate-pulse" />
              </div>
            ) : events.length === 0 ? (
              <p className="text-sm text-slate-500">
                Belum ada catatan pergerakan untuk surat ini.
              </p>
            ) : (
              <ol className="relative border-l border-slate-200 ml-2.5 space-y-6">
                {events.map((evt, idx) => {
                  const isLatest = idx === events.length - 1;
                  return (
                    <li key={evt.id} className="pl-5 relative">
                      <span
                        className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                          isLatest ? 'bg-blue-700' : 'bg-slate-400'
                        }`}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1">
                        <span className="font-semibold text-slate-900">
                          {evt.actionType} · {evt.statusAfter}
                        </span>
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
                        <span>Petugas: {evt.actorName}</span>
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
        </div>
      )}
    </div>
  );
}
