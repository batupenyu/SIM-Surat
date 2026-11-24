import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Download,
  FilePlus2,
  FileText,
  FolderArchive,
  Inbox,
  LogOut,
  Menu,
  Plus,
  Printer,
  Search,
  Send,
  Settings,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  createLetterWithInitialEvent,
  seedSampleCorrespondence,
  subscribeToLetters,
  updateLetterMetadata,
} from '../services/correspondenceService';
import {
  LETTER_PRIORITIES,
  LETTER_STATUSES,
  ORGANIZATIONAL_UNITS,
  type LetterDirection,
  type LetterPriority,
  type LetterRecord,
  type LetterStatus,
} from '../types/correspondence';
import { formatIndonesianDate, type LetterDraftInput } from '../utils/validation';
import { LetterDetailDrawer } from './LetterDetailDrawer';
import { LetterFormModal } from './LetterFormModal';
import { ProfileSettingsModal } from './ProfileSettingsModal';
import { RekapitulasiReportModal } from './RekapitulasiReportModal';
import {
  DirectionLabel,
  PriorityLabel,
  StatusLabel,
} from './StatusIndicator';
import { TrackingLookupView } from './TrackingLookupView';

type NavView = 'all' | 'masuk' | 'keluar' | 'pending' | 'lookup';

