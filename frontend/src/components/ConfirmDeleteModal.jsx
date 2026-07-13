import React from 'react';

// Two-step delete confirmation, shared by individual + bulk customer/equipment deletes.
// step: 1 = first warning, 2 = final irreversible confirmation. Renders nothing otherwise.
export default function ConfirmDeleteModal({
  step, title, itemLabel, warningText, finalNote,
  confirmLabel = 'Yes, Delete', finalLabel = 'Permanently Delete',
  onCancel, onProceedToStep2, onConfirmDelete,
}) {
  if (step === 1) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-xl p-6 w-96">
          <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
          {itemLabel && (
            <>
              <p className="text-sm text-gray-500 mb-1">You are about to delete:</p>
              <p className="text-sm font-semibold text-gray-800 mb-4 bg-gray-50 px-3 py-2 rounded-lg">{itemLabel}</p>
            </>
          )}
          <p className="text-sm text-gray-500 mb-4">{warningText}</p>
          <div className="flex gap-3 justify-end">
            <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={onProceedToStep2} className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600">{confirmLabel}</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-xl p-6 w-96 border-2 border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600 text-lg">⚠️</span>
            <h3 className="font-bold text-red-700">Final Confirmation</h3>
          </div>
          {itemLabel ? (
            <>
              <p className="text-sm text-gray-600 mb-1">This action <strong>cannot be undone</strong>. Permanently delete:</p>
              <p className="text-sm font-semibold text-gray-800 mb-4 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{itemLabel}</p>
              {finalNote && <p className="text-xs text-gray-400 mb-4">{finalNote}</p>}
            </>
          ) : (
            <p className="text-sm text-gray-600 mb-4">{finalNote}</p>
          )}
          <div className="flex gap-3 justify-end">
            <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={onConfirmDelete} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 font-semibold">{finalLabel}</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
