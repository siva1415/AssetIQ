import React, { useState } from 'react';
import { X, CalendarPlus, Loader2, AlertCircle } from 'lucide-react';
import { Asset } from '../../types';
import { api } from '../../services/api';

interface EditEolModalProps {
  asset: Asset;
  onClose: () => void;
  onSuccess: (updatedEolDate: string, message: string) => void;
}

export const EditEolModal: React.FC<EditEolModalProps> = ({
  asset,
  onClose,
  onSuccess,
}) => {
  const [eolDate, setEolDate] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const manufacturer = asset.manufacturer || '';
  const model = asset.model || '';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setDateError(null);
    setSubmitError(null);

    // Validate EOL Date
    const trimmedDate = eolDate.trim();
    if (!trimmedDate) {
      setDateError('EOL Date is required. Please select a valid date.');
      return;
    }

    // Basic date validity check
    const parsedDate = new Date(trimmedDate);
    if (isNaN(parsedDate.getTime())) {
      setDateError('Please enter a valid date in YYYY-MM-DD format.');
      return;
    }

    setSubmitting(true);
    try {
      await api.saveEOLReference({
        manufacturer: manufacturer.trim(),
        model: model.trim(),
        eol_date: trimmedDate,
        reference_source: 'Manual Administrator Entry',
      });

      onSuccess(
        trimmedDate,
        `EOL date (${trimmedDate}) successfully registered for ${manufacturer} ${model}.`
      );
    } catch (err: any) {
      let msg = 'Failed to save EOL reference date. Please try again.';
      if (err?.response?.data?.detail) {
        const detail = err.response.data.detail;
        msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
      } else if (err?.message) {
        msg = err.message;
      }
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={e => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/75 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <CalendarPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">Add EOL Date</h3>
              <p className="text-[11px] text-slate-500">Register lifecycle reference for device model</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Submission Error Banner */}
          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{submitError}</div>
            </div>
          )}

          {/* Manufacturer (Read-Only) */}
          <div className="space-y-1.5">
            <label htmlFor="eol-mfr" className="block text-xs font-bold text-slate-700">
              Manufacturer
            </label>
            <input
              id="eol-mfr"
              type="text"
              value={manufacturer}
              readOnly
              disabled
              tabIndex={-1}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium select-none cursor-not-allowed"
            />
          </div>

          {/* Model (Read-Only) */}
          <div className="space-y-1.5">
            <label htmlFor="eol-model" className="block text-xs font-bold text-slate-700">
              Model
            </label>
            <input
              id="eol-model"
              type="text"
              value={model}
              readOnly
              disabled
              tabIndex={-1}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium select-none cursor-not-allowed"
            />
          </div>

          {/* EOL Date (Editable Date Picker) */}
          <div className="space-y-1.5">
            <label htmlFor="eol-date-input" className="block text-xs font-bold text-slate-800">
              EOL Date <span className="text-rose-500">*</span>
            </label>
            <input
              id="eol-date-input"
              type="date"
              value={eolDate}
              onChange={e => {
                setEolDate(e.target.value);
                if (dateError) setDateError(null);
              }}
              required
              className={`w-full px-3 py-2 text-xs bg-white border rounded-md shadow-2xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                dateError ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300'
              }`}
            />
            {dateError && (
              <p className="text-[11px] text-rose-600 font-medium mt-1">{dateError}</p>
            )}
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !eolDate.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
