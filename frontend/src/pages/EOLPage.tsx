import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { DeviceEOLReference, EOLManufacturer } from '../types';

export const EOLPage: React.FC = () => {
  const { dataRefreshKey, triggerDataRefresh } = useApp();

  const [records, setRecords] = useState<DeviceEOLReference[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [manufacturerFilter, setManufacturerFilter] = useState<string>('');

  // Modal form state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<DeviceEOLReference | null>(null);
  const [formData, setFormData] = useState<{
    manufacturer: string;
    model: string;
    eol_date: string;
  }>({
    manufacturer: '',
    model: '',
    eol_date: '',
  });
  const [formErrors, setFormErrors] = useState<{
    manufacturer?: string;
    model?: string;
    eol_date?: string;
  }>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Delete modal state
  const [recordToDelete, setRecordToDelete] = useState<DeviceEOLReference | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Notification banners
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Auto-dismiss notification
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      setNotification(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Load EOL reference records
  const loadRecords = async () => {
    setLoading(true);
    try {
      const data: any = await api.getEOLReferences();
      const list: DeviceEOLReference[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.records)
        ? data.records
        : [];
      setRecords(list);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'Failed to fetch EOL reference records.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [dataRefreshKey]);

  // Dynamically extract distinct, non-null, non-empty manufacturers from records
  const manufacturerOptions = useMemo(() => {
    const mfrMap = new Map<string, string>(); // lowercase trimmed key -> display name

    for (const record of records) {
      const raw = record?.manufacturer;
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed) {
          const key = trimmed.toLowerCase();
          if (!mfrMap.has(key)) {
            mfrMap.set(key, trimmed);
          }
        }
      }
    }

    // Sort alphabetically (case-insensitive)
    return Array.from(mfrMap.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [records]);

  // Reset manufacturerFilter if the selected manufacturer is no longer present in records
  useEffect(() => {
    if (manufacturerFilter && !loading && manufacturerOptions.length > 0) {
      const normalizedSelected = manufacturerFilter.trim().toLowerCase();
      const exists = manufacturerOptions.some(
        m => m.trim().toLowerCase() === normalizedSelected
      );
      if (!exists) {
        setManufacturerFilter('');
      }
    }
  }, [manufacturerOptions, manufacturerFilter, loading]);

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        r =>
          (typeof r.manufacturer === 'string' && r.manufacturer.toLowerCase().includes(q)) ||
          (typeof r.model === 'string' && r.model.toLowerCase().includes(q))
      );
    }

    if (manufacturerFilter && manufacturerFilter.trim()) {
      const targetMfr = manufacturerFilter.trim().toLowerCase();
      result = result.filter(
        r => typeof r.manufacturer === 'string' && r.manufacturer.trim().toLowerCase() === targetMfr
      );
    }

    // Default sort by Manufacturer, then Model
    result.sort((a, b) => {
      const mComp = (a.manufacturer || '').localeCompare(b.manufacturer || '', undefined, { sensitivity: 'base' });
      if (mComp !== 0) return mComp;
      return (a.model || '').localeCompare(b.model || '', undefined, { sensitivity: 'base' });
    });

    return result;
  }, [records, search, manufacturerFilter]);

  // Format date helper: "DD MMM YYYY"
  const formatDate = (dateString: string): string => {
    if (!dateString) return '—';
    try {
      // Avoid time zone drift by splitting YYYY-MM-DD
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      }
      const d = new Date(dateString);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingRecord(null);
    setFormData({
      manufacturer: '',
      model: '',
      eol_date: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (rec: DeviceEOLReference) => {
    setEditingRecord(rec);
    setFormData({
      manufacturer: rec.manufacturer,
      model: rec.model,
      eol_date: rec.eol_date,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: { manufacturer?: string; model?: string; eol_date?: string } = {};

    if (!formData.manufacturer.trim()) {
      errors.manufacturer = 'Manufacturer is mandatory.';
    }

    const trimmedModel = formData.model.trim();
    if (!trimmedModel) {
      errors.model = 'Hardware model is mandatory.';
    }

    if (!formData.eol_date) {
      errors.eol_date = 'End-of-life (EOL) date is mandatory.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Save / Update
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || submitting) return;

    setSubmitting(true);
    const trimmedManufacturer = formData.manufacturer.trim();
    const trimmedModel = formData.model.trim();

    try {
      if (editingRecord) {
        // Update existing record
        await api.updateEOLReference(editingRecord.eol_id, {
          manufacturer: trimmedManufacturer,
          model: trimmedModel,
          eol_date: formData.eol_date,
        });
        setNotification({
          type: 'success',
          message: `Successfully updated reference date for ${trimmedManufacturer} ${trimmedModel}.`,
        });
      } else {
        // Create new record
        await api.createEOLReference({
          manufacturer: trimmedManufacturer,
          model: trimmedModel,
          eol_date: formData.eol_date,
        });
        setNotification({
          type: 'success',
          message: `Successfully registered EOL reference for ${trimmedManufacturer} ${trimmedModel}.`,
        });
      }

      setIsModalOpen(false);
      await loadRecords();
      triggerDataRefresh();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'Operation failed. Please review your inputs and try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!recordToDelete || deleting) return;

    setDeleting(true);
    try {
      await api.deleteEOLReference(recordToDelete.eol_id);
      setNotification({
        type: 'success',
        message: `Reference for ${recordToDelete.manufacturer} ${recordToDelete.model} has been deleted.`,
      });
      setRecordToDelete(null);
      await loadRecords();
      triggerDataRefresh();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'Failed to delete record. It may be locked by database constraints.',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Manufacturer badge styling helper
  const renderMfrBadge = (mfr: EOLManufacturer | string) => {
    let colorStyle = 'bg-slate-100 text-slate-800 border-slate-200';
    const norm = (mfr || '').trim().toUpperCase();
    if (norm === 'DELL') colorStyle = 'bg-blue-50 text-blue-700 border-blue-200';
    else if (norm === 'HP') colorStyle = 'bg-teal-50 text-teal-700 border-teal-200';
    else if (norm === 'LENOVO') colorStyle = 'bg-red-50 text-red-700 border-red-200';
    else if (norm === 'APPLE') colorStyle = 'bg-purple-50 text-purple-700 border-purple-200';

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono border ${colorStyle}`}>
        {mfr || '—'}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Notification Banner */}
      {notification && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-lg border text-xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search, Filter, and Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white rounded-lg border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search manufacturer or model..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Manufacturer:</span>
          </div>
          <select
            value={manufacturerFilter}
            onChange={e => setManufacturerFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Manufacturers</option>
            {manufacturerOptions.map(mfr => (
              <option key={mfr} value={mfr}>
                {mfr}
              </option>
            ))}
          </select>

          <span className="text-slate-400 font-mono text-[11px] ml-1">
            {filteredRecords.length} {filteredRecords.length === 1 ? 'record' : 'records'}
          </span>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Model</span>
          </button>
        </div>
      </div>

      {/* EOL Reference Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs">Loading EOL reference catalog...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <Clock className="w-10 h-10 text-slate-300 mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No EOL reference records found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
              {search || manufacturerFilter
                ? 'No hardware models match your filter criteria. Try clearing search filters.'
                : 'No device EOL records currently exist in the database catalog. Click "Add New Model" to register your first hardware specification.'}
            </p>
            {search || manufacturerFilter ? (
              <button
                onClick={() => {
                  setSearch('');
                  setManufacturerFilter('');
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
              >
                Clear Filters
              </button>
            ) : (
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Model</span>
              </button>
            )}
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed text-left text-xs border-collapse">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[46%]" />
                <col className="w-[20%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-4">Manufacturer</th>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-4">Model</th>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-4">EOL Date</th>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map(record => (
                  <tr key={record.eol_id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Manufacturer */}
                    <td className="py-2.5 sm:py-3 px-2 sm:px-4 whitespace-nowrap min-w-0">
                      {renderMfrBadge(record.manufacturer)}
                    </td>

                    {/* Model */}
                    <td className="py-2.5 sm:py-3 px-2 sm:px-4 min-w-0">
                      <span className="font-semibold text-slate-900 break-words leading-tight block">
                        {record.model}
                      </span>
                    </td>

                    {/* EOL Date */}
                    <td className="py-2.5 sm:py-3 px-2 sm:px-4 whitespace-nowrap min-w-0">
                      <div className="flex items-center gap-1.5 font-mono font-medium text-slate-800 text-[11px] sm:text-xs">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatDate(record.eol_date)}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 sm:py-3 px-2 sm:px-4 text-right whitespace-nowrap min-w-0">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(record)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                          title="Edit record"
                          aria-label={`Edit ${record.model}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setRecordToDelete(record)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                          title="Delete record"
                          aria-label={`Delete ${record.model}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog: Create or Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
            onClick={() => !submitting && setIsModalOpen(false)}
          />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingRecord ? 'Edit EOL Reference' : 'Add New EOL Model'}
                  </h3>
                </div>
                <button
                  onClick={() => !submitting && setIsModalOpen(false)}
                  disabled={submitting}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSubmitForm} className="p-5 space-y-4 text-xs">
                {/* Field 1: Manufacturer */}
                <div>
                  <label htmlFor="mfr-input" className="block font-semibold text-slate-700 mb-1">
                    Manufacturer <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="mfr-input"
                    type="text"
                    placeholder="e.g. DELL, HP, Lenovo, or Apple"
                    value={formData.manufacturer}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        manufacturer: e.target.value,
                      })
                    }
                    disabled={submitting}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {formErrors.manufacturer && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.manufacturer}</p>
                  )}
                </div>

                {/* Field 2: Model */}
                <div>
                  <label htmlFor="model-input" className="block font-semibold text-slate-700 mb-1">
                    Model <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="model-input"
                    type="text"
                    placeholder="e.g. Latitude 7440 or ThinkPad T14s Gen 4"
                    value={formData.model}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        model: e.target.value,
                      })
                    }
                    disabled={submitting}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {formErrors.model && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.model}</p>
                  )}
                </div>

                {/* Field 3: EOL Date */}
                <div>
                  <label htmlFor="eoldate-input" className="block font-semibold text-slate-700 mb-1">
                    EOL Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="eoldate-input"
                    type="date"
                    value={formData.eol_date}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        eol_date: e.target.value,
                      })
                    }
                    disabled={submitting}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Past or future date representing official vendor support obsolescence.
                  </p>
                  {formErrors.eol_date && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.eol_date}</p>
                  )}
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={submitting}
                    className="px-3.5 py-1.5 text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded-md font-semibold transition-colors disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{editingRecord ? 'Update' : 'Save'}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
            onClick={() => !deleting && setRecordToDelete(null)}
          />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all p-5 text-xs">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-full shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Delete EOL Reference?</h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-slate-600 mb-4 leading-relaxed">
                Are you sure you want to permanently delete the reference record for{' '}
                <span className="font-semibold text-slate-900">
                  {recordToDelete.manufacturer} {recordToDelete.model}
                </span>{' '}
                (EOL Date: {formatDate(recordToDelete.eol_date)})?
              </p>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRecordToDelete(null)}
                  disabled={deleting}
                  className="px-3.5 py-1.5 text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-white bg-rose-600 hover:bg-rose-700 rounded-md font-semibold transition-colors disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete Record</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
