import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText, CheckCircle2, AlertTriangle, TrendingUp, Anchor, User,
  Thermometer, Activity, DollarSign, Search, ArrowUpRight, Check, X,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw,
  Sun, Moon, UploadCloud, BarChart3, HelpCircle, HardDrive, ShieldCheck, LogOut
} from 'lucide-react';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import Login from './components/Login';


const ROLES = {
  COOP_MANAGER: { name: 'Cooperative Manager', description: 'Complete oversight, financial auditing, and sales releases.' },
  FISH_FARMER: { name: 'Fish Farmer', description: 'Monitor daily water logs, stocking density, and feed parameters.' },
  VESSEL_OPERATOR: { name: 'Vessel Operator', description: 'Oversee harvesting counts, single-trip quota limits, and landing logs.' },
  HATCHERY_STAFF: { name: 'Hatchery Staff', description: 'Track broodstock genetics, stocking certificates, and initial fry counts.' },
  QUALITY_INSPECTOR: { name: 'Quality Inspector', description: 'Manage freshness indicators, organoleptic indices, and grading certificates.' },
  PROCESSOR: { name: 'Processor', description: 'Monitor fillet yields, cold room temperatures, and sanitation logs.' }
};

const DOCUMENT_TYPES = {
  STOCKING: 'Stocking Certificate',
  FEEDING: 'Feeding Log Sheet',
  WATER_QUALITY: 'Water Quality Log',
  HARVEST_LANDING: 'Landing Declaration',
  GRADING: 'Grading Certificate',
  COLD_STORAGE: 'Cold Storage Log',
  PROCESSING: 'Processing Batch Sheet',
  SALES: 'Sales Invoice'
};

const ROLE_DOC_MAPPING = {
  'Cooperative Manager': Object.values(DOCUMENT_TYPES),
  'Fish Farmer': [DOCUMENT_TYPES.WATER_QUALITY, DOCUMENT_TYPES.FEEDING, DOCUMENT_TYPES.STOCKING],
  'Vessel Operator': [DOCUMENT_TYPES.HARVEST_LANDING],
  'Hatchery Staff': [DOCUMENT_TYPES.STOCKING],
  'Quality Inspector': [DOCUMENT_TYPES.GRADING],
  'Processor': [DOCUMENT_TYPES.COLD_STORAGE, DOCUMENT_TYPES.PROCESSING]
};

// Preset options for Simulated Intake
const SIMULATED_UPLOADS = [
  { id: 'temp-wq-001', name: 'Water Quality - RAS Tank 3 (Normal)', type: DOCUMENT_TYPES.WATER_QUALITY },
  { id: 'temp-wq-002', name: 'Water Quality - Pen 1 (CRITICAL BREACH)', type: DOCUMENT_TYPES.WATER_QUALITY },
  { id: 'temp-feed-001', name: 'Feeding Log - Pen 6B (Normal)', type: DOCUMENT_TYPES.FEEDING },
  { id: 'temp-feed-002', name: 'Feeding Log - Pen 12A (Abnormal FCR & Mortality)', type: DOCUMENT_TYPES.FEEDING },
  { id: 'temp-stock-001', name: 'Stocking Cert - Atlantic Salmon (Normal)', type: DOCUMENT_TYPES.STOCKING },
  { id: 'temp-stock-002', name: 'Stocking Cert - South Delta (High Mortality)', type: DOCUMENT_TYPES.STOCKING },
  { id: 'temp-land-001', name: 'Landing Dec - Nordic Star (Normal)', type: DOCUMENT_TYPES.HARVEST_LANDING },
  { id: 'temp-land-002', name: 'Landing Dec - Sea Spray (Over-quota / Protected Zone)', type: DOCUMENT_TYPES.HARVEST_LANDING },
  { id: 'temp-grade-001', name: 'Grading Cert - Lot 88921 (Normal)', type: DOCUMENT_TYPES.GRADING },
  { id: 'temp-grade-002', name: 'Grading Cert - Lot 88922 (Decay & sea lice scars)', type: DOCUMENT_TYPES.GRADING },
  { id: 'temp-cold-001', name: 'Cold Storage - Room C1 (Normal)', type: DOCUMENT_TYPES.COLD_STORAGE },
  { id: 'temp-cold-002', name: 'Cold Storage - Trailer 14 (Temp breach & power failure)', type: DOCUMENT_TYPES.COLD_STORAGE },
  { id: 'temp-proc-001', name: 'Processing Yield - Filleting (Normal)', type: DOCUMENT_TYPES.PROCESSING },
  { id: 'temp-proc-002', name: 'Processing Yield - Filleting (Incomplete Sanitation & low yield)', type: DOCUMENT_TYPES.PROCESSING },
  { id: 'temp-sales-001', name: 'Sales Invoice - INV-9088 (Normal)', type: DOCUMENT_TYPES.SALES },
  { id: 'temp-sales-002', name: 'Sales Invoice - INV-9089 (Missing Health Cert)', type: DOCUMENT_TYPES.SALES }
];

