import { useEffect, useState } from "react";
import {
  fetchCaseDetails,
  submitDisposition,
  fetchNextCase,
  startCustomerVisit,
  endCustomerVisit,
  fetchCustomerVisitHistory,
} from "@/api/agentApi";
import { useAuth } from "@/context/AuthContext";
import { DISPOSITIONS, requiresAmountAndDate } from "@/lib/dispositions";

/* ---------- Reusable UI ---------- */

const Section = ({ title, children }) => (
  <div className="space-y-4 border-b pb-6 last:border-b-0">
    <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
      {children}
    </div>
  </div>
);

const Field = ({ label, value }) => (
  <div>
    <p className="text-slate-500 mb-1">{label}</p>
    <p className="font-medium text-slate-900 break-words">
      {value || "-"}
    </p>
  </div>
);

/* ---------- Main ---------- */

const formatFollowUp = (date, time) => {
  if (!date) return "";

  let d;

  // Case 1: date is already ISO (contains T)
  if (typeof date === "string" && date.includes("T")) {
    d = new Date(date);
  }
  // Case 2: date + time are separate
  else if (time) {
    d = new Date(`${date}T${time}`);
  }
  // Case 3: date only
  else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) return "";

  const formattedDate = d.toLocaleDateString("en-GB"); // DD/MM/YYYY
  const formattedTime = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${formattedDate} at ${formattedTime}`;
};

const CustomerDetailDrawer = ({
  caseId,
  isOpen,
  onClose,
  onDispositionSubmitted,
}) => {
  const { token } = useAuth();

  const [caseData, setCaseData] = useState(null);
  const [dispositions, setDispositions] = useState([]);
  const [editHistory, setEditHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [showEditHistoryModal, setShowEditHistoryModal] = useState(false);
  const [visitId, setVisitId] = useState(null);
  const [visitHistory, setVisitHistory] = useState([]);

  // Form state
  const [selectedDisposition, setSelectedDisposition] = useState("");
  const [remarks, setRemarks] = useState("");
  const [promiseAmount, setPromiseAmount] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingAgentCaseId, setEditingAgentCaseId] = useState(null);

  useEffect(() => {
    if (isOpen && caseId) {
      loadCaseDetails();
    }
  }, [isOpen, caseId]);

  // Start a visit when drawer opens (agent clicks New / opens drawer)
  useEffect(() => {
    let mounted = true;
    const startVisit = async () => {
      if (!isOpen || !caseId) return;
      try {
        const res = await startCustomerVisit(caseId, token);
        if (mounted && res?.visit_id) setVisitId(res.visit_id);
      } catch (err) {
        console.error('Failed to start visit', err);
      }
    };

    startVisit();

    return () => { mounted = false; };
  }, [isOpen, caseId, token]);

  const loadCaseDetails = async () => {
    try {
      setLoading(true);
      const res = await fetchCaseDetails(caseId, token);
      const data = res.case || {};

      if (typeof data.extra_fields === "string") {
        try {
          data.extra_fields = JSON.parse(data.extra_fields);
        } catch { /* ignore parse errors for extra_fields */ }
      }

      setCaseData(data);
      setDispositions(res.dispositions || []);
      setEditHistory(res.editHistory || []);
      // Load visit history for this customer
      try {
        const hist = await fetchCustomerVisitHistory(caseId, token);
        setVisitHistory(hist.history || []);
      } catch (err) {
        console.error('Failed to fetch visit history', err);
      }
      setShowEditHistory(false);

      // Reset form
      setSelectedDisposition("");
      setRemarks("");
      setPromiseAmount("");
      setFollowUpDate("");
      setFollowUpTime("");
      setIsEditing(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDisposition = async (e) => {
    e.preventDefault();

    if (!selectedDisposition) {
      alert("Please select a disposition");
      return;
    }

    // Validate amount and date-time only for dispositions that require them
    if (
      requiresAmountAndDate(selectedDisposition) &&
      (!promiseAmount || !followUpDate || !followUpTime)
    ) {
      alert("Amount, follow-up date and time are required for this disposition");
      return;
    }

    try {
      setSubmitting(true);

      const res = await submitDisposition(
        caseId,
        {
          disposition: selectedDisposition,
          remarks,
          promiseAmount: requiresAmountAndDate(selectedDisposition)
            ? promiseAmount
            : null,
          followUpDate: requiresAmountAndDate(selectedDisposition)
            ? followUpDate
            : null,
          followUpTime: requiresAmountAndDate(selectedDisposition)
            ? followUpTime
            : null,
          isEdit: isEditing,
          agentCaseId: editingAgentCaseId,
        },
        token
      );

      // If status changed, allocate next customer
      if (res.allocateNext || res.allocateNextOnStatusChange) {
        try {
          await fetchNextCase(token);
        } catch { /* allocation attempt failed; nothing required client-side */ }
      }

      // Ensure we end visit when disposition submitted successfully
      if (visitId) {
        try {
          await endCustomerVisit(visitId, token);
        } catch (err) {
          console.error('Failed to end visit after disposition', err);
        } finally {
          setVisitId(null);
        }
      }

      // Reload case details
      await loadCaseDetails();
      onDispositionSubmitted?.();

    } catch (err) {
      console.error(err);
      alert("Failed to submit disposition");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditDisposition = (disposition) => {
    setSelectedDisposition(disposition.disposition);
    setPromiseAmount(disposition.promise_amount || "");
    setFollowUpDate(disposition.follow_up_date ? disposition.follow_up_date.split('T')[0] : "");
    setFollowUpTime(disposition.follow_up_time || "");
    setRemarks(disposition.remarks || "");
    setIsEditing(true);
    setEditingAgentCaseId(disposition.agent_case_id);
  };

  // Handle drawer close: end visit if active, then call parent onClose
  const handleInternalClose = async () => {
    if (visitId) {
      try {
        await endCustomerVisit(visitId, token);
      } catch (err) {
        console.error('Failed to end visit on close', err);
      } finally {
        setVisitId(null);
      }
    }
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={handleInternalClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="relative w-full max-w-6xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col">
          {/* Header */}
          <div className="border-b px-6 py-4 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">
                {caseData?.customer_name || "Case Details"}
              </h2>
              <p className="text-sm text-slate-500">
                {caseData?.phone || "-"} • {caseData?.loan_id || "-"}
              </p>
            </div>
            <button onClick={handleInternalClose} className="text-xl">✕</button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {loading && <p>Loading…</p>}

            {!loading && caseData && (
              <div className="space-y-10">

                {/* CUSTOMER + LOAN */}
                <Section title="Customer Information">
                  <Field label="Customer Name" value={caseData.customer_name} />
                  <Field label="Phone" value={caseData.phone} />
                  <Field label="Loan ID" value={caseData.loan_id} />
                  <Field label="Branch" value={caseData.branch_name} />
                  <Field label="Product" value={caseData.product_code} />
                  <Field label="Penalty Over" value={caseData.penal_over} />
                  <Field label="Loan Status" value={caseData.loan_status} />
                  <Field label="DPD" value={caseData.dpd} />
                  <Field label="POS" value={caseData.pos} />
                  <Field label="Installment Amount" value={caseData.insl_amt} />
                  <Field label="Bom Bucket" value={caseData.bom_bucket} />
                  <Field label="Tenure" value={caseData.tenure} />
                </Section>

                {/* CASE INFO */}
                <Section title="Case Information">
                  <Field label="Status" value={caseData.status} />
                  <Field label="Allocation Date" value={formatFollowUp(caseData.allocation_date)} />
                  <Field label="First Call" value={formatFollowUp(caseData.first_call_at)} />
                  <Field label="Last Call" value={formatFollowUp(caseData.last_call_at)} />
                  <Field label="Follow-up Date and Time" value={formatFollowUp(caseData.follow_up_date)} />
                </Section>

                <Section title="Other Information">
                  <Field label="Group Name" value={caseData.group_name} />
                  <Field label="Residence Address" value={caseData.res_addr} />
                  <Field label="Office Address" value={caseData.off_addr} />
                  <Field label="Disbursement Date" value={caseData.disb_date} />
                  <Field label="FDD" value={caseData.fdd} />
                </Section>

                <Section title="Data Information">
                  <Field label="Agent ID" value={caseData.agent_id} />
                  <Field label="Batch Month" value={caseData.batch_month} />
                  <Field label="Batch Year" value={caseData.batch_year} />
                  <Field label="Campaign ID" value={caseData.campaign_id} />
                  <Field label="Is Active" value={caseData.is_active} />
                </Section>

                {/* DISPOSITION HISTORY */}
                {dispositions.length > 0 && (
                  <Section title="Disposition History">
                    <div className="col-span-full space-y-3">

                      {/* 🔹 LATEST DISPOSITION */}
                      {(() => {
                        const latest = dispositions[0];

                        return (
                          <div className="p-4 border rounded bg-white space-y-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <strong className="text-slate-900">
                                  {latest.disposition}
                                </strong>
                                <p className="text-xs text-slate-500 mt-1">
                                  {latest.created_at ? new Date(latest.created_at).toLocaleString("en-IN") : "-"}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="text-xs text-indigo-600 hover:underline font-medium"
                                onClick={() => handleEditDisposition(latest)}
                              >
                                Edit
                              </button>
                            </div>

                            {latest.remarks && (
                              <p className="text-sm">{latest.remarks}</p>
                            )}

                            {latest.promise_amount && (
                              <p className="text-sm">
                                Amount:{" "}
                                <strong>
                                  ₹{parseFloat(latest.promise_amount).toFixed(2)}
                                </strong>
                              </p>
                            )}

                            {latest.follow_up_date && (
                              <p className="text-sm">
                                Follow-up: {formatFollowUp(latest.follow_up_date, latest.follow_up_time)}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                        {/* SUBMIT DISPOSITION */}
                      {/* 🔹 PREVIOUS EDITS TOGGLE */}
                      {dispositions.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowEditHistory(!showEditHistory)}
                            className="text-sm font-medium text-indigo-700 hover:underline"
                          >
                            {showEditHistory
                              ? "Hide previous edits"
                              : `View previous edits (${dispositions.length - 1})`}
                          </button>

                          {showEditHistory && (
                            <div className="space-y-2 pt-2">
                              {dispositions.slice(1).map((d, i) => (
                                <div
                                  key={i}
                                  className="p-3 border rounded bg-slate-50 text-sm space-y-1"
                                >
                                  <p className="text-xs text-slate-500">
                                    {d.created_at ? new Date(d.created_at).toLocaleString("en-IN") : "-"}
                                  </p>

                                  <p>
                                    <span className="font-medium">Disposition:</span>{" "}
                                    {d.disposition}
                                  </p>

                                  {d.remarks && (
                                    <p>
                                      <span className="font-medium">Remarks:</span>{" "}
                                      {d.remarks}
                                    </p>
                                  )}

                                  {d.promise_amount && (
                                    <p>
                                      <span className="font-medium">Amount:</span>{" "}
                                      ₹{parseFloat(d.promise_amount).toFixed(2)}
                                    </p>
                                  )}

                                  {d.follow_up_date && (
                                    <p>
                                      <span className="font-medium">Follow-up:</span>{" "}
                                      {formatFollowUp(d.follow_up_date)} {formatFollowUp(d.follow_up_time)}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </Section>
                )}

                {/* SUBMIT DISPOSITION */}
                {caseData.status !== "DONE" && (
                  <Section title={isEditing ? "Edit Disposition" : "Submit Disposition"}>
                    <form
                      onSubmit={handleSubmitDisposition}
                      className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6"
                    >
                      <div className="space-y-3 text-sm">
                        <select
                          value={selectedDisposition}
                          onChange={(e) =>
                            setSelectedDisposition(e.target.value)
                          }
                          className="w-full border rounded px-3 py-2"
                        >
                          <option value="">Select Disposition</option>
                          {Object.values(DISPOSITIONS).map((d) => (
                            <option key={d.code} value={d.code}>
                              {d.code} - {d.name}
                            </option>
                          ))}
                        </select>

                        <textarea
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="Remarks (optional)"
                          rows={4}
                          className="w-full border rounded px-3 py-2 resize-none"
                        />
                      </div>

                      <div className="space-y-3 text-sm">
                        {/* CONDITIONALLY SHOW AMOUNT AND DATE-TIME */}
                        {requiresAmountAndDate(selectedDisposition) && (
                          <>
                            <input
                              type="number"
                              placeholder="Promise Amount (₹)"
                              value={promiseAmount}
                              onChange={(e) => setPromiseAmount(e.target.value)}
                              className="w-full border rounded px-3 py-2"
                              step="0.01"
                            />

                            <div className="flex gap-3">
                              <input
                                type="date"
                                value={followUpDate}
                                onChange={(e) => setFollowUpDate(e.target.value)}
                                className="flex-1 border rounded px-2 py-1"
                              />
                              <input
                                type="time"
                                value={followUpTime}
                                onChange={(e) => setFollowUpTime(e.target.value)}
                                className="flex-1 border rounded px-2 py-1"
                              />
                            </div>
                          </>
                        )}

                        {!requiresAmountAndDate(selectedDisposition) && selectedDisposition && (
                          <p className="text-xs text-slate-500 italic">
                            No amount or date-time required for this disposition
                          </p>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditing(false);
                                setSelectedDisposition("");
                                setRemarks("");
                                setPromiseAmount("");
                                setFollowUpDate("");
                                setFollowUpTime("");
                              }}
                              className="px-4 py-2 text-xs rounded border border-slate-300 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                          >
                            {submitting ? "..." : isEditing ? "Update" : "Submit"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </Section>
                )}

                {/* VISIT HISTORY */}
                <Section title="Visit History">
                  <div className="col-span-full max-h-40 overflow-y-auto space-y-2">
                    {visitHistory.length === 0 && (
                      <p className="text-sm text-slate-500">No visits yet</p>
                    )}

                    {visitHistory.map((v, i) => (
                      <div
                        key={i}
                        className="p-2 border rounded bg-slate-50 text-sm flex justify-between items-start"
                      >
                        <div>
                          <p className="text-xs text-slate-500">Agent</p>
                          <p className="font-semibold">{v.username}</p>

                          <p className="text-xs text-slate-500 mt-1">Entry</p>
                          <p className="font-medium">
                            {v.entry_time
                              ? new Date(v.entry_time).toLocaleString()
                              : "-"}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-slate-500">Exit</p>
                          <p className="font-medium">
                            {v.exit_time
                              ? new Date(v.exit_time).toLocaleString()
                              : v.entry_time
                              ? "In Progress"
                              : "-"}
                          </p>
                        </div>
                      </div>

                    ))}
                  </div>
                </Section>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* EDIT HISTORY MODAL */}
      {showEditHistoryModal && editHistory.length > 1 && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/50" 
            onClick={() => setShowEditHistoryModal(false)} 
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
              {/* Header */}
              <div className="border-b px-6 py-4 flex justify-between items-center">
                <h3 className="text-lg font-semibold">Previous Edits</h3>
                {editHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowEditHistoryModal(true)}
                    className="text-sm font-medium text-indigo-700 hover:underline"
                  >
                    View full edit history
                  </button>
                )}
                <button 
                  onClick={() => setShowEditHistoryModal(false)} 
                  className="text-xl"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
                {editHistory.slice(0, -1).reverse().map((edit, i) => (
                  <div key={i} className="p-4 bg-slate-50 border rounded text-sm space-y-2">
                    <p className="text-xs text-slate-500 font-medium">
                      {new Date(edit.edited_at).toLocaleString("en-IN")}
                    </p>
                    <div className="space-y-1">
                      <p><span className="font-medium">Disposition:</span> {edit.disposition}</p>
                      {edit.remarks && <p><span className="font-medium">Remarks:</span> {edit.remarks}</p>}
                      {edit.promise_amount && (
                        <p><span className="font-medium">Amount:</span> ₹{parseFloat(edit.promise_amount).toFixed(2)}</p>
                      )}
                      {edit.follow_up_date && (
                        <p><span className="font-medium">Follow-up:</span> {edit.follow_up_date} at {edit.follow_up_time}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t px-6 py-4 flex justify-end">
                <button 
                  onClick={() => setShowEditHistoryModal(false)}
                  className="px-4 py-2 text-sm rounded bg-slate-200 hover:bg-slate-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default CustomerDetailDrawer;
