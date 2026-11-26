import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
} from "react-router-dom";
import { useState } from "react";
import sesi, { hasRole } from "./sesi";
import usePenggunaAktif from "./hooks/usePenggunaAktif";
import logo from "./assets/logo.jpeg";
import { Toaster } from "react-hot-toast";
import RouteLoadingBar from "./components/common/RouteLoadingBar";
import {
  LayoutDashboard,
  Crown,
  UserCog,
  ClipboardList,
  BookOpenCheck,
  GraduationCap,
  FolderKanban,
  Tent,
  Wrench,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  FolderOpen,
  Users,
  BookOpen,
  FileText,
  Megaphone,
  Archive,
  LibraryBig,
  Clock,
  Flag,
  MapPin,
  TrendingUp,
  BadgeCheck,
  Briefcase,
  Award,
  LogOut,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

// --- Dashboard ---
import Dashboard from "./pages/dashboard/Dashboard";
import DetailPengumuman from "./pages/dashboard/DetailPengumuman";

// --- Profile ---
import ProfilePage from "./pages/profile/ProfilePage";

// --- Tata Usaha ---
import KelasPage from "./pages/tata-usaha/kelas/KelasPage";
import TahunAjaranPage from "./pages/tata-usaha/tahun-ajaran/TahunAjaranPage";
import SiswaPage from "./pages/tata-usaha/siswa/SiswaPage";
import PengumumanPage from "./pages/tata-usaha/pengumuman/PengumumanPage";
import ArsipSuratPage from "./pages/tata-usaha/arsip-surat/ArsipSuratPage";
import MapelPage from "./pages/tata-usaha/mapel/MapelPage";
import JadwalPage from "./pages/tata-usaha/jadwal/JadwalPage";
import PiketPage from "./pages/tata-usaha/piket/PiketPage";
import UpacaraPage from "./pages/tata-usaha/upacara/UpacaraPage";

// --- Guru Mapel ---
import AbsensiGuruPage from "./pages/guru-mapel/AbsensiGuruPage";
import AbsensiSiswa from "./pages/guru-mapel/absensi-siswa/AbsensiSiswa";
import PerangkatPage from "./pages/guru-mapel/perangkat/PerangkatPage";
import InputNilaiPage from "./pages/guru-mapel/InputNilaiPage";

// --- Wali Kelas ---
import PresensiKelasPage from "./pages/wali-kelas/PresensiKelasPage";
import RekapNilaiWaliKelas from "./pages/wali-kelas/RekapNilaiPage";
import ParentingPage from "./pages/wali-kelas/ParentingPage";
import KebersihanKelasPage from "./pages/wali-kelas/KebersihanKelasPage";
import RefleksiPage from "./pages/wali-kelas/RefleksiPage";

// --- Pramuka ---
import AbsensiPramukaPage from "./pages/pramuka/absensi/AbsensiPramukaPage";
import GuruPage from "./pages/tata-usaha/guru/GuruPage";
import SilabusKegiatanPage from "./pages/pramuka/SilabusKegiatanPage";
import LaporanKegiatanPage from "./pages/pramuka/LaporanKegiatanPage";

// --- Vokasi ---
import LokasiPKLPage from "./pages/vokasi/LokasiPKLPage";
import ProgresPKLPage from "./pages/vokasi/ProgresPKLPage";
import NilaiPKLPage from "./pages/vokasi/NilaiPKLPage";
import SoalUKKPage from "./pages/vokasi/SoalUKKPage";
import ProgresUKKPage from "./pages/vokasi/ProgresUKKPage";
import NilaiUKKPage from "./pages/vokasi/NilaiUKKPage";
import SertifikatUKKPage from "./pages/vokasi/SertifikatUKKPage";

// --- Kepala Sekolah ---
import RekapAbsensiGuruPage from "./pages/kepala-sekolah/RekapAbsensiGuruPage";
import RekapAbsensiSiswaPage from "./pages/kepala-sekolah/RekapAbsensiSiswaPage";
import PemeriksaanPerangkatPage from "./pages/kepala-sekolah/PemeriksaanPerangkatPage";
import EvaluasiKinerjaPage from "./pages/kepala-sekolah/EvaluasiKinerjaPage";
import PKLKepsekPage from "./pages/kepala-sekolah/PKLKepsekPage";
import UKKKepsekPage from "./pages/kepala-sekolah/UKKKepsekPage";
import RekapNilaiFinalPage from "./pages/kepala-sekolah/RekapNilaiFinalPage";

// --- Waka Sekolah ---
import KurikulumPage from "./pages/waka-sekolah/KurikulumPage";

// --- Wakil Kepala Sekolah (Wakakur) ---
import WakakurJadwalPage from "./pages/wakil-kepala-sekolah/WakakurJadwalPage";
import WakakurAbsensiGuruPage from "./pages/wakil-kepala-sekolah/WakakurAbsensiGuruPage";
import WakakurPerangkatPage from "./pages/wakil-kepala-sekolah/WakakurPerangkatPage";
import WakakurParentingPage from "./pages/wakil-kepala-sekolah/WakakurParentingPage";

/* ─── NavDropdown ─────────────────────────────────────── */
const NavDropdown = ({ title, icon, children, isOpen, onClick }) => (
  <div className="smk-nav-group">
    <button
      onClick={onClick}
      className={`smk-nav-parent ${isOpen ? "smk-nav-parent--open" : ""}`}
    >
      <span
        className={`smk-nav-icon-wrap ${isOpen ? "smk-nav-icon-wrap--open" : ""}`}
      >
        {icon}
      </span>
      <span className="smk-nav-label">{title}</span>
      <ChevronRight
        className={`smk-nav-chevron ${isOpen ? "smk-nav-chevron--open" : ""}`}
        size={14}
      />
    </button>

    {isOpen && <div className="smk-nav-children">{children}</div>}
  </div>
);

/* ─── NavSubDropdown ──────────────────────────────────── */
const NavSubDropdown = ({ title, icon, children, isOpen, onClick }) => (
  <div>
    <button
      type="button"
      onClick={onClick}
      className={`smk-nav-subparent ${isOpen ? "smk-nav-subparent--open" : ""}`}
    >
      {icon}
      <span className="smk-nav-label">{title}</span>
      <ChevronRight
        className={`smk-nav-chevron ${isOpen ? "smk-nav-chevron--open" : ""}`}
        size={13}
      />
    </button>

    {isOpen && <div className="smk-nav-grandchildren">{children}</div>}
  </div>
);

/* ─── App ─────────────────────────────────────────────── */
const App = () => {
  const [openMenus, setOpenMenus] = useState({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { nama, labelPeran, fotoUrl } = usePenggunaAktif();

  const toggleMenu = (menuName) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuName]: !prev[menuName],
    }));
  };

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          style: {
            padding: "16px 24px",
            fontSize: "14px",
            maxWidth: "560px",
            fontWeight: "600",
            borderRadius: "10px",
            color: "#0f2236",
            background: "#ffffff",
            border: "1px solid #dde6ef",
            boxShadow: "0 8px 32px rgba(27,89,140,0.12)",
          },
          success: { duration: 3000 },
          error: { duration: 4000 },
        }}
      />

      <div className="smk-shell">
        {/* ═══ SIDEBAR ════════════════════════════════════════ */}
        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div
            className="smk-sidebar-overlay lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* ═══ SIDEBAR ════════════════════════════════════════ */}
        <aside
          id="smk-sidebar"
          className={`smk-sidebar ${mobileMenuOpen ? "open" : ""} ${!isSidebarOpen ? "smk-sidebar--collapsed" : ""}`}
        >
          {/* Brand */}
          <div className="smk-brand">
            <div className="smk-brand-logo">
              <img
                src={logo}
                alt="Logo SMKN 1 Sigumpar"
                className="w-full h-full rounded-lg object-cover"
              />
            </div>
            <div className="smk-brand-text">
              <span className="smk-brand-name">SMK N1 Sigumpar</span>
              <span className="smk-brand-sub">Sistem Akademik</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="smk-nav">
            <p className="smk-nav-section-label">Menu Utama</p>

            <NavLink to="/" end className={navClass}>
              {({ isActive }) => (
                <>
                  <span
                    className={`smk-nav-icon-wrap ${isActive ? "smk-nav-icon-wrap--open" : ""}`}
                  >
                    <LayoutDashboard size={15} />
                  </span>
                  <span className="smk-nav-label">Dashboard</span>
                </>
              )}
            </NavLink>

            <p
              className="smk-nav-section-label"
              style={{ marginTop: "1.5rem" }}
            >
              Manajemen
            </p>

            {hasRole("kepala-sekolah") && (
              <NavDropdown
                title="Kepala Sekolah"
                icon={<Crown size={15} />}
                isOpen={openMenus["kepsek"]}
                onClick={() => toggleMenu("kepsek")}
              >
                <NavLink to="/kepsek/absensi-guru" className={subNavClass}>
                  <ClipboardCheck size={13} />
                  <span>Rekap Absensi Guru</span>
                </NavLink>
                <NavLink to="/kepsek/absensi-siswa" className={subNavClass}>
                  <Users size={13} />
                  <span>Rekap Absensi Siswa</span>
                </NavLink>
                <NavLink to="/kepsek/perangkat-ajar" className={subNavClass}>
                  <FolderOpen size={13} />
                  <span>Pemeriksaan Perangkat</span>
                </NavLink>
                <NavLink to="/kepsek/evaluasi-kinerja" className={subNavClass}>
                  <BadgeCheck size={13} />
                  <span>Evaluasi Kinerja Guru</span>
                </NavLink>
                <NavLink to="/kepsek/pkl" className={subNavClass}>
                  <MapPin size={13} />
                  <span>PKL</span>
                </NavLink>
                <NavLink to="/kepsek/ukk" className={subNavClass}>
                  <Award size={13} />
                  <span>UKK</span>
                </NavLink>
                <NavLink to="/kepsek/rekap-nilai-final" className={subNavClass}>
                  <GraduationCap size={13} />
                  <span>Rekap Nilai Final</span>
                </NavLink>
              </NavDropdown>
            )}

            {hasRole("waka-sekolah") && (
              <NavDropdown
                title="Waka Sekolah"
                icon={<UserCog size={15} />}
                isOpen={openMenus["waka"]}
                onClick={() => toggleMenu("waka")}
              >
                <NavLink to="/waka/kurikulum" className={subNavClass}>
                  <BookOpen size={13} />
                  <span>Kurikulum</span>
                </NavLink>
                <NavLink to="/waka/jadwal" className={subNavClass}>
                  <CalendarDays size={13} />
                  <span>Monitoring Jadwal</span>
                </NavLink>
                <NavLink to="/waka/absensi-guru" className={subNavClass}>
                  <ClipboardCheck size={13} />
                  <span>Monitoring Absensi Guru</span>
                </NavLink>
                <NavLink to="/waka/perangkat" className={subNavClass}>
                  <FolderKanban size={13} />
                  <span>Monitoring Perangkat</span>
                </NavLink>
                <NavLink to="/waka/parenting" className={subNavClass}>
                  <Users size={13} />
                  <span>Monitoring Parenting</span>
                </NavLink>
              </NavDropdown>
            )}

            {hasRole("guru-mapel") && (
              <NavDropdown
                title="Guru Mapel"
                icon={<ClipboardList size={15} />}
                isOpen={openMenus["guru"]}
                onClick={() => toggleMenu("guru")}
              >
                <NavLink to="/input-nilai" className={subNavClass}>
                  <GraduationCap size={13} />
                  <span>Input Nilai</span>
                </NavLink>
                <NavLink to="/absensi-siswa" className={subNavClass}>
                  <ClipboardCheck size={13} />
                  <span>Absensi Siswa</span>
                </NavLink>
                <NavLink to="/absensi-guru" className={subNavClass}>
                  <Clock size={13} />
                  <span>Absensi Guru</span>
                </NavLink>
                <NavLink to="/perangkat-pembelajaran" className={subNavClass}>
                  <FolderOpen size={13} />
                  <span>RPP / Perangkat</span>
                </NavLink>
              </NavDropdown>
            )}

            {hasRole("wali-kelas") && (
              <NavDropdown
                title="Wali Kelas"
                icon={<BookOpenCheck size={15} />}
                isOpen={openMenus["walas"]}
                onClick={() => toggleMenu("walas")}
              >
                <NavLink to="/wali/absensi-siswa" className={subNavClass}>
                  <ClipboardCheck size={13} />
                  <span>Presensi &amp; Rekap Kehadiran</span>
                </NavLink>
                <NavLink to="/wali/rekap-nilai" className={subNavClass}>
                  <GraduationCap size={13} />
                  <span>Rekap Nilai</span>
                </NavLink>
                <NavLink to="/wali/parenting" className={subNavClass}>
                  <Users size={13} />
                  <span>Parenting</span>
                </NavLink>
                <NavLink to="/wali/kebersihan-kelas" className={subNavClass}>
                  <BookOpenCheck size={13} />
                  <span>Kebersihan Kelas</span>
                </NavLink>
                <NavLink to="/wali/refleksi" className={subNavClass}>
                  <FileText size={13} />
                  <span>Refleksi</span>
                </NavLink>
              </NavDropdown>
            )}

            {hasRole("tata-usaha") && (
              <NavDropdown
                title="Tata Usaha"
                icon={<FolderKanban size={15} />}
                isOpen={openMenus["tu"]}
                onClick={() => toggleMenu("tu")}
              >
                <NavLink to="/academic/tahun-ajaran" className={subNavClass}>
                  <CalendarRange size={13} />
                  <span>Tahun Ajaran</span>
                </NavLink>
                <NavLink to="/academic/kelas" className={subNavClass}>
                  <BookOpen size={13} />
                  <span>Data Kelas</span>
                </NavLink>
                <NavLink to="/academic/siswa" className={subNavClass}>
                  <Users size={13} />
                  <span>Data Siswa</span>
                </NavLink>
                <NavLink to="/academic/guru" className={subNavClass}>
                  <Users size={13} />
                  <span>Data Guru</span>
                </NavLink>
                <NavLink to="/academic/pengumuman" className={subNavClass}>
                  <Megaphone size={13} />
                  <span>Pengumuman</span>
                </NavLink>
                <NavLink to="/academic/arsip-surat" className={subNavClass}>
                  <Archive size={13} />
                  <span>Arsip Surat</span>
                </NavLink>
                <NavLink to="/academic/mapel" className={subNavClass}>
                  <LibraryBig size={13} />
                  <span>Mata Pelajaran</span>
                </NavLink>
                <NavLink to="/academic/jadwal" className={subNavClass}>
                  <CalendarDays size={13} />
                  <span>Jadwal Mengajar</span>
                </NavLink>
                <NavLink to="/academic/piket" className={subNavClass}>
                  <Clock size={13} />
                  <span>Jadwal Piket</span>
                </NavLink>
                <NavLink to="/academic/upacara" className={subNavClass}>
                  <Flag size={13} />
                  <span>Jadwal Upacara</span>
                </NavLink>
              </NavDropdown>
            )}

            {hasRole("pramuka") && (
              <NavDropdown
                title="Pramuka"
                icon={<Tent size={15} />}
                isOpen={openMenus["pramuka"]}
                onClick={() => toggleMenu("pramuka")}
              >
                <NavLink to="/vocational/absensi" className={subNavClass}>
                  <ClipboardCheck size={13} />
                  <span>Absensi Pramuka</span>
                </NavLink>
                <NavLink to="/pramuka/silabus" className={subNavClass}>
                  <BookOpen size={13} />
                  <span>Silabus & Kegiatan</span>
                </NavLink>
                <NavLink to="/pramuka/laporan" className={subNavClass}>
                  <FileText size={13} />
                  <span>Laporan Kegiatan</span>
                </NavLink>
              </NavDropdown>
            )}

            {hasRole("vokasi") && (
              <NavDropdown
                title="Vokasi"
                icon={<Wrench size={15} />}
                isOpen={openMenus["vokasi"]}
                onClick={() => toggleMenu("vokasi")}
              >
                <NavSubDropdown
                  title="PKL"
                  icon={<Briefcase size={13} />}
                  isOpen={openMenus["pkl"]}
                  onClick={() => toggleMenu("pkl")}
                >
                  <NavLink to="/vokasi/lokasi-pkl" className={subNavClass}>
                    <MapPin size={13} />
                    <span>Pelaporan Lokasi PKL</span>
                  </NavLink>
                  <NavLink to="/vokasi/progres-pkl" className={subNavClass}>
                    <TrendingUp size={13} />
                    <span>Pelaporan Progres PKL</span>
                  </NavLink>
                  <NavLink to="/vokasi/nilai-pkl" className={subNavClass}>
                    <BadgeCheck size={13} />
                    <span>Input Nilai PKL</span>
                  </NavLink>
                </NavSubDropdown>

                <NavSubDropdown
                  title="UKK"
                  icon={<Award size={13} />}
                  isOpen={openMenus["ukk"]}
                  onClick={() => toggleMenu("ukk")}
                >
                  <NavLink to="/vokasi/soal-ukk" className={subNavClass}>
                    <BookOpen size={13} />
                    <span>Bank Soal UKK</span>
                  </NavLink>
                  <NavLink to="/vokasi/progres-ukk" className={subNavClass}>
                    <TrendingUp size={13} />
                    <span>Progres UKK</span>
                  </NavLink>
                  <NavLink to="/vokasi/nilai-ukk" className={subNavClass}>
                    <BadgeCheck size={13} />
                    <span>Nilai UKK</span>
                  </NavLink>
                  <NavLink to="/vokasi/sertifikat-ukk" className={subNavClass}>
                    <Award size={13} />
                    <span>Sertifikat UKK</span>
                  </NavLink>
                </NavSubDropdown>
              </NavDropdown>
            )}
          </nav>

          {/* User Footer */}
          <div className="smk-user-footer">
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `smk-user-profile ${isActive ? "smk-user-profile--active" : ""}`
              }
              title={`${labelPeran || "Pengguna"} - ${nama || "-"}`}
            >
              <div className="smk-user-avatar">
                {fotoUrl ? (
                  <img src={fotoUrl} alt="" className="smk-user-avatar-img" />
                ) : (
                  (nama || "U").charAt(0).toUpperCase()
                )}
              </div>
              <div className="smk-user-info">
                <span className="smk-user-role">Logged in as</span>
                <span className="smk-user-position">
                  {labelPeran || "Pengguna"}
                </span>
                <span className="smk-user-name">{nama || "-"}</span>
              </div>
            </NavLink>
            <button
              onClick={() => sesi.logout()}
              className="smk-logout-btn"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </aside>

        {/* ═══ MAIN CONTENT ══════════════════════════════════ */}
        <main className="smk-main">
          <RouteLoadingBar />
          {/* Mobile Header */}
          <div className="smk-mobile-header lg:hidden flex items-center justify-between p-4 mb-4 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1b598c] rounded-xl flex items-center justify-center text-white">
                <img
                  src={logo}
                  alt="Logo SMKN 1 Sigumpar"
                  className="w-full h-full rounded-xl object-cover"
                />
              </div>
              <div>
                <h1 className="font-bold text-gray-800 text-sm">
                  SMK N1 Sigumpar
                </h1>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Sistem Akademik
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsSidebarOpen((open) => !open);
                setMobileMenuOpen((open) => !open);
              }}
              className="smk-sidebar-toggle"
              aria-controls="smk-sidebar"
              aria-expanded={isSidebarOpen}
              aria-label={isSidebarOpen ? "Tutup sidebar" : "Buka sidebar"}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          <div className="smk-main-toolbar">
            <button
              type="button"
              className="smk-sidebar-toggle"
              onClick={() => setIsSidebarOpen((open) => !open)}
              aria-controls="smk-sidebar"
              aria-expanded={isSidebarOpen}
              aria-label={isSidebarOpen ? "Tutup sidebar" : "Buka sidebar"}
              title={isSidebarOpen ? "Tutup sidebar" : "Buka sidebar"}
            >
              <Menu size={22} aria-hidden="true" />
            </button>
          </div>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pengumuman/:id" element={<DetailPengumuman />} />
            <Route path="/profile" element={<ProfilePage />} />

            {/* Tata Usaha */}
            <Route path="/academic/kelas" element={<KelasPage />} />
            <Route
              path="/academic/tahun-ajaran"
              element={<TahunAjaranPage />}
            />
            <Route path="/academic/siswa" element={<SiswaPage />} />
            <Route path="/academic/guru" element={<GuruPage />} />
            <Route path="/academic/pengumuman" element={<PengumumanPage />} />
            <Route path="/academic/arsip-surat" element={<ArsipSuratPage />} />
            <Route path="/academic/mapel" element={<MapelPage />} />
            <Route path="/academic/jadwal" element={<JadwalPage />} />
            <Route path="/academic/piket" element={<PiketPage />} />
            <Route path="/academic/upacara" element={<UpacaraPage />} />

            {/* Guru Mapel */}
            <Route path="/input-nilai" element={<InputNilaiPage />} />
            <Route path="/absensi-siswa" element={<AbsensiSiswa />} />
            <Route path="/absensi-guru" element={<AbsensiGuruPage />} />
            <Route path="/perangkat-pembelajaran" element={<PerangkatPage />} />

            {/* Wali Kelas */}
            <Route path="/wali/absensi-siswa" element={<PresensiKelasPage />} />
            <Route path="/wali/rekap-nilai" element={<RekapNilaiWaliKelas />} />
            <Route path="/wali/parenting" element={<ParentingPage />} />
            <Route
              path="/wali/kebersihan-kelas"
              element={<KebersihanKelasPage />}
            />
            <Route path="/wali/refleksi" element={<RefleksiPage />} />

            {/* Pramuka */}
            <Route
              path="/vocational/absensi"
              element={<AbsensiPramukaPage />}
            />
            <Route path="/pramuka/silabus" element={<SilabusKegiatanPage />} />
            <Route path="/pramuka/laporan" element={<LaporanKegiatanPage />} />

            {/* Vokasi */}
            <Route path="/vokasi/lokasi-pkl" element={<LokasiPKLPage />} />
            <Route path="/vokasi/progres-pkl" element={<ProgresPKLPage />} />
            <Route path="/vokasi/nilai-pkl" element={<NilaiPKLPage />} />
            <Route path="/vokasi/soal-ukk" element={<SoalUKKPage />} />
            <Route path="/vokasi/progres-ukk" element={<ProgresUKKPage />} />
            <Route path="/vokasi/nilai-ukk" element={<NilaiUKKPage />} />
            <Route
              path="/vokasi/sertifikat-ukk"
              element={<SertifikatUKKPage />}
            />

            {/* Kepala Sekolah */}
            <Route
              path="/kepsek/absensi-guru"
              element={<RekapAbsensiGuruPage />}
            />
            <Route
              path="/kepsek/absensi-siswa"
              element={<RekapAbsensiSiswaPage />}
            />
            <Route
              path="/kepsek/perangkat-ajar"
              element={<PemeriksaanPerangkatPage />}
            />
            <Route
              path="/kepsek/evaluasi-kinerja"
              element={<EvaluasiKinerjaPage />}
            />
            <Route path="/kepsek/pkl" element={<PKLKepsekPage />} />
            <Route path="/kepsek/ukk" element={<UKKKepsekPage />} />
            <Route
              path="/kepsek/rekap-nilai-final"
              element={<RekapNilaiFinalPage />}
            />

            {/* Waka Sekolah */}
            <Route path="/waka/kurikulum" element={<KurikulumPage />} />
            <Route path="/waka/jadwal" element={<WakakurJadwalPage />} />
            <Route
              path="/waka/absensi-guru"
              element={<WakakurAbsensiGuruPage />}
            />
            <Route path="/waka/perangkat" element={<WakakurPerangkatPage />} />
            <Route path="/waka/parenting" element={<WakakurParentingPage />} />

            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

/* ─── Nav class helpers ──────────────────────────────── */
const navClass = ({ isActive }) =>
  `smk-nav-item ${isActive ? "smk-nav-item--active" : ""}`;

const subNavClass = ({ isActive }) =>
  `smk-nav-sub ${isActive ? "smk-nav-sub--active" : ""}`;

export default App;
