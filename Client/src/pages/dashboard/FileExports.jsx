import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useState } from "react";

/* ===============================
   MODE 2 CONFIG
   =============================== */
const TABLES = [
  "agent_cases",
  "agent_dispositions",
  "agent_dispositions_edit_history",
  "agent_targets",
  "campaigns",
  "campaign_agents",
  "customer_once_constraints",
  "coll_data",
  "users",
];

const FileExports = () => {
  const { token } = useAuth();

  /* ===============================
     MODE 1 STATE (FULL EXPORT)
     =============================== */
  const [loadingFull, setLoadingFull] = useState(false);
  const [errorFull, setErrorFull] = useState("");

  /* ===============================
     MODE 2 STATE (TABLE EXPORT)
     =============================== */
  const [table, setTable] = useState("agent_cases");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loadingTable, setLoadingTable] = useState(false);
  const [errorTable, setErrorTable] = useState("");

  /* ===============================
     MODE 1 HANDLER
     =============================== */
  const handleFullExport = async () => {
    setLoadingFull(true);
    setErrorFull("");
    try {
      const res = await fetch("/api/admin/exports", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const fileName =
        res.headers
          .get("Content-Disposition")
          ?.split("filename=")[1]
          ?.replace(/"/g, "") || "full_database_export.xlsx";

      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setErrorFull("Failed to export full database.");
    } finally {
      setLoadingFull(false);
    }
  };

  /* ===============================
     MODE 2 HANDLER
     =============================== */
  const handleTableExport = async () => {
    setLoadingTable(true);
    setErrorTable("");
    try {
      const params = new URLSearchParams({ table });
      if (from) params.append("from", from);
      if (to) params.append("to", to);

      const res = await fetch(`/api/admin/exports/table?${params}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const fileName =
        res.headers
          .get("Content-Disposition")
          ?.split("filename=")[1]
          ?.replace(/"/g, "") || `${table}.csv`;

      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setErrorTable("Failed to export table.");
    } finally {
      setLoadingTable(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-xl space-y-10">

        {/* ===============================
            MODE 1 UI
           =============================== */}
        <section>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            Full Database Export
          </h1>
          <p className="text-sm text-slate-600 mb-4">
            Downloads one Excel file containing all tables and the PTP/PRT report.
          </p>

          {errorFull && (
            <div className="text-sm text-rose-600 mb-3">{errorFull}</div>
          )}

          <Button
            onClick={handleFullExport}
            disabled={loadingFull}
            className="bg-gradient-to-r from-pink-500 to-rose-500 text-white"
          >
            {loadingFull ? "Exporting..." : "Download Excel"}
          </Button>
        </section>

        <hr />

        {/* ===============================
            MODE 2 UI
           =============================== */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Table Export (With Date Range)
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Export a single table as CSV for a selected time period.
          </p>

          <label className="block text-sm font-medium mb-1">Select Table</label>
          <select
            value={table}
            onChange={e => setTable(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-4"
          >
            {TABLES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">From</label>
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">To</label>
              <input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
            </div>
          </div>

          {errorTable && (
            <div className="text-sm text-rose-600 mb-3">{errorTable}</div>
          )}

          <Button
            onClick={handleTableExport}
            disabled={loadingTable}
            className="bg-indigo-600 text-white"
          >
            {loadingTable ? "Exporting..." : "Export CSV"}
          </Button>
        </section>

      </div>
    </div>
  );
};

export default FileExports;