let RAW_API_URL = import.meta.env.VITE_API_BASE_URL || 'https://fishintelli-hub.onrender.com/api';
RAW_API_URL = RAW_API_URL.replace(/\/+$/, '');
if (!RAW_API_URL.endsWith('/api')) {
  RAW_API_URL += '/api';
}
const API_BASE_URL = RAW_API_URL;

export default function App() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [authUser, setAuthUser] = useState(JSON.parse(localStorage.getItem('user')) || null);

  const [documents, setDocuments] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [activeRole, setActiveRole] = useState(authUser?.role || 'Cooperative Manager');
  const [activeTab, setActiveTab] = useState('intake');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // UI state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(SIMULATED_UPLOADS[0].id);
  const [uploaderName, setUploaderName] = useState('Inspector Yuki Tanaka');
  const [customFileName, setCustomFileName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingFileName, setAnalyzingFileName] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Connectivity & Loading state
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [apiError, setApiError] = useState(null);

  // Setup Axios Interceptor for Auth
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(config => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    const resInterceptor = axios.interceptors.response.use(
      res => res,
      err => {
        if (err.response && err.response.status === 401) {
          handleLogout();
        }
        return Promise.reject(err);
      }
    );

    return () => {
      axios.interceptors.request.eject(interceptor);
      axios.interceptors.response.eject(resInterceptor);
    };
  }, [token]);

  // Initial load with auto retry
  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  // Update theme class on document HTML
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleLoginSuccess = (newToken, user) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(user));
    setToken(newToken);
    setAuthUser(user);
    setActiveRole(user.role);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setAuthUser(null);
  };

  const fetchData = async (isRetry = false) => {
    setIsLoadingData(true);
    setApiError(null);
    try {
      const docsRes = await axios.get(`${API_BASE_URL}/documents`, { timeout: 15000 });
      const analyticsRes = await axios.get(`${API_BASE_URL}/analytics`, { timeout: 15000 });
      setDocuments(docsRes.data || []);
      setAnalytics(analyticsRes.data || null);
      setIsLoadingData(false);
    } catch (err) {
      console.error("Error fetching data from backend API:", err);
      setApiError(`Could not connect to backend at ${API_BASE_URL}. If deploying on Render free tier, the server may take ~20 seconds to wake up.`);
      setIsLoadingData(false);

      // Auto-retry once after 4 seconds if initial load fails (handles Render cold start)
      if (!isRetry) {
        setTimeout(() => fetchData(true), 4000);
      }
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    setSelectedDoc(null);
    try {
      await axios.post(`${API_BASE_URL}/documents/reset`);
      await fetchData();
    } catch (err) {
      console.error("Error resetting database:", err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleSimulatedUpload = async (e) => {
    e.preventDefault();
    const tpl = SIMULATED_UPLOADS.find(t => t.id === selectedTemplateId);
    if (!tpl) return;

    setShowUploadModal(false);
    setIsAnalyzing(true);
    setAnalyzingFileName(customFileName || tpl.name + '.pdf');

    try {
      await axios.post(`${API_BASE_URL}/documents/upload`, {
        templateId: selectedTemplateId,
        uploader: uploaderName,
        customName: customFileName || undefined
      });
      await fetchData();
    } catch (err) {
      console.error("Error uploading document:", err);
    } finally {
      setIsAnalyzing(false);
      setCustomFileName('');
    }
  };

  const handleDecision = async (action) => {
    if (!selectedDoc) return;
    setActionLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/documents/${selectedDoc.id}/action`, {
        action,
        reviewerNotes,
        userRole: activeRole
      });
      setReviewerNotes('');
      // Refetch and keep the document selected with updated data
      const docsRes = await axios.get(`${API_BASE_URL}/documents`);
      const analyticsRes = await axios.get(`${API_BASE_URL}/analytics`);
      setDocuments(docsRes.data);
      setAnalytics(analyticsRes.data);

      const updated = docsRes.data.find(d => d.id === selectedDoc.id);
      setSelectedDoc(updated || null);
    } catch (err) {
      console.error("Error submitting decision:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter documents based on role and text filters
  const allowedTypes = ROLE_DOC_MAPPING[activeRole] || [];
  const filteredDocs = documents.filter(doc => {
    // 1. Role compatibility
    if (!allowedTypes.includes(doc.type)) return false;

    // 2. Type filter
    if (filterType !== 'ALL' && doc.type !== filterType) return false;

    // 3. Status filter
    if (filterStatus !== 'ALL' && doc.status !== filterStatus) return false;

    // 4. Text search
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const matchFile = doc.fileName.toLowerCase().includes(query);
      const matchFacility = doc.facility.toLowerCase().includes(query);
      const matchId = doc.id.toLowerCase().includes(query);
      const matchUploader = doc.uploader.toLowerCase().includes(query);
      return matchFile || matchFacility || matchId || matchUploader;
    }

    return true;
  });

  // Paginated slices
  const totalPages = Math.ceil(filteredDocs.length / pageSize) || 1;
  const paginatedDocs = filteredDocs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Helper for KPI styling & values
  const kpis = analytics?.kpis || {
    totalIngested: 0,
    approvedCount: 0,
    flaggedCount: 0,
    rejectedCount: 0,
    avgConfidence: 0,
    flaggedRate: 0,
    totalHarvestedKg: 0
  };

  if (!token) {
    return <Login apiBaseUrl={API_BASE_URL} onLogin={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-950 dark:text-zinc-50 flex flex-col font-sans transition-colors duration-300">

      {/* Top Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] sticky top-0 z-30 transition-colors">
        <div className="max-w-[1600px] mx-auto p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/20">
              AQ
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">AquaIntelligent</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Intelligent Document Intake & Decision Support Hub</p>
            </div>
          </div>

          {/* User Role & Navigation */}
          <div className="flex flex-wrap items-center gap-3">

            {/* Active User Role selector */}
            <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <User size={14} className="text-zinc-500" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider leading-tight">
                  {authUser?.username}
                </span>
                <select
                  value={activeRole}
                  onChange={(e) => {
                    setActiveRole(e.target.value);
                    setCurrentPage(1); // Reset page on role switch
                  }}
                  className="bg-transparent text-sm font-medium focus:outline-none appearance-none cursor-pointer pr-4 leading-tight"
                >
                  {Object.keys(ROLES).map((key) => (
                    <option key={key} value={ROLES[key].name}>{ROLES[key].name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md transition-colors text-zinc-500 hover:text-red-500"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Dark Mode toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 border border-zinc-200 dark:border-zinc-700 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-blue-500" />}
            </button>

            {/* Reset database button */}
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-medium transition-all duration-200 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isResetting ? "animate-spin" : ""} />
              {isResetting ? "Resetting..." : "Reset Data"}
            </button>
          </div>

        </div>
      </header>

      {/* Role Banner / Description */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/30 p-3 transition-colors">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between text-xs text-blue-800 dark:text-blue-300">
          <p className="font-medium">
            <strong>Active View:</strong> {activeRole} Portal. {ROLES[Object.keys(ROLES).find(k => ROLES[k].name === activeRole)].description}
          </p>
          <span className="hidden sm:inline bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded font-semibold">
            {allowedTypes.length} Document Types Scope
          </span>
        </div>
      </div>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full p-6 space-y-6">

        {/* KPI Cards Row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Card 1: Total Documents */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex items-center justify-between shadow-sm transition-all duration-300">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Ingested</p>
              <h3 className="text-2xl font-extrabold mt-1 tracking-tight">{kpis.totalIngested}</h3>
              <p className="text-xs text-zinc-400 mt-0.5">All uploaded files</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
              <FileText size={20} />
            </div>
          </div>

          {/* Card 2: Verification Alert Rate */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex items-center justify-between shadow-sm transition-all duration-300">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Alert Flags Rate</p>
              <h3 className="text-2xl font-extrabold mt-1 tracking-tight">{kpis.flaggedRate}%</h3>
              <span className={`inline-flex items-center gap-0.5 mt-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${kpis.flaggedRate > 30 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'}`}>
                {kpis.flaggedCount} documents flagged
              </span>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
              <AlertTriangle size={20} />
            </div>
          </div>

          {/* Card 3: Extraction Accuracy (AI Confidence) */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex items-center justify-between shadow-sm transition-all duration-300">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Avg AI Accuracy</p>
              <h3 className="text-2xl font-extrabold mt-1 tracking-tight">{kpis.avgConfidence}%</h3>
              <span className="inline-flex items-center gap-0.5 mt-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                OCR & NLP Score
              </span>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
              <ShieldCheck size={20} />
            </div>
          </div>

          {/* Card 4: Harvest Tonnage */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex items-center justify-between shadow-sm transition-all duration-300">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Landings</p>
              <h3 className="text-2xl font-extrabold mt-1 tracking-tight">{(kpis.totalHarvestedKg / 1000).toFixed(1)} T</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Quota tonnage caught</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shadow-inner">
              <Anchor size={20} />
            </div>
          </div>

        </section>

        {/* Tab Selection */}
        <section className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('intake')}
            className={`px-5 py-2.5 font-medium text-sm border-b-2 transition-all flex items-center gap-2 ${activeTab === 'intake' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
          >
            <HardDrive size={16} />
            Intake Operations
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-5 py-2.5 font-medium text-sm border-b-2 transition-all flex items-center gap-2 ${activeTab === 'analytics' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
          >
            <BarChart3 size={16} />
            Operational Analytics
          </button>
        </section>

        {/* API Error / Cold Start Notification */}
        {apiError && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <span>{apiError}</span>
            </div>
            <button
              onClick={() => fetchData(true)}
              disabled={isLoadingData}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-md transition-colors shrink-0"
            >
              {isLoadingData ? 'Connecting...' : 'Retry Connection'}
            </button>
          </div>
        )}

        {/* Tab 1: Intake Operations View */}
        {activeTab === 'intake' && (
          <div className="flex flex-col lg:flex-row gap-6 relative items-start">

            {/* Left Column: Intake Queue Table */}
            <div className={`transition-all duration-300 w-full ${selectedDoc ? 'lg:w-2/3' : 'w-full'}`}>

              {/* Queue Toolbar */}
              <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-4 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                {/* Search & Filters */}
                <div className="flex flex-wrap items-center gap-3 flex-1">

                  {/* Search bar */}
                  <div className="relative w-full max-w-xs">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search files, facilities, IDs..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-9 pr-4 py-2 w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Filter by Category */}
                  <select
                    value={filterType}
                    onChange={(e) => {
                      setFilterType(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm px-3 py-2 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="ALL">All Categories</option>
                    {allowedTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>

                  {/* Filter by Status */}
                  <select
                    value={filterStatus}
                    onChange={(e) => {
                      setFilterStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm px-3 py-2 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Auto-Approved">Auto-Approved</option>
                    <option value="Approved">Approved</option>
                    <option value="Flagged">Flagged</option>
                    <option value="Rejected">Rejected</option>
                  </select>

                </div>

                {/* Simulated Ingest Button */}
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-1.5 bg-[#059669] hover:bg-[#047857] text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors shadow-sm self-start md:self-auto"
                >
                  <UploadCloud size={16} />
                  Ingest Document
                </button>

              </div>

              {/* Table Container */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[12px] overflow-hidden shadow-sm">

                {/* Live Analyzer Row (Transient State Animation) */}
                {isAnalyzing && (
                  <div className="bg-blue-500/10 border-b border-blue-200 dark:border-blue-800/30 px-6 py-4 flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                      <div>
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">AI Analyzer Pipeline Processing...</p>
                        <p className="text-xs text-zinc-500 font-mono mt-0.5">{analyzingFileName}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono bg-blue-500 text-white px-2 py-0.5 rounded animate-bounce">
                      Running OCR/Rules
                    </span>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">
                        <th className="py-3.5 px-6">Document Details</th>
                        <th className="py-3.5 px-4">Stage / Facility</th>
                        <th className="py-3.5 px-4">Upload Info</th>
                        <th className="py-3.5 px-4 text-center">AI Match %</th>
                        <th className="py-3.5 px-6 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">

                      {isLoadingData ? (
                        <tr>
                          <td colSpan="5" className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                              <p className="text-sm font-medium">Connecting to backend & fetching documents...</p>
                            </div>
                          </td>
                        </tr>
                      ) : paginatedDocs.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                            No documents match the current role scope or filters.
                          </td>
                        </tr>
                      ) : (
                        paginatedDocs.map((doc) => {
                          const isSelected = selectedDoc && selectedDoc.id === doc.id;
                          return (
                            <tr
                              key={doc.id}
                              onClick={() => {
                                setSelectedDoc(doc);
                                setReviewerNotes('');
                              }}
                              className={`hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors duration-150 ${isSelected ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                            >
                              {/* Details (Filename / Type) */}
                              <td className="py-4 px-6">
                                <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{doc.fileName}</div>
                                <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono font-normal">
                                    {doc.type}
                                  </span>
                                  <span className="font-mono text-zinc-400 text-[10px]">ID: {doc.id.substring(0, 8)}...</span>
                                </div>
                              </td>

                              {/* Stage / Facility */}
                              <td className="py-4 px-4 text-sm">
                                <div className="font-medium text-zinc-800 dark:text-zinc-200">{doc.facility}</div>
                              </td>

                              {/* Uploader / Upload Time */}
                              <td className="py-4 px-4 text-xs text-zinc-500">
                                <div>{doc.uploader}</div>
                                <div className="mt-1">{new Date(doc.uploadTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                              </td>

                              {/* AI Confidence Sparkline */}
                              <td className="py-4 px-4">
                                <div className="flex flex-col items-center justify-center">
                                  <span className="text-xs font-mono font-semibold">{doc.extractionConfidence}%</span>
                                  {/* Progress bar sparkline */}
                                  <div className="w-20 bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${doc.extractionConfidence > 92 ? 'bg-emerald-500' : doc.extractionConfidence > 85 ? 'bg-orange-400' : 'bg-rose-500'}`}
                                      style={{ width: `${doc.extractionConfidence}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </td>

                              {/* Status badge */}
                              <td className="py-4 px-6 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${doc.status === 'Approved' || doc.status === 'Auto-Approved'
                                  ? 'bg-emerald-100/60 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30'
                                  : doc.status === 'Flagged'
                                    ? 'bg-amber-100/60 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-900/30'
                                    : 'bg-rose-100/60 dark:bg-rose-950/20 text-rose-800 dark:text-rose-400 border-rose-200 dark:border-rose-900/30'
                                  }`}>
                                  {doc.status === 'Approved' || doc.status === 'Auto-Approved' ? (
                                    <CheckCircle2 size={12} />
                                  ) : (
                                    <AlertTriangle size={12} />
                                  )}
                                  {doc.status}
                                </span>
                              </td>

                            </tr>
                          );
                        })
                      )}

                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="bg-zinc-50 dark:bg-zinc-900 px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">
                    Showing <strong className="font-semibold">{Math.min(filteredDocs.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filteredDocs.length, currentPage * pageSize)}</strong> of <strong className="font-semibold">{filteredDocs.length}</strong> matching documents
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* First Page */}
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-1.5 border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-700"
                    >
                      <ChevronsLeft size={14} />
                    </button>
                    {/* Previous Page */}
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="p-1.5 border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-700"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {/* Page Label */}
                    <span className="text-xs px-2 text-zinc-700 dark:text-zinc-300 font-medium">Page {currentPage} of {totalPages}</span>
                    {/* Next Page */}
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="p-1.5 border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-700"
                    >
                      <ChevronRight size={14} />
                    </button>
                    {/* Last Page */}
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-1.5 border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-700"
                    >
                      <ChevronsRight size={14} />
                    </button>
                  </div>
                </div>

              </div>

            </div>

            {/* Right Column: Reviewer Details & Decision Panel (Slide in/out) */}
            {selectedDoc && (
              <div className="w-full lg:w-1/3 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-lg space-y-6 sticky top-24 transition-all duration-300 animate-in slide-in-from-right-5">

                {/* Panel Title & Close Button */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                      Decision Copilot
                    </span>
                    <h2 className="text-base font-extrabold mt-1 truncate max-w-[250px]">
                      {selectedDoc.fileName}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="p-1 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* 1. Raw Simulated File Highlights */}
                <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-xs space-y-2">
                  <h4 className="font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                    OCR Document Outline
                  </h4>
                  <div className="font-mono text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap divide-y divide-zinc-200 dark:divide-zinc-800">
                    <div className="py-1 flex justify-between">
                      <span className="text-zinc-400">File Type:</span>
                      <strong>{selectedDoc.type}</strong>
                    </div>
                    <div className="py-1 flex justify-between">
                      <span className="text-zinc-400">Facility:</span>
                      <strong>{selectedDoc.facility}</strong>
                    </div>
                    <div className="py-1 flex justify-between">
                      <span className="text-zinc-400">Uploader:</span>
                      <strong>{selectedDoc.uploader}</strong>
                    </div>
                  </div>
                </div>

                {/* 2. AI Extracted Key Parameters */}
                <div className="bg-zinc-950 text-zinc-200 border border-zinc-800 rounded-lg p-4 font-mono text-xs space-y-2">
                  <h4 className="font-semibold text-zinc-500 uppercase tracking-wider text-[10px]">
                    AI Extracted Structure (JSON)
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {Object.entries(selectedDoc.content || {}).map(([key, val]) => (
                      <div key={key} className="flex justify-between py-0.5 border-b border-zinc-900">
                        <span className="text-zinc-400">{key}:</span>
                        <strong className="text-white">{typeof val === 'number' ? val.toString() : val}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Validation Audits & Compliance */}
                <div className="space-y-2.5">
                  <h4 className="font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                    Compliance Verification Checks
                  </h4>

                  {selectedDoc.alerts.length === 0 ? (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-300 rounded-lg p-3.5 flex gap-2 text-xs">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <strong>All metrics clean.</strong> Document complies with the aquaculture standards database.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedDoc.alerts.map((alert, i) => (
                        <div
                          key={i}
                          className={`border rounded-lg p-3 flex gap-2.5 text-xs ${alert.severity === 'Critical'
                            ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/30 text-rose-800 dark:text-rose-300'
                            : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/30 text-amber-800 dark:text-amber-300'
                            }`}
                        >
                          <AlertTriangle size={16} className={`shrink-0 mt-0.5 ${alert.severity === 'Critical' ? 'text-rose-500' : 'text-amber-500'}`} />
                          <div>
                            <strong className="block font-bold">Field: {alert.field} ({alert.severity})</strong>
                            <p className="mt-0.5">{alert.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. AI Recommendation Box */}
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 text-blue-800 dark:text-blue-300 rounded-lg p-4 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <strong className="font-bold flex items-center gap-1">
                      <Activity size={14} className="text-blue-500" />
                      AI Recommendation
                    </strong>
                    <span className="font-mono text-zinc-400">Confidence: {selectedDoc.extractionConfidence}%</span>
                  </div>
                  <p className="italic text-zinc-600 dark:text-zinc-300">"{selectedDoc.aiRecommendation}"</p>
                </div>

                {/* History Log */}
                {selectedDoc.decisionBy && (
                  <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Reviewer Audit Log</span>
                    <p className="text-zinc-600 dark:text-zinc-300">
                      <strong>Status:</strong> {selectedDoc.status}
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-300">
                      <strong>Action by:</strong> {selectedDoc.decisionBy}
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-300">
                      <strong>Notes:</strong> {selectedDoc.reviewerNotes}
                    </p>
                    <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                      {new Date(selectedDoc.decisionTime).toLocaleString()}
                    </p>
                  </div>
                )}

                {/* 5. Reviewer Actions Input */}
                <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                      Reviewer Verification Notes
                    </label>
                    <textarea
                      placeholder="Input justification details, corrective actions taken, or release comments..."
                      value={reviewerNotes}
                      onChange={(e) => setReviewerNotes(e.target.value)}
                      className="w-full bg-[#ffffff] dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:text-zinc-100 placeholder-zinc-500 shadow-sm"
                      rows="3"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleDecision('APPROVE')}
                      disabled={actionLoading}
                      className="bg-[#059669] hover:bg-[#047857] text-white rounded-lg py-2.5 text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <Check size={14} />
                      Approve
                    </button>
                    <button
                      onClick={() => handleDecision('FLAG')}
                      disabled={actionLoading}
                      className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2.5 text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <AlertTriangle size={14} />
                      Flag
                    </button>
                    <button
                      onClick={() => handleDecision('REJECT')}
                      disabled={actionLoading}
                      className="bg-[#e11d48] hover:bg-[#be123c] text-white rounded-lg py-2.5 text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <X size={14} />
                      Reject
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* Tab 2: Operational Analytics View */}
        {activeTab === 'analytics' && (
          <AnalyticsDashboard
            analyticsData={analytics}
            isDarkMode={isDarkMode}
          />
        )}

      </main>

      {/* Simulated Document Intake Modal Overlay */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm p-4">

          <div className="bg-white dark:bg-[#0c0c0f] rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6 relative animate-in zoom-in-95">

            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <X size={16} />
            </button>

            <h3 className="text-lg font-bold flex items-center gap-2 mb-1.5">
              <UploadCloud size={20} className="text-blue-600" />
              Simulated Document Intake
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Simulate document ingestion by selecting from standard pre-written forms representing aquaculture facilities.
            </p>

            <form onSubmit={handleSimulatedUpload} className="space-y-4">

              {/* Select Preset Template */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                  Select Presettled Document Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full bg-[#ffffff] dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
                >
                  {SIMULATED_UPLOADS.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>
                      [{tpl.type}] - {tpl.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Uploader Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                  Authorized Uploader Identity
                </label>
                <input
                  type="text"
                  value={uploaderName}
                  onChange={(e) => setUploaderName(e.target.value)}
                  placeholder="e.g. Field Inspector Yuki Tanaka"
                  className="w-full bg-[#ffffff] dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
                  required
                />
              </div>

              {/* Custom Filename */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                  Custom File Name (Optional)
                </label>
                <input
                  type="text"
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  placeholder="Leave empty to use template default name"
                  className="w-full bg-[#ffffff] dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="w-1/2 bg-[#ffffff] dark:bg-[#262626] hover:bg-[#f8fafc] dark:hover:bg-zinc-800 text-[#334155] dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg py-2.5 text-xs font-semibold shadow-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-[#059669] hover:bg-[#047857] text-white rounded-lg py-2.5 text-xs font-semibold shadow-sm transition-colors"
                >
                  Ingest & Process
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Page Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 px-6 bg-white dark:bg-[#0c0c0f] transition-colors mt-auto">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 gap-4">
          <p>© 2026 AquaIntelligent Systems. All rights reserved. Decision Support Mode Active.</p>
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-500" />
              API Server Online
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck size={12} className="text-blue-500" />
              AI Extraction Module Calibrated
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
