import React from 'react';

// Shared modal shell: backdrop + white container + standard header (title/subtitle + close).
// `children` is everything below the header — for form modals that's the whole <form>...</form>
// (its own internal Cancel/Save row stays untouched); for plain-div modals, pass `footer` too.
export default function BaseModal({
  title, subtitle, onClose, children, footer,
  maxWidth = 'max-w-lg', zIndex = 40,
  headerActions, containerClassName = '', subtitleClassName = 'text-gray-500',
  footerClassName = 'justify-end',
}) {
  return (
    <div className={`fixed inset-0 ${zIndex === 50 ? 'z-50' : 'z-40'} flex items-center justify-center bg-black/40 p-4`}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} ${containerClassName}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            {subtitle && <p className={`text-xs mt-0.5 ${subtitleClassName}`}>{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
        </div>
        {children}
        {footer && (
          <div className={`px-6 py-4 border-t flex items-center gap-3 ${footerClassName}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
