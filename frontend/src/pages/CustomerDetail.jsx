import { useAuth } from '../context/AuthContext.jsx';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api, formatDate, getWarrantyStatus, WARRANTY_BADGE } from '../api/index.js';
import PriorityBadge from '../components/PriorityBadge.jsx';
import AddEquipmentModal from '../components/AddEquipmentModal.jsx';
import TransferEquipmentModal from '../components/TransferEquipmentModal.jsx';
import BatchTransferModal from '../components/BatchTransferModal.jsx';
import RecordCalibrationModal from '../components/RecordCalibrationModal.jsx';
import RequestDeletionModal from '../components/RequestDeletionModal.jsx';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal.jsx';
import { useToast } from '../components/Toast.jsx';

const STATES = ['Kuala Lumpur','Selangor','Penang','Johor','Sabah','Sarawak','Perak','Pahang','Terengganu','Kedah','Kelantan','Melaka','Negeri Sembilan'];
const COUNTRIES = ['Malaysia','Indonesia','Vietnam','Philippines','Thailand','Myanmar','Cambodia','Laos','Brunei','Timor-Leste','Hong Kong','Others'];

export default function CustomerDetail() {
  const { isAdmin, isEditor, canDelete } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [navIds, setNavIds] = useState(location.state?.ids || null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [showEquipment, setShowEquipment] = useState(false);
  const [editEq, setEditEq] = useState(null); // equipment object to edit
  const [transferEq, setTransferEq] = useState(null); // equipment object to transfer
  const [showBatchTransfer, setShowBatchTransfer] = useState(false);
  const [showCal, setShowCal] = useState(null);
  const [editCal, setEditCal] = useState(null);
  const [deleteEq, setDeleteEq] = useState(null); // { id, name, step: 1|2 }
  const [requestDeleteEq, setRequestDeleteEq] = useState(null); // { id, name }
  const [typeChanging, setTypeChanging] = useState(false);

  function load() {
    api.getCustomer(id).then(d => {
      setData(d);
      setForm({ name: d.name, contact_person: d.contact_person || '', email: d.email || '', phone: d.phone || '', address: d.address || '', address_2: d.address_2 || '', city_postcode: d.city_postcode || '', state: d.state || '', country: d.country || '' });
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  // Load full ID list as fallback when arriving via direct URL (no router state)
  useEffect(() => {
    if (navIds) return;
    api.getCustomers().then(list => {
      setNavIds(list.map(c => c.id));
    }).catch(() => {});
  }, []);

  const currentIdx = navIds ? navIds.indexOf(parseInt(id, 10)) : -1;
  const prevId = currentIdx > 0 ? navIds[currentIdx - 1] : null;
  const nextId = currentIdx >= 0 && currentIdx < navIds?.length - 1 ? navIds[currentIdx + 1] : null;

  function goTo(targetId) {
    navigate(`/customers/${targetId}`, { state: { ids: navIds } });
  }

  // Auto-open calibration modal when arriving from calendar (?newcal=1&equipment=ID)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('newcal') === '1' && isEditor) {
      const equipmentId = params.get('equipment');
      setShowCal({ customerId: id, equipmentId: equipmentId || undefined });
      // Clean URL without reloading
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, isEditor]);

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })); }

  async function handleSaveCustomer() {
    try {
      await api.updateCustomer(id, form);
      toast('Customer updated');
      setEditing(false);
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleSaveEquipment(eqForm) {
    try {
      if (eqForm.id) {
        await api.updateEquipment(eqForm.id, eqForm);
        toast('Equipment updated');
        setEditEq(null);
      } else {
        await api.createEquipment(eqForm);
        toast('Equipment added');
        setShowEquipment(false);
      }
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleSaveCal(calForm, recordId) {
    try {
      if (recordId) {
        await api.updateCalibration(recordId, calForm);
        toast('Calibration record updated');
        setEditCal(null);
      } else {
        await api.createCalibration(calForm);
        toast('Calibration recorded');
        setShowCal(null);
      }
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleDeleteEquipment(eqId) {
    try {
      await api.deleteEquipment(eqId);
      toast('Equipment deleted');
      setDeleteEq(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleFlipType() {
    if (!data) return;
    const newType = data.customer_type === 'Dealer' ? 'Direct' : 'Dealer';
    if (!window.confirm(`Change "${data.name}" to ${newType}? This affects how they appear across all pages.`)) return;
    setTypeChanging(true);
    try {
      await api.updateCustomerType(id, newType);
      toast(`Account type changed to ${newType}`);
      load();
    } catch (e) { toast(e.message, 'error'); }
    finally { setTypeChanging(false); }
  }

  async function handleBatchTransfer(targetCustomerId, note) {
    try {
      const result = await api.batchTransferEquipment({ from_customer_id: id, target_customer_id: targetCustomerId, transfer_note: note });
      toast(`${result.transferred} equipment transferred`);
      setShowBatchTransfer(false);
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  if (loading) return <div className="p-8 text-center text-sm text-gray-400">Loading…</div>;
  if (!data) return <div className="p-8 text-center text-sm text-gray-400">Customer not found</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/customers')} className="text-sm text-gray-500 hover:text-gray-900">← Customers</button>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-900">{data.name}</span>
          {navIds && currentIdx >= 0 && (
            <span className="text-xs text-gray-400">{currentIdx + 1} / {navIds.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => prevId && goTo(prevId)}
            disabled={!prevId}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
            ← Prev
          </button>
          <button
            onClick={() => nextId && goTo(nextId)}
            disabled={!nextId}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
            Next →
          </button>
        </div>
      </div>

      {/* Customer Info Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">Customer Info</h2>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${data.customer_type === 'Dealer' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
              {data.customer_type || 'Direct'}
            </span>
            {isAdmin && (
              <button onClick={handleFlipType} disabled={typeChanging}
                className="text-xs text-gray-500 hover:text-gray-800 underline disabled:opacity-50">
                {typeChanging ? 'Changing…' : `Switch to ${data.customer_type === 'Dealer' ? 'Direct' : 'Dealer'}`}
              </button>
            )}
          </div>
          {!editing ? (
            isEditor && <button onClick={() => setEditing(true)} className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">Edit</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveCustomer} className="text-sm px-3 py-1.5 text-white rounded-lg hover:opacity-90" style={{ background: '#1A4B8C' }}>Save</button>
            </div>
          )}
        </div>
        {editing ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
              <input value={form.name} onChange={set('name')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
            {[['contact_person', 'Contact Person'], ['email', 'Email'], ['phone', 'Phone']].map(([field, label]) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                <input value={form[field]} onChange={set(field)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Country</label>
              <select value={form.country} onChange={set('country')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                <option value="">Select country…</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2 border-t border-gray-100 pt-3 mt-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Address</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Address Line 1</label>
                  <input value={form.address} onChange={set('address')}
                    placeholder="e.g. Lot 6219 & 6220, Jalan Toman 1"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Address Line 2</label>
                  <input value={form.address_2} onChange={set('address_2')}
                    placeholder="e.g. Kemayan Square"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">City & Postcode</label>
                  <input value={form.city_postcode} onChange={set('city_postcode')}
                    placeholder="e.g. 70200 Seremban"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">State</label>
                  <select value={form.state} onChange={set('state')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                    <option value="">Select…</option>
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[['Contact', data.contact_person], ['Email', data.email], ['Phone', data.phone], ['Country', data.country]].map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  <p className="text-gray-900 mt-0.5">{val || '—'}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Address</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Address Line 1</p>
                  <p className="text-gray-900 mt-0.5">{data.address || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Address Line 2</p>
                  <p className="text-gray-900 mt-0.5">{data.address_2 || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">City & Postcode</p>
                  <p className="text-gray-900 mt-0.5">{data.city_postcode || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">State</p>
                  <p className="text-gray-900 mt-0.5">{data.state || '—'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Equipment */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Equipment ({data.equipment?.length ?? 0})</h2>
          {isEditor && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setShowCal({ customerId: id })}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">
                📋 Record Calibration
              </button>
              {(data.equipment?.length > 0) && isAdmin && (
                <button onClick={() => setShowBatchTransfer(true)}
                  className="text-sm px-3 py-1.5 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50">
                  ↗ Transfer All Equipment
                </button>
              )}
              <button onClick={() => setShowEquipment(true)}
                className="text-sm px-3 py-1.5 text-white rounded-lg hover:opacity-90" style={{ background: '#1A4B8C' }}>
                + Add Equipment
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b">
                {['Equipment', 'Model', 'Serial No', 'End User', 'Modules', 'Status', 'Warranty', 'Last Cal', 'Next Cal', 'Priority', ''].map(h => (
                  <th key={h} className="text-left py-2 pr-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.equipment || []).length === 0 ? (
                <tr><td colSpan={11} className="py-6 text-center text-gray-400">No equipment added yet</td></tr>
              ) : data.equipment.map(eq => (
                <tr key={eq.id} className="border-b border-gray-50 hover:bg-gray-50 align-top">
                  <td className="py-2 pr-3 font-medium text-gray-900">{eq.equipment_name}</td>
                  <td className="py-2 pr-3 text-gray-600">{eq.model || '—'}</td>
                  <td className="py-2 pr-3 text-gray-600 font-mono text-xs">{eq.serial_number || '—'}</td>
                  <td className="py-2 pr-3 text-xs">
                    {eq.end_user_name ? (
                      <div>
                        <div className="font-medium text-gray-800">{eq.end_user_name}</div>
                        {eq.end_user_contact && <div className="text-gray-400">{eq.end_user_contact}</div>}
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2 pr-3 text-gray-600 text-xs max-w-32 truncate">{eq.modules || '—'}</td>
                  <td className="py-2 pr-3 text-gray-600">{eq.status || '—'}</td>
                  <td className="py-2 pr-3">
                    {(() => {
                      const ws = getWarrantyStatus(eq.end_of_warranty);
                      if (!ws) return <span className="text-gray-300">—</span>;
                      const badge = WARRANTY_BADGE[ws];
                      return (
                        <div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                          <div className="text-xs text-gray-400 mt-0.5">{formatDate(eq.end_of_warranty)}</div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-2 pr-3 text-gray-600">{formatDate(eq.last_cal)}</td>
                  <td className="py-2 pr-3 text-gray-600">{formatDate(eq.next_cal)}</td>
                  <td className="py-2 pr-3"><PriorityBadge nextCal={eq.next_cal} /></td>
                  <td className="py-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      {isEditor && (
                        <button onClick={() => setEditEq(eq)}
                          className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 border border-blue-100">Edit</button>
                      )}
                      {isAdmin && (
                        <button onClick={() => setTransferEq(eq)}
                          className="text-xs text-amber-600 hover:text-amber-800 px-2 py-1 rounded hover:bg-amber-50 border border-amber-200">Transfer</button>
                      )}
                      {canDelete ? (
                        <button onClick={() => setDeleteEq({ id: eq.id, name: eq.equipment_name + (eq.serial_number ? ` (${eq.serial_number})` : ''), step: 1 })}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 border border-red-100">Delete</button>
                      ) : isEditor ? (
                        <button onClick={() => setRequestDeleteEq({ id: eq.id, name: eq.equipment_name + (eq.serial_number ? ` (${eq.serial_number})` : '') })}
                          className="text-xs text-amber-600 hover:text-amber-800 px-2 py-1 rounded hover:bg-amber-50 border border-amber-200">🗑 Request</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calibration History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Calibration History ({data.calibrations?.length ?? 0})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b">
                {['Date', 'Equipment', 'S/N', 'Service Type', 'Next Due', 'Job Sheet', 'Performed By', 'Report Status', 'Fee', ''].map(h => (
                  <th key={h} className="text-left py-2 pr-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.calibrations || []).length === 0 ? (
                <tr><td colSpan={10} className="py-6 text-center text-gray-400">No calibration records</td></tr>
              ) : data.calibrations.map(cr => (
                <tr key={cr.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-3 font-medium">{formatDate(cr.calibration_date)}</td>
                  <td className="py-2 pr-3 text-gray-600">{cr.equipment_name}</td>
                  <td className="py-2 pr-3 text-gray-500 font-mono text-xs">{cr.serial_number || '—'}</td>
                  <td className="py-2 pr-3 text-gray-600">{cr.service_type}</td>
                  <td className="py-2 pr-3 text-gray-600">{formatDate(cr.next_calibration_date)}</td>
                  <td className="py-2 pr-3 text-gray-600">{cr.job_sheet_number || '—'}</td>
                  <td className="py-2 pr-3 text-gray-600">{cr.performed_by || '—'}</td>
                  <td className="py-2 pr-3">
                    {cr.cal_report_status ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                        ${cr.cal_report_status === 'Completed' ? 'bg-green-100 text-green-700' :
                          cr.cal_report_status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                          cr.cal_report_status === 'Failed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'}`}>
                        {cr.cal_report_status}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 pr-3 text-gray-600">
                    {cr.fee ? `MYR ${parseFloat(cr.fee).toFixed(2)}` : '—'}
                  </td>
                  <td className="py-2">
                    {isEditor && (
                      <button
                        onClick={() => setEditCal(cr)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50">
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showEquipment && (
        <AddEquipmentModal
          onClose={() => setShowEquipment(false)}
          onSave={handleSaveEquipment}
          customerId={id}
          isDealer={data?.customer_type === 'Dealer'}
        />
      )}

      {editEq && (
        <AddEquipmentModal
          onClose={() => setEditEq(null)}
          onSave={handleSaveEquipment}
          customerId={id}
          initial={editEq}
          isDealer={data?.customer_type === 'Dealer'}
        />
      )}

      {transferEq && (
        <TransferEquipmentModal
          equipment={transferEq}
          currentCustomerName={data?.name}
          onClose={() => setTransferEq(null)}
          onDone={msg => { toast(msg); setTransferEq(null); load(); }}
        />
      )}

      {showBatchTransfer && (
        <BatchTransferModal
          fromCustomerName={data?.name}
          onClose={() => setShowBatchTransfer(false)}
          onTransfer={handleBatchTransfer}
          equipmentCount={data?.equipment?.length || 0}
        />
      )}

      {showCal && (
        <RecordCalibrationModal
          onClose={() => setShowCal(null)}
          onSave={handleSaveCal}
          initialCustomerId={showCal.customerId}
          initialEquipmentId={showCal.equipmentId}
        />
      )}

      {editCal && (
        <RecordCalibrationModal
          onClose={() => setEditCal(null)}
          onSave={handleSaveCal}
          record={editCal}
        />
      )}

      {requestDeleteEq && (
        <RequestDeletionModal
          recordType="equipment"
          recordId={requestDeleteEq.id}
          recordLabel={requestDeleteEq.name}
          onClose={() => setRequestDeleteEq(null)}
        />
      )}

      <ConfirmDeleteModal
        step={deleteEq?.step}
        title="Delete Equipment?"
        itemLabel={deleteEq?.name}
        warningText="All calibration records for this equipment will also be removed. Are you sure you want to proceed?"
        finalNote="Including all calibration history for this equipment."
        onCancel={() => setDeleteEq(null)}
        onProceedToStep2={() => setDeleteEq(d => ({ ...d, step: 2 }))}
        onConfirmDelete={() => handleDeleteEquipment(deleteEq.id)}
      />
    </div>
  );
}
