import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const exportTypes = [
  { value: 'ONCE_PTP', label: 'ONCE_PTP (One-time PTP)' },
  { value: 'ONCE_PRT', label: 'ONCE_PRT (One-time PRT)' },
  { value: 'AGENT_DISPOSITIONS', label: 'Agent Dispositions' },
  { value: 'AGENT_CASES', label: 'Agent Cases' },
];

const FileExports = () => {
  const { token } = useAuth();
  const [exportType, setExportType] = useState('ONCE_PTP');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loadingExport, setLoadingExport] = useState(false);
  const [errorExport, setErrorExport] = useState('');

  const handleExport = async () => {
    setLoadingExport(true);
    setErrorExport('');
    try {
      const params = new URLSearchParams();
      params.append('type', exportType);
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      const url = `/api/admin/exports?${params.toString()}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const fileName = res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'export.xlsx';
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setErrorExport('Failed to export file. Please try again.');
    } finally {
      setLoadingExport(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 flex flex-col items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-xl font-semibold mb-4 text-slate-900">File Exports</h1>
        <p className="mb-6 text-sm text-slate-600">Export MySQL database tables to Excel files.</p>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Export Type</label>
          <select
            value={exportType}
            onChange={e => setExportType(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            {exportTypes.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="mb-4 flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
        </div>
        {errorExport && <div className="text-sm text-rose-600 mb-2">{errorExport}</div>}
        <div className="flex justify-end gap-2 mt-6">
          <Button onClick={handleExport} disabled={loadingExport} className="bg-gradient-to-r from-pink-500 to-rose-500 text-white">
            {loadingExport ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FileExports;
