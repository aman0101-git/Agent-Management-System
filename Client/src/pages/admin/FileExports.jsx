import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import AdminNavbar from "@/components/AdminNavbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileSpreadsheet, Table, Calendar, Download, AlertCircle } from "lucide-react";

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
    <div className="min-h-screen bg-slate-50/50">
      <AdminNavbar />

      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Data Exports
          </h1>
          <p className="mt-2 text-slate-500">
            Download comprehensive system reports or individual table data.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          
          {/* ===============================
              MODE 1 UI: FULL DATABASE
             =============================== */}
          <Card className="border-slate-200 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="pb-4">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">Full Database Export</CardTitle>
              <CardDescription>
                Download a single Excel file containing all system tables, PTP, and PRT reports.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errorFull && (
                <div className="mb-4 flex items-center gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-600">
                  <AlertCircle className="h-4 w-4" />
                  {errorFull}
                </div>
              )}
              
              <div className="mt-4 rounded-lg bg-slate-50 p-4 border border-slate-100 mb-6">
                <p className="text-xs text-slate-500">
                  <strong>Note:</strong> This process might take a few moments depending on the data size. Please do not close the window.
                </p>
              </div>

              <Button
                onClick={handleFullExport}
                disabled={loadingFull}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md hover:from-rose-600 hover:to-pink-700 hover:shadow-lg transition-all"
              >
                {loadingFull ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                    Generating File...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download Complete Excel
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* ===============================
              MODE 2 UI: TABLE EXPORT
             =============================== */}
          <Card className="border-slate-200 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="pb-4">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Table className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">Specific Table Export</CardTitle>
              <CardDescription>
                Export raw data from a specific table with optional date filtering.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                
                {/* Select Table */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Select Table</label>
                  <select
                    value={table}
                    onChange={(e) => setTable(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {TABLES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, ' ').toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Range Inputs */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> From Date
                    </label>
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> To Date
                    </label>
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {errorTable && (
                  <div className="flex items-center gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-600">
                    <AlertCircle className="h-4 w-4" />
                    {errorTable}
                  </div>
                )}

                <Button
                  onClick={handleTableExport}
                  disabled={loadingTable}
                  className="w-full mt-2 bg-indigo-600 text-white shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all"
                >
                  {loadingTable ? "Exporting CSV..." : "Export CSV Data"}
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
};

export default FileExports;