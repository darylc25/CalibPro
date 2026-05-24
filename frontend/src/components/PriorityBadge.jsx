import React from 'react';
import { getPriority } from '../api/index.js';

export default function PriorityBadge({ nextCal, priority: explicitPriority }) {
  const priority = explicitPriority || getPriority(nextCal);
  const map = {
    overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-700 border border-red-200' },
    due_soon: { label: 'Due Soon', cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
    scheduled: { label: 'Scheduled', cls: 'bg-green-100 text-green-700 border border-green-200' },
    unknown: { label: 'No Record', cls: 'bg-gray-100 text-gray-500 border border-gray-200' },
  };
  const { label, cls } = map[priority] || map.unknown;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}
