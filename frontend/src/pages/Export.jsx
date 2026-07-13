import React, { useState, useEffect } from 'react';
import { api, downloadBlob } from '../api/index.js';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const QUARTERS = [
  { value: 1, label: 'Q1 (Jan – Mar)' },
  { value: 2, label: 'Q2 (Apr – Jun)' },
  { value: 3, label: 'Q3 (Jul – Sep)' },
  { value: 4, label: 'Q4 (Oct – Dec)' },
];

function currentQuarter() {
  return Math.floor(new Date().getMonth() / 3) + 1;
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 mt-6 first:mt-0">
      {children}
    </h2>
  );
}

function ExportCard({ title, description, filename, onExport, loading }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-start gap-4">
      <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-2xl flex-shrink-0">📊</div>
      <div className="flex-1">
        <h3 className="font-bold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-1 mb-4">{description}</p>
        <button onClick={onExport} disabled={loading}
          className="px-5 py-2.5 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          style={{ background: '#1A4B8C' }}>
          {loading ? '⏳ Generating…' : '⬇ Download Excel'}
        </button>
        {filename && <p className="text-xs text-gray-400 mt-2">Filename: {filename}</p>}
      </div>
    </div>
  );
}

export default function Export() {
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [loadingTest, setLoadingTest] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);
  const [botStatus, setBotStatus] = useState(null);
  const [botInfo, setBotInfo] = useState(null);
  const [lastReport, setLastReport] = useState(null);

  const [loadingEmailTest, setLoadingEmailTest] = useState(false);
  const [loadingEmailSend, setLoadingEmailSend] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailInfo, setEmailInfo] = useState(null);
  const [lastEmailReport, setLastEmailReport] = useState(null);
  const [emailYear, setEmailYear] = useState(new Date().getFullYear());
  const [emailQuarter, setEmailQuarter] = useState(currentQuarter());
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState([]);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter());

  const toast = useToast();
  const { canSendReport } = useAuth();
  const dateStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    api.getStaff().then(s => setStaffList(s.filter(m => m.active && m.email))).catch(() => {});
  }, []);

  // Year options: 3 years back + next year
  const years = [];
  const thisYear = new Date().getFullYear();
  for (let y = thisYear - 3; y <= thisYear + 1; y++) years.push(y);

  async function handleMaster() {
    setLoadingMaster(true);
    try {
      const blob = await api.exportMaster();
      downloadBlob(blob, `CalibrationDatabase_${dateStr}.xlsx`);
      toast('Master database exported');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoadingMaster(false); }
  }

  async function handleSchedule() {
    setLoadingSchedule(true);
    try {
      const blob = await api.exportSchedule();
      downloadBlob(blob, `CalibrationSchedule_${dateStr}.xlsx`);
      toast('Schedule exported');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoadingSchedule(false); }
  }

  async function handleTest() {
    setLoadingTest(true);
    setBotStatus(null);
    setBotInfo(null);
    try {
      const result = await api.telegramTest();
      setBotStatus('ok');
      setBotInfo(result);
      toast(`Connected! Bot: @${result.botUsername}`);
    } catch (e) {
      setBotStatus('error');
      toast(e.message, 'error');
    } finally { setLoadingTest(false); }
  }

  async function handleEmailTest() {
    setLoadingEmailTest(true);
    setEmailStatus(null);
    setEmailInfo(null);
    try {
      const result = await api.emailTest();
      setEmailStatus('ok');
      setEmailInfo(result);
      toast(`Email connected! Sent to ${result.to}`);
    } catch (e) {
      setEmailStatus('error');
      toast(e.message, 'error');
    } finally { setLoadingEmailTest(false); }
  }

  function toggleStaff(id) {
    setSelectedStaff(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleEmailSend() {
    setLoadingEmailSend(true);
    setLastEmailReport(null);
    try {
      const emails = staffList.filter(s => selectedStaff.includes(s.id)).map(s => s.email);
      const result = await api.emailQuarterly(emailYear, emailQuarter, emails.length ? emails : undefined);
      setLastEmailReport(result);
      toast(`Q${emailQuarter} ${emailYear} report emailed to ${result.sentTo} ✓`);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoadingEmailSend(false); }
  }

  async function handleSend() {
    setLoadingSend(true);
    setLastReport(null);
    try {
      const result = await api.telegramQuarterly(selectedYear, selectedQuarter);
      setLastReport(result);
      toast(`Q${selectedQuarter} ${selectedYear} report sent to Telegram ✓`);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoadingSend(false); }
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Export & Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Download calibration data or send reports via Telegram</p>
      </div>

      {/* Excel exports */}
      <SectionTitle>Excel Exports</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExportCard
          title="Master Database"
          description="Complete list of all customers, equipment, calibration dates and status. Colour-coded rows, frozen header, auto-filter."
          filename={`CalibrationDatabase_${dateStr}.xlsx`}
          onExport={handleMaster}
          loading={loadingMaster}
        />
        <ExportCard
          title="Calibration Schedule"
          description="Upcoming and overdue calibrations sorted by next calibration date, one row per equipment unit."
          filename={`CalibrationSchedule_${dateStr}.xlsx`}
          onExport={handleSchedule}
          loading={loadingSchedule}
        />
      </div>

      {/* Telegram section */}
      <SectionTitle>Telegram Reports</SectionTitle>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Setup instructions */}
        <div className="p-5 border-b border-gray-100 bg-gray-50/60">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">🤖</span>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Telegram Bot Setup</h3>
              <p className="text-sm text-gray-500 mb-3">First-time setup — takes 2 minutes. Only needed once.</p>
              <ol className="text-sm text-gray-700 space-y-1.5 list-decimal list-inside">
                <li>Open Telegram and search for <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">@BotFather</span></li>
                <li>Send <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">/newbot</span> → follow prompts → copy your <b>bot token</b></li>
                <li>Add your bot to the group chat, then search for <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">@userinfobot</span> in the group to get the <b>chat ID</b></li>
                <li>
                  Paste both values into{' '}
                  <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">backend/.env</span>:
                  <pre className="mt-1.5 bg-gray-900 text-green-400 text-xs rounded-lg p-3 font-mono leading-relaxed overflow-x-auto">{`TELEGRAM_BOT_TOKEN=123456789:ABCdef...
TELEGRAM_CHAT_ID=-1001234567890`}</pre>
                </li>
                <li>Restart the backend (<span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">node server.js</span>), then click <b>Test Connection</b> below</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Test connection */}
          <div className="flex items-center gap-4 flex-wrap">
            <button onClick={handleTest} disabled={loadingTest}
              className="px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2">
              {loadingTest ? '⏳ Testing…' : '🔌 Test Connection'}
            </button>
            {botStatus === 'ok' && botInfo && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
                <span>✅</span>
                <span>Connected as <b>@{botInfo.botUsername}</b> — test message sent to your group</span>
              </div>
            )}
            {botStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                <span>❌</span>
                <span>Connection failed — check your token and chat ID in <code className="font-mono text-xs">backend/.env</code></span>
              </div>
            )}
          </div>

          {/* Quarterly report sender */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-4">
            <div>
              <h4 className="font-semibold text-gray-900">📊 Send Quarterly Report</h4>
              <p className="text-sm text-gray-500 mt-0.5">
                Sends a formatted summary to your Telegram group: calibrations done, overdue equipment, upcoming schedule, top customers, state coverage.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
                <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Quarter</label>
                <select value={selectedQuarter} onChange={e => setSelectedQuarter(parseInt(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                  {QUARTERS.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
                </select>
              </div>
              <div className="mt-5">
                {canSendReport ? (
                  <button onClick={handleSend} disabled={loadingSend}
                    className="px-5 py-2.5 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                    style={{ background: '#1A4B8C' }}>
                    {loadingSend ? '⏳ Sending…' : '📨 Send to Telegram'}
                  </button>
                ) : (
                  <p className="text-xs text-gray-400 flex items-center gap-1">🔒 No permission to send reports</p>
                )}
              </div>
            </div>

            {/* Last report summary */}
            {lastReport && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <p className="font-semibold text-blue-900 mb-2">✅ Report sent — {lastReport.quarter}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-blue-800">
                  <div><span className="text-blue-500">Calibrations:</span> <b>{lastReport.stats.calibrationsDone}</b></div>
                  <div><span className="text-blue-500">Customers:</span> <b>{lastReport.stats.customersServed}</b></div>
                  <div><span className="text-blue-500">Equipment:</span> <b>{lastReport.stats.equipmentServiced}</b></div>
                  <div><span className="text-blue-500">Overdue:</span> <b className="text-red-600">{lastReport.stats.overdueCount}</b></div>
                  <div><span className="text-blue-500">Due next Qtr:</span> <b>{lastReport.stats.dueNextQuarter}</b></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email section */}
      <SectionTitle>Email Reports</SectionTitle>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/60">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">📧</span>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Email Setup — Gmail OAuth2 ✅ Configured</h3>
              <p className="text-sm text-gray-500 mb-3">Emails are sent directly from <b>darylc25@gmail.com</b> via Gmail API. No SMTP needed.</p>
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                <span>✅</span>
                <span>Gmail OAuth2 is active — Railway variables <code className="font-mono text-xs">GMAIL_CLIENT_ID</code>, <code className="font-mono text-xs">GMAIL_CLIENT_SECRET</code> and <code className="font-mono text-xs">GMAIL_REFRESH_TOKEN</code> are set.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center gap-4 flex-wrap">
            <button onClick={handleEmailTest} disabled={loadingEmailTest}
              className="px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2">
              {loadingEmailTest ? '⏳ Testing…' : '📬 Test Email'}
            </button>
            {emailStatus === 'ok' && emailInfo && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
                <span>✅</span>
                <span>Connected! Test email sent to <b>{emailInfo.to}</b></span>
              </div>
            )}
            {emailStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                <span>❌</span>
                <span>Failed — check <code className="font-mono text-xs">backend/.env</code> credentials</span>
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-xl p-4 space-y-4">
            <div>
              <h4 className="font-semibold text-gray-900">📊 Send Quarterly Report by Email</h4>
              <p className="text-sm text-gray-500 mt-0.5">
                Sends a full HTML report with overdue list, upcoming schedule, top customers — plus the master database as an Excel attachment.
              </p>
            </div>

            {/* Staff recipient picker */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">
                Recipients
                {staffList.length > 0 && (
                  <span className="ml-2 text-gray-400">
                    ({selectedStaff.length === 0 ? 'default from .env' : `${selectedStaff.length} selected`})
                  </span>
                )}
              </p>
              {staffList.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                  No staff with email addresses found — report will go to the default recipient in <code className="font-mono text-xs">backend/.env</code>. Add staff on the <a href="/staff" className="text-blue-600 underline">Staff page</a>.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {staffList.map(s => {
                    const checked = selectedStaff.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors
                          ${checked
                            ? 'bg-navy/10 border-navy/30 text-gray-900'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        style={checked ? { background: '#1A4B8C12', borderColor: '#1A4B8C40' } : {}}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStaff(s.id)}
                          className="w-3.5 h-3.5"
                        />
                        <span>
                          <span className="font-medium">{s.name}</span>
                          <span className="text-gray-400 text-xs ml-1">— {s.role}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {staffList.length > 0 && selectedStaff.length === 0 && (
                <p className="text-xs text-amber-600 mt-2">No staff selected — will use default recipient from <code className="font-mono">backend/.env</code></p>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
                <select value={emailYear} onChange={e => setEmailYear(parseInt(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Quarter</label>
                <select value={emailQuarter} onChange={e => setEmailQuarter(parseInt(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                  {QUARTERS.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
                </select>
              </div>
              <div className="mt-5">
                {canSendReport ? (
                  <button onClick={handleEmailSend} disabled={loadingEmailSend}
                    className="px-5 py-2.5 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                    style={{ background: '#1A4B8C' }}>
                    {loadingEmailSend ? '⏳ Sending…' : '📨 Send Email Report'}
                  </button>
                ) : (
                  <p className="text-xs text-gray-400 flex items-center gap-1">🔒 No permission to send reports</p>
                )}
              </div>
            </div>

            {lastEmailReport && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <p className="font-semibold text-blue-900 mb-2">✅ Email sent — {lastEmailReport.quarter} → {lastEmailReport.sentTo}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-blue-800">
                  <div><span className="text-blue-500">Calibrations:</span> <b>{lastEmailReport.stats.calibrationsDone}</b></div>
                  <div><span className="text-blue-500">Customers:</span> <b>{lastEmailReport.stats.customersServed}</b></div>
                  <div><span className="text-blue-500">Equipment:</span> <b>{lastEmailReport.stats.equipmentServiced}</b></div>
                  <div><span className="text-blue-500">Overdue:</span> <b className="text-red-600">{lastEmailReport.stats.overdueCount}</b></div>
                  <div><span className="text-blue-500">Due next Qtr:</span> <b>{lastEmailReport.stats.dueNextQuarter}</b></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Excel Format Notes</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Header row: navy (#1A4B8C) background, white bold text, frozen for scrolling</li>
          <li>Overdue rows highlighted red (#FDECEA), due-soon rows amber (#FFF3CD)</li>
          <li>Auto-filter enabled on all columns · Currency MYR throughout</li>
        </ul>
      </div>
    </div>
  );
}