export function CorrespondenceDashboard() {
  const { user, profile, signOutUser } = useAuth();

  const [letters, setLetters] = useState<LetterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<NavView>('all');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<LetterStatus | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<LetterPriority | 'ALL'>(
    'ALL'
  );
  const [searchQuery, setSearchQuery] = useState('');

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formModalState, setFormModalState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    direction: LetterDirection;
    letter: LetterRecord | null;
  }>({
    open: false,
    mode: 'create',
    direction: 'masuk',
    letter: null,
  });

  const [selectedLetterId, setSelectedLetterId] = useState<string | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [recapModalOpen, setRecapModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);

    const unsub = subscribeToLetters(
      user.uid,
      (items) => {
        setLetters(items);
        setLoading(false);
      },
      (err) => {
        setLoadError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const selectedLetter = useMemo(
    () => letters.find((l) => l.id === selectedLetterId) ?? null,
    [letters, selectedLetterId]
  );

  const stats = useMemo(() => {
    const masuk = letters.filter((l) => l.direction === 'masuk').length;
    const keluar = letters.filter((l) => l.direction === 'keluar').length;
    const pending = letters.filter((l) =>
      ['Terdaftar', 'Diproses', 'Didisposisikan'].includes(l.status)
    ).length;
    return {
      total: letters.length,
      masuk,
      keluar,
      pending,
    };
  }, [letters]);

  const unitCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of letters) {
      map[l.currentUnit] = (map[l.currentUnit] ?? 0) + 1;
    }
    return map;
  }, [letters]);

  const filteredLetters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return letters.filter((l) => {
      if (activeView === 'masuk' && l.direction !== 'masuk') return false;
      if (activeView === 'keluar' && l.direction !== 'keluar') return false;
      if (
        activeView === 'pending' &&
        !['Terdaftar', 'Diproses', 'Didisposisikan'].includes(l.status)
      ) {
        return false;
      }
      if (selectedUnit !== 'ALL' && l.currentUnit !== selectedUnit) {
        return false;
      }
      if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && l.priority !== priorityFilter) {
        return false;
      }
      if (q) {
        const hay = [
          l.trackingCode,
          l.letterNumber,
          l.agendaNumber,
          l.subject,
          l.sender,
          l.recipient,
          l.currentUnit,
          l.assignedToName,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    letters,
    activeView,
    selectedUnit,
    statusFilter,
    priorityFilter,
    searchQuery,
  ]);

  const isAdmin =
    user?.email === 'babelhendri@gmail.com' && Boolean(user?.emailVerified);

  const currentUserName =
    profile?.displayName ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Staf Persuratan';
  const currentUserUnit = profile?.unit || 'Sekretariat Umum';

  const handleFormSubmit = async (
    draft: LetterDraftInput,
    initialNote: string
  ) => {
    if (!user) return;
    if (formModalState.mode === 'create') {
      const created = await createLetterWithInitialEvent({
        uid: user.uid,
        actorName: currentUserName,
        draft,
        existingCount: letters.length,
        initialNote,
      });
      setSelectedLetterId(created.letterId);
    } else if (formModalState.letter) {
      await updateLetterMetadata({
        letterId: formModalState.letter.id,
        draft,
      });
    }
  };

  const handleSeedSamples = async () => {
    if (!user || seeding) return;
    setSeeding(true);
    try {
      await seedSampleCorrespondence(user.uid, currentUserName);
    } finally {
      setSeeding(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Kode Tracking',
      'Jenis',
      'Nomor Surat',
      'Nomor Agenda',
      'Perihal',
      'Pengirim',
      'Penerima',
      'Unit Asal',
      'Unit Saat Ini',
      'PIC',
      'Tanggal Surat',
      'Tanggal Agenda',
      'Prioritas',
      'Klasifikasi',
      'Status',
    ];
    const escapeCell = (val: string) =>
      `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = filteredLetters.map((l) =>
      [
        l.trackingCode,
        l.direction === 'masuk' ? 'Surat Masuk' : 'Surat Keluar',
        l.letterNumber,
        l.agendaNumber,
        l.subject,
        l.sender,
        l.recipient,
        l.originUnit,
        l.currentUnit,
        l.assignedToName,
        l.letterDate,
        l.receivedOrSentDate,
        l.priority,
        l.classification,
        l.status,
      ]
        .map(escapeCell)
        .join(',')
    );

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agenda-persuratan-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const viewTitleMap: Record<NavView, string> = {
    all: 'Semua Surat',
    masuk: 'Surat Masuk',
    keluar: 'Surat Keluar',
    pending: 'Menunggu Tindak Lanjut',
    lookup: 'Lacak Nomor & Resi',
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-[260px]">
      <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
        <span className="text-lg font-bold font-display tracking-tight text-slate-900 whitespace-nowrap">
          TataSurat
        </span>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Tutup menu"
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <p className="px-3 text-xs font-medium text-slate-400 mb-2">
            Agenda & Pelacakan
          </p>
          <nav className="space-y-1">
            {[
              {
                id: 'all' as NavView,
                label: 'Semua Surat',
                count: stats.total,
                icon: FolderArchive,
              },
              {
                id: 'masuk' as NavView,
                label: 'Surat Masuk',
                count: stats.masuk,
                icon: Inbox,
              },
              {
                id: 'keluar' as NavView,
                label: 'Surat Keluar',
                count: stats.keluar,
                icon: Send,
              },
              {
                id: 'pending' as NavView,
                label: 'Tindak Lanjut',
                count: stats.pending,
                icon: Clock,
              },
              {
                id: 'lookup' as NavView,
                label: 'Lacak Nomor Surat',
                count: null,
                icon: Search,
              },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveView(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.count !== null && (
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        isActive ? 'text-blue-700' : 'text-slate-400'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div>
          <p className="px-3 text-xs font-medium text-slate-400 mb-2">
            Posisi Unit Kerja
          </p>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setSelectedUnit('ALL');
                if (activeView === 'lookup') setActiveView('all');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
                selectedUnit === 'ALL'
                  ? 'bg-slate-100 text-slate-900 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="truncate">Semua Unit Kerja</span>
              <span className="font-mono tabular-nums text-slate-400">
                {letters.length}
              </span>
            </button>
            {ORGANIZATIONAL_UNITS.map((unit) => {
              const count = unitCounts[unit] ?? 0;
              const isSelected = selectedUnit === unit;
              return (
                <button
                  key={unit}
                  type="button"
                  onClick={() => {
                    setSelectedUnit(unit);
                    if (activeView === 'lookup') setActiveView('all');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-100 text-slate-900 font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate pr-2">{unit}</span>
                  <span className="font-mono tabular-nums text-slate-400 shrink-0">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {currentUserName}
            </p>
            <p className="text-xs text-slate-500 truncate">{currentUserUnit}</p>
          </div>
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            title="Atur unit petugas"
            aria-label="Atur unit petugas"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={signOutUser}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Keluar Akun
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0 no-print">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          {sidebarContent}
          <div
            className="flex-1 bg-slate-900/30"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka navigasi"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">Persuratan</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-semibold font-display text-slate-900 truncate">
                {viewTitleMap[activeView]}
              </h1>
              {selectedUnit !== 'ALL' && activeView !== 'lookup' && (
                <>
                  <span className="text-slate-300 hidden md:inline">/</span>
                  <span className="text-slate-600 truncate hidden md:inline">
                    {selectedUnit}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeView !== 'lookup' && (
              <div className="relative hidden md:block w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nomor, perihal, atau resi..."
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                setFormModalState({
                  open: true,
                  mode: 'create',
                  direction: activeView === 'keluar' ? 'keluar' : 'masuk',
                  letter: null,
                })
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Catat Surat Baru
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto space-y-6 no-print">
          {/* 4-Column KPI Summary Strip */}
          <section
            aria-label="Ringkasan statistik surat"
            className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
          >
            <div className="p-5">
              <p className="text-xs text-slate-500 mb-1">Total Surat Tercatat</p>
              <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900">
                {stats.total}
              </p>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500">Surat Masuk</p>
                <ArrowDownLeft className="w-4 h-4 text-blue-700" />
              </div>
              <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900">
                {stats.masuk}
              </p>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500">Surat Keluar</p>
                <ArrowUpRight className="w-4 h-4 text-slate-600" />
              </div>
              <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900">
                {stats.keluar}
              </p>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500">Menunggu Tindak Lanjut</p>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900">
                {stats.pending}
              </p>
            </div>
          </section>

          {loadError && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
              Gagal memuat data persuratan: {loadError}
            </div>
          )}

          {activeView === 'lookup' ? (
            <TrackingLookupView
              letters={letters}
              currentUid={user?.uid ?? ''}
              onOpenDetail={(letter) => setSelectedLetterId(letter.id)}
            />
          ) : (
            <>
              {/* Filter Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex p-1 bg-slate-200/70 rounded-lg">
                    {[
                      { id: 'all' as NavView, label: 'Semua' },
                      { id: 'masuk' as NavView, label: 'Surat Masuk' },
                      { id: 'keluar' as NavView, label: 'Surat Keluar' },
                    ].map((tab) => {
                      const active =
                        activeView === tab.id ||
                        (activeView === 'pending' && tab.id === 'all');
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveView(tab.id)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                            active
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <select
                    aria-label="Filter status surat"
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as LetterStatus | 'ALL')
                    }
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                  >
                    <option value="ALL">Semua Status</option>
                    {LETTER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter prioritas surat"
                    value={priorityFilter}
                    onChange={(e) =>
                      setPriorityFilter(
                        e.target.value as LetterPriority | 'ALL'
                      )
                    }
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                  >
                    <option value="ALL">Semua Prioritas</option>
                    {LETTER_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 md:hidden">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari nomor, perihal, atau resi..."
                      className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setFormModalState({
                        open: true,
                        mode: 'create',
                        direction: activeView === 'keluar' ? 'keluar' : 'masuk',
                        letter: null,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Unggah PDF/Word
                  </button>

                  {letters.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setRecapModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Cetak Rekapitulasi
                    </button>
                  )}

                  {filteredLetters.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Unduh CSV
                    </button>
                  )}
                </div>
              </div>

              {/* Correspondence Data Grid */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {loading ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="h-11 bg-slate-100 rounded-lg animate-pulse"
                      />
                    ))}
                  </div>
                ) : filteredLetters.length === 0 ? (
                  <div className="py-16 px-6 text-center max-w-md mx-auto">
                    <FilePlus2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <h2 className="text-base font-semibold font-display text-slate-900 mb-1">
                      {letters.length === 0
                        ? 'Belum ada surat tercatat'
                        : 'Tidak ada surat yang cocok dengan filter'}
                    </h2>
                    <p className="text-sm text-slate-500 mb-6">
                      {letters.length === 0
                        ? 'Daftarkan surat masuk atau surat keluar pertama Anda untuk mulai melacak alur disposisi secara real-time.'
                        : 'Coba ubah kata kunci pencarian atau reset filter unit dan status.'}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {letters.length === 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setFormModalState({
                                open: true,
                                mode: 'create',
                                direction: 'masuk',
                                letter: null,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            Catat Surat Pertama
                          </button>
                          <button
                            type="button"
                            onClick={handleSeedSamples}
                            disabled={seeding}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            {seeding
                              ? 'Memuat Contoh...'
                              : 'Muat 6 Data Contoh'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveView('all');
                            setSelectedUnit('ALL');
                            setStatusFilter('ALL');
                            setPriorityFilter('ALL');
                            setSearchQuery('');
                          }}
                          className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Reset Semua Filter
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                          <th className="py-3 px-4 whitespace-nowrap">
                            Kode & Nomor Surat
                          </th>
                          <th className="py-3 px-4">Perihal & Pihak Terkait</th>
                          <th className="py-3 px-4 whitespace-nowrap">
                            Posisi Unit
                          </th>
                          <th className="py-3 px-4 whitespace-nowrap">
                            Tanggal
                          </th>
                          <th className="py-3 px-4 whitespace-nowrap">
                            Prioritas
                          </th>
                          <th className="py-3 px-4 whitespace-nowrap">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {filteredLetters.map((letter) => (
                          <tr
                            key={letter.id}
                            onClick={() => setSelectedLetterId(letter.id)}
                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                              selectedLetterId === letter.id
                                ? 'bg-blue-50/50'
                                : ''
                            }`}
                          >
                            <td className="py-3 px-4 align-top whitespace-nowrap">
                              <div className="font-mono tabular-nums text-xs font-medium text-slate-900">
                                {letter.trackingCode}
                              </div>
                              <div className="font-mono tabular-nums text-xs text-slate-500 mt-0.5">
                                {letter.letterNumber}
                              </div>
                            </td>
                            <td className="py-3 px-4 align-top max-w-md">
                              <div className="flex items-center gap-2 mb-0.5">
                                <DirectionLabel direction={letter.direction} />
                                <span
                                  className="text-slate-300 text-xs"
                                  aria-hidden="true"
                                >
                                  ·
                                </span>
                                <span className="text-xs text-slate-500">
                                  {letter.classification}
                                </span>
                                {letter.uploadedFileName && (
                                  <>
                                    <span
                                      className="text-slate-300 text-xs"
                                      aria-hidden="true"
                                    >
                                      ·
                                    </span>
                                    <span
                                      title={letter.uploadedFileName}
                                      className="inline-flex items-center gap-1 text-xs text-slate-500"
                                    >
                                      <FileText className="w-3 h-3 text-blue-700" />
                                      Berkas
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="font-medium text-slate-900 line-clamp-1">
                                {letter.subject}
                              </div>
                              <div className="text-xs text-slate-500 truncate mt-0.5">
                                {letter.sender} → {letter.recipient}
                              </div>
                            </td>
                            <td className="py-3 px-4 align-top whitespace-nowrap">
                              <div className="text-xs font-medium text-slate-900">
                                {letter.currentUnit}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {letter.assignedToName || 'Belum ditugaskan'}
                              </div>
                            </td>
                            <td className="py-3 px-4 align-top whitespace-nowrap font-mono tabular-nums text-xs text-slate-600">
                              {formatIndonesianDate(letter.receivedOrSentDate)}
                            </td>
                            <td className="py-3 px-4 align-top whitespace-nowrap">
                              <PriorityLabel priority={letter.priority} />
                            </td>
                            <td className="py-3 px-4 align-top whitespace-nowrap">
                              <StatusLabel status={letter.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Real-Time Detail & Tracking Drawer */}
      {selectedLetter && user && (
        <LetterDetailDrawer
          letter={selectedLetter}
          currentUid={user.uid}
          currentUserName={currentUserName}
          isAdmin={isAdmin}
          onClose={() => setSelectedLetterId(null)}
          onEditClick={(ltr) =>
            setFormModalState({
              open: true,
              mode: 'edit',
              direction: ltr.direction,
              letter: ltr,
            })
          }
        />
      )}

      {/* Create / Edit Modal */}
      {formModalState.open && (
        <LetterFormModal
          mode={formModalState.mode}
          initialDirection={formModalState.direction}
          existingLetter={formModalState.letter}
          existingCount={letters.length}
          defaultUnit={currentUserUnit}
          defaultUserName={currentUserName}
          onClose={() =>
            setFormModalState((prev) => ({ ...prev, open: false }))
          }
          onSubmit={handleFormSubmit}
        />
      )}

      {/* Staff Profile Settings Modal */}
      {profileModalOpen && (
        <ProfileSettingsModal onClose={() => setProfileModalOpen(false)} />
      )}

      {/* Recapitulation Report Print & Export Modal */}
      {recapModalOpen && (
        <RekapitulasiReportModal
          allLetters={letters}
          initialFilteredLetters={filteredLetters}
          activeScopeLabel={`${viewTitleMap[activeView]}${
            selectedUnit !== 'ALL' ? ` · ${selectedUnit}` : ''
          }`}
          preparedByName={currentUserName}
          preparedByUnit={currentUserUnit}
          onClose={() => setRecapModalOpen(false)}
        />
      )}
    </div>
  );
}
