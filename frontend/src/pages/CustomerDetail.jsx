import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, formatDate } from '../api/index.js';
import PriorityBadge from '../components/PriorityBadge.jsx';
import AddEquipmentModal from '../components/AddEquipmentModal.jsx';
import RecordCalibrationModal from '../components/RecordCalibrationModal.jsx';
import { useToast } from '../components/Toast.jsx';

const STATES = ['Kuala Lumpur','Selangor','Penang','Johor','Sabah','Sarawak','Perak','Pahang','Terengganu','Kedah','Kelantan','Melaka','Negeri Sembilan'];

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [showEquipment, setShowEquipment] = useState(false);
  const [showCal, setShowCal] = useState(null);
  const [editCal, setEditCal] = useState(null);
  const [deleteEqId, setDeleteEqId] = useState(null);

  function load() {
    api.getCustomer(id).then(d => {
      setData(d);
      setForm({ name: d.name, contact_person: d.contact_person || '', email: d.email || '', phone: d.phone || '', address: d.address || '', location: d.location || '', state: d.state || '' });
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

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
      await api.createEquipment(eqForm);
      toast('Equipment added');
      setShowEquipment(false);
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
      setDeleteEqId(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  if (loading) return <div className="p-8 text-center text-sm text-gray-400">Loading…</div>;
  if (!data) return <div className="p-8 text-center text-sm text-gray-400">Customer not found</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/customers')} className="text-sm text-gray-500 hover:text-gray-900">← Customers</button>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900">{data.name}</span>
      </div>

      {/* Customer Info Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Customer Info</h2>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">Edit</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveCustomer} className="text-sm px-3 py-1.5 text-white rounded-lg hover:opacity-90" style={{ background: '#0D2847' }}>Save</button>
            </div>
          )}
        </div>
        {editing ? (
          <div className="grid grid-cols-2 gap-4">
            {[['name', 'Name *'], ['contact_person', 'Contact Person'], ['email', 'Email'], ['phone', 'Phone'], ['address', 'Address'], ['location', 'Location']].map(([field, label]) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                <input value={form[field]} onChange={set(field)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">State</label>
              <select value={form.state} onChange={set('state')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                <option value="">Select…</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            {[['Contact', data.contact_person], ['Email', data.email], ['Phone', data.phone], ['State', data.state], ['Address', data.address], ['Location', data.location]].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs text-gray-400 font-medium">{label}</p>
                <p className="text-gray-900 mt-0.5">{val || '—'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Equipment */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Equipment ({data.equipment?.length ?? 0})</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowCal({ customerId: id })}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">
              📋 Record Calibration
            </button>
            <button onClick={() => setShowEquipment(true)}
              className="text-sm px-3 py-1.5 text-white rounded-lg hover:opacity-90" style={{ background: '#0D2847' }}>
              + Add Equipment
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b">
                {['Equipment', 'Model', 'Serial No', 'Modules', 'Status', 'Last Cal', 'Next Cal', 'Priority', ''].map(h => (
                  <th key={h} className="text-left py-2 pr-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.equipment || []).length === 0 ? (
                <tr><td colSpan={9} className="py-6 text-center text-gray-400">No equipment added yet</td></tr>
              ) : data.equipment.map(eq => (
                <tr key={eq.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-3 font-medium text-gray-900">{eq.equipment_name}</td>
                  <td className="py-2 pr-3 text-gray-600">{eq.model || '—'}</td>
                  <td className="py-2 pr-3 text-gray-600 font-mono text-xs">{eq.serial_number || '—'}</td>
                  <td className="py-2 pr-3 text-gray-600 text-xs max-w-32 truncate">{eq.modules || '—'}</td>
                  <td className="py-2 pr-3 text-gray-600">{eq.status || '—'}</td>
                  <td className="py-2 pr-3 text-gray-600">{formatDate(eq.last_cal)}</td>
                  <td className="py-2 pr-3 text-gray-600">{formatDate(eq.next_cal)}</td>
                  <td className="py-2 pr-3"><PriorityBadge nextCal={eq.next_cal} /></td>
                  <td className="py-2">
                    <button onClick={() => setDeleteEqId(eq.id)}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">Delete</button>
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
                    <button
                      onClick={() => setEditCal(cr)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50">
                      Edit
                    </button>
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

      {deleteEqId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="font-bold text-gray-900 mb-2">Delete Equipment?</h3>
            <p className="text-sm text-gray-500 mb-4">All calibration records for this equipment will also be deleted.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteEqId(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDeleteEquipment(deleteEqId)} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
