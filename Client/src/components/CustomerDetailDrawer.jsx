import { useEffect, useState } from "react";
import { fetchCaseDetails, submitDisposition } from "@/api/agentApi";
import { useAuth } from "@/context/AuthContext";
import { DISPOSITIONS, requiresFollowUp } from "@/lib/dispositions";

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
      {value ?? "-"}
    </p>
  </div>
);

/* ---------- Main ---------- */

const CustomerDetailDrawer = ({
  caseId,
  isOpen,
  onClose,
  onDispositionSubmitted,
}) => {
  const { token } = useAuth();

  const [caseData, setCaseData] = useState(null);
  const [dispositions, setDispositions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form state (ONLY required addition)
  const [selectedDisposition, setSelectedDisposition] = useState("");
  const [remarks, setRemarks] = useState("");
  const [promiseAmount, setPromiseAmount] = useState(""); // ✅ ADDED
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && caseId) {
      loadCaseDetails();
    }
  }, [isOpen, caseId]);

  const loadCaseDetails = async () => {
    try {
      setLoading(true);
      const res = await fetchCaseDetails(caseId, token);
      const data = res.case || {};

      if (typeof data.extra_fields === "string") {
        try {
          data.extra_fields = JSON.parse(data.extra_fields);
        } catch {}
      }

      setCaseData(data);
      setDispositions(res.dispositions || []);

      // reset form
      setSelectedDisposition("");
      setRemarks("");
      setPromiseAmount(""); // ✅ ADDED
      setFollowUpDate("");
      setFollowUpTime("");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDisposition = async (e) => {
    e.preventDefault();

    // 🔒 REQUIRED VALIDATIONS
    if (!selectedDisposition) {
      alert("Please select a disposition");
      return;
    }

    if (!promiseAmount) {
      alert("Promise amount is required");
      return;
    }

    if (
      requiresFollowUp(selectedDisposition) &&
      (!followUpDate || !followUpTime)
    ) {
      alert("Follow-up date and time are required");
      return;
    }

    try {
      setSubmitting(true);

      await submitDisposition(
        caseId,
        {
          disposition: selectedDisposition,
          remarks,
          promiseAmount, // ✅ SENT TO BACKEND
          followUpDate: requiresFollowUp(selectedDisposition)
            ? followUpDate
            : null,
          followUpTime: requiresFollowUp(selectedDisposition)
            ? followUpTime
            : null,
        },
        token
      );

      await loadCaseDetails();
      onDispositionSubmitted?.();
    } catch {
      alert("Failed to submit disposition");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

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
            <button onClick={onClose} className="text-xl">✕</button>
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
                  <Field label="Outstanding Amount" value={caseData.amt_outst} />
                  <Field label="Tenure" value={caseData.tenure} />
                </Section>

                {/* CASE INFO */}
                <Section title="Case Information">
                  <Field label="Status" value={caseData.status} />
                  <Field label="Allocation Date" value={caseData.allocation_date} />
                  <Field label="First Call" value={caseData.first_call_at} />
                  <Field label="Last Call" value={caseData.last_call_at} />
                  <Field label="Follow-up Date" value={caseData.follow_up_date} />
                  <Field label="Follow-up Time" value={caseData.follow_up_time} />
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
                        {dispositions.map((d, i) => (
                          <div key={i} className="p-3 border rounded space-y-1">
                            <div className="flex justify-between items-start">
                              <strong>{d.disposition}</strong>

                              {/* EDIT BUTTON */}
                              <button
                                type="button"
                                className="text-xs text-indigo-600 hover:underline cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation(); // CRITICAL
                                  setSelectedDisposition(d.disposition);
                                  setPromiseAmount(d.promise_amount || "");
                                  setRemarks(""); // keep old remarks
                                }}
                              >
                                Edit
                              </button>

                            </div>

                            <p className="text-xs text-slate-500">
                              {new Date(d.created_at).toLocaleString("en-IN")}
                            </p>

                            {d.remarks && <p>{d.remarks}</p>}

                            {d.promise_amount && (
                              <p className="text-sm text-slate-700">
                                Promise Amount: <strong>₹{d.promise_amount}</strong>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                {/* SUBMIT DISPOSITION */}
                {caseData.status !== "DONE" && (
                  <Section title="Submit Disposition">
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
                          placeholder="Remarks"
                          rows={4}
                          className="w-full border rounded px-3 py-2 resize-none"
                        />
                      </div>

                      <div className="space-y-3 text-sm">
                        <input
                          type="number"
                          placeholder="Promise / Amount"
                          value={promiseAmount}
                          onChange={(e) =>
                            setPromiseAmount(e.target.value)
                          }
                          className="w-full border rounded px-3 py-2"
                        />

                        {requiresFollowUp(selectedDisposition) && (
                          <div className="flex gap-3">
                            <input
                              type="date"
                              value={followUpDate}
                              onChange={(e) =>
                                setFollowUpDate(e.target.value)
                              }
                              className="border rounded px-2 py-1"
                            />
                            <input
                              type="time"
                              value={followUpTime}
                              onChange={(e) =>
                                setFollowUpTime(e.target.value)
                              }
                              className="border rounded px-2 py-1"
                            />
                          </div>
                        )}

                        <div className="flex justify-end pt-17">
                          <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                          >
                            {submitting ? "..." : "Submit"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </Section>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CustomerDetailDrawer;
