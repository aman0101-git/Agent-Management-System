import { useEffect, useState, useRef } from "react";
// Import Agent APIs
import {
  fetchCaseDetails as fetchAgentCaseDetails,
  submitDisposition as submitAgentDisposition,
  fetchNextCase,
  startCustomerVisit as startAgentVisit,
  endCustomerVisit as endAgentVisit,
  fetchCustomerVisitHistory as fetchAgentVisitHistory,
  fetchOnceConstraints as fetchAgentConstraints,
} from "@/api/agentApi";
// Import Admin APIs
import {
  fetchAdminCaseDetails,
  submitAdminDisposition,
  startAdminCustomerVisit,
  endAdminCustomerVisit,
  fetchAdminCustomerVisitHistory,
  fetchAdminOnceConstraints,
} from "@/api/adminApi";

import { useAuth } from "@/context/AuthContext";
import { DISPOSITIONS, requiresAmountAndDate, requiresAmount, requiresDateOnly, requiresPaymentDate } from "@/lib/dispositions";

/* ---------- Reusable UI ---------- */

const Section = ({ title, children, badge }) => (
  <div className="space-y-4 border-b pb-6 last:border-b-0">
    <div className="flex items-center gap-3">
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      {badge && <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">{badge}</span>}
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
      {children}
    </div>
  </div>
);

const Field = ({ label, value, highlight }) => (
  <div>
    <p className="text-slate-500 mb-1 text-xs uppercase tracking-wide">{label}</p>
    <p className={`font-medium break-words ${highlight ? 'text-indigo-700 text-base' : 'text-slate-900'}`}>
      {value || "-"}
    </p>
  </div>
);

/* ---------- Main ---------- */

const formatFollowUp = (date, time) => {
  if (!date) return "";
  let d;
  if (typeof date === "string" && date.includes("T")) {
    d = new Date(date);
  } else if (time) {
    d = new Date(`${date}T${time}`);
  } else {
    d = new Date(date);
  }
  if (isNaN(d.getTime())) return "";

  const formattedDate = d.toLocaleDateString("en-GB"); 
  const formattedTime = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${formattedDate} at ${formattedTime}`;
};

const formatDateOnly = (dateStr) => {
  if (!dateStr) return "-";
  let d;
  if (typeof dateStr === "string" && dateStr.includes("T")) {
    d = new Date(dateStr);
  } else {
    d = new Date(dateStr);
  }
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB"); 
};

const CustomerDetailDrawer = ({
  caseId,
  isOpen,
  onClose,
  onDispositionSubmitted,
  isAdmin = false // <--- ADDED ISADMIN PROP
}) => {
  const { token } = useAuth();

  const [caseData, setCaseData] = useState(null);
  const [dispositions, setDispositions] = useState([]);
  const [editHistory, setEditHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [showEditHistoryModal, setShowEditHistoryModal] = useState(false);
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
  const [ptpTarget, setPtpTarget] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentTime, setPaymentTime] = useState("");
  
  const paymentDateDispositions = ['PIF', 'SIF', 'FCL'];
  const shouldShowPaymentDate = paymentDateDispositions.includes(selectedDisposition);

  const [onceConstraints, setOnceConstraints] = useState({});

  // === STRICT MODE ANTI-DUPLICATE GUARDS ===
  const hasStartedVisitRef = useRef(false);
  const activeVisitIdRef = useRef(null);

  // 1. Constraints API logic
  useEffect(() => {
    const loadOnceConstraints = async () => {
      if (isOpen && caseData?.id) {
        const fetchConstraintsApi = isAdmin ? fetchAdminOnceConstraints : fetchAgentConstraints;
        try {
          const res = await fetchConstraintsApi(caseData.id, token);
          const map = {};
          (res.constraints || []).forEach((c) => {
            map[c.constraint_type] = c.triggered_at;
          });
          setOnceConstraints(map);
        } catch (err) {
          setOnceConstraints({});
        }
      } else {
        setOnceConstraints({});
      }
    };
    loadOnceConstraints();
  }, [isOpen, caseData?.id, token, isAdmin]);
  
  // 2. Load Case Details when opened
  useEffect(() => {
    if (isOpen && caseId) {
      loadCaseDetails();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, caseId]);

  // 3. ROCK SOLID VISIT TRACKING (No Duplicates)
  useEffect(() => {
    if (isOpen && caseId && !hasStartedVisitRef.current) {
      hasStartedVisitRef.current = true; // Lock immediately to prevent double fires
      
      const startVisitApi = isAdmin ? startAdminCustomerVisit : startAgentVisit;
      
      startVisitApi(caseId, token)
        .then(res => {
          if (res?.visit_id) {
            activeVisitIdRef.current = res.visit_id;
          }
        })
        .catch(err => console.error('Failed to start visit', err));
    }

    // Cleanup: Only run when the drawer is actually closing
    return () => {
      if (!isOpen && hasStartedVisitRef.current) {
        if (activeVisitIdRef.current) {
          const endVisitApi = isAdmin ? endAdminCustomerVisit : endAgentVisit;
          endVisitApi(activeVisitIdRef.current, token).catch(err => 
            console.error('Failed to end visit', err)
          );
          activeVisitIdRef.current = null; // Clear ID
        }
        hasStartedVisitRef.current = false; // Unlock for next open
      }
    };
  }, [isOpen, caseId, token, isAdmin]);
  
  const loadCaseDetails = async () => {
    try {
      setLoading(true);
      const fetchDetailsApi = isAdmin ? fetchAdminCaseDetails : fetchAgentCaseDetails;
      const res = await fetchDetailsApi(caseId, token);
      const data = res.case || {};

      if (typeof data.extra_fields === "string") {
        try { data.extra_fields = JSON.parse(data.extra_fields); } catch { /* ignore parse errors */ }
      }

      setCaseData(data);
      setDispositions(res.dispositions || []);
      setEditHistory(res.editHistory || []);
      
      try {
        const fetchHistoryApi = isAdmin ? fetchAdminCustomerVisitHistory : fetchAgentVisitHistory;
        const hist = await fetchHistoryApi(caseId, token);
        setVisitHistory(hist.history || []);
      } catch (err) {
        console.error('Failed to fetch visit history', err);
      }
      setShowEditHistory(false);
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedDisposition("");
    setRemarks("");
    setPromiseAmount("");
    setFollowUpDate("");
    setFollowUpTime("");
    setPtpTarget("");
    setPaymentDate("");
    setPaymentTime("");
    setIsEditing(false);
    setEditingAgentCaseId(null);
  };

  const handleSubmitDisposition = async (e) => {
    e.preventDefault();

    if (!selectedDisposition) { alert("Please select a disposition"); return; }

    if (requiresAmount(selectedDisposition) && !promiseAmount) {
      alert("Promise amount is required for this disposition"); return;
    }

    if (requiresAmountAndDate(selectedDisposition) || selectedDisposition === "PRT") {
      if (!followUpDate) { alert("Follow-up date is required for this disposition"); return; }
      if (!followUpTime) { alert("Follow-up time is required for this disposition"); return; }
    }

    if ((shouldShowPaymentDate || (selectedDisposition === 'PRT' && requiresPaymentDate('PRT'))) && (!paymentDate || !paymentTime)) {
      alert('Payment date and time are required for this disposition'); return;
    }

    try {
      setSubmitting(true);

      const submissionData = {
        disposition: selectedDisposition,
        remarks,
        promiseAmount: requiresAmount(selectedDisposition) ? promiseAmount : null,
        followUpDate: requiresAmountAndDate(selectedDisposition) ? followUpDate : null,
        followUpTime: requiresAmountAndDate(selectedDisposition) ? followUpTime : null,
        ptpTarget: selectedDisposition === 'PTP' ? ptpTarget : null,
        paymentDate: (shouldShowPaymentDate || (selectedDisposition === 'PRT' && requiresPaymentDate('PRT'))) ? paymentDate : null,
        paymentTime: (shouldShowPaymentDate || (selectedDisposition === 'PRT' && requiresPaymentDate('PRT'))) ? paymentTime : null,
        isEdit: isEditing,
        agentCaseId: editingAgentCaseId,
      };

      const submitDispApi = isAdmin ? submitAdminDisposition : submitAgentDisposition;
      const res = await submitDispApi(caseId, submissionData, token);

      if (!isAdmin && (res.allocateNext || res.allocateNextOnStatusChange)) {
        try { await fetchNextCase(token); } catch { /* allocation attempt failed */ }
      }

      // Manually trigger the end visit API so it registers immediately before data reload
      if (activeVisitIdRef.current) {
        const endVisitApi = isAdmin ? endAdminCustomerVisit : endAgentVisit;
        await endVisitApi(activeVisitIdRef.current, token).catch(console.error);
        activeVisitIdRef.current = null;
        hasStartedVisitRef.current = false;
      }

      await loadCaseDetails();
      onDispositionSubmitted?.();

    } catch (err) {
      console.error('Disposition submission error:', err);
      if (err.errors && Array.isArray(err.errors)) {
        alert(`Validation failed:\n\n${err.errors.join('\n')}`);
      } else if (err.message) {
        alert(`Error: ${err.message}`);
      } else {
        alert("Failed to submit disposition");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditDisposition = (d) => {
    setIsEditing(true);
    setEditingAgentCaseId(d.agent_case_id || null);
    setSelectedDisposition(d.disposition || "");
    setRemarks(d.remarks || "");
    setPromiseAmount(d.promise_amount || "");
    setFollowUpDate(d.follow_up_date ? d.follow_up_date.split("T")[0] : "");
    setFollowUpTime(d.follow_up_time || "");
    setPtpTarget(d.ptp_target || "");
    setPaymentDate(d.payment_date ? d.payment_date.split("T")[0] : "");
    setPaymentTime(d.payment_time || "");

    document.getElementById("disposition-form")?.scrollIntoView({ behavior: "smooth" });
  };

  // We no longer manually call endVisit here; setting isOpen to false via onClose triggers the useEffect cleanup automatically.
  const handleInternalClose = () => {
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm" onClick={handleInternalClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
        <div className="relative w-full max-w-6xl h-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="bg-slate-50 border-b px-8 py-5 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-800">
                  {caseData?.customer_name || "Case Details"}
                </h2>
                {caseData?.status && (
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${caseData.status === 'DONE' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {caseData.status}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-slate-500 mt-1">
                📞 {caseData?.phone || "-"} &nbsp;•&nbsp; 📄 Loan: {caseData?.loan_id || "-"}
              </p>
            </div>
            <button onClick={handleInternalClose} className="text-slate-400 hover:text-slate-700 transition-colors p-2 rounded-full hover:bg-slate-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-8 py-6 bg-white">
            {loading && (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            )}

            {!loading && caseData && (
              <div className="space-y-10">

                {/* FINANCIAL SNAPSHOT */}
                <Section title="Financial Snapshot" badge="Primary Info">
                  <Field label="Amount Finance" value={caseData.amount_finance ? `₹${caseData.amount_finance}` : "₹0"} />
                  <Field label="POS" value={caseData.pos ? `₹${caseData.pos}` : "₹0"} highlight />
                  <Field label="Installment Amount" value={caseData.insl_amt ? `₹${caseData.insl_amt}` : "₹0"} />
                  <Field label="Installment Over" value={caseData.inst_over ? `₹${caseData.inst_over}` : "₹0"} />
                  <Field label="Penalty Over" value={caseData.penal_over ? `₹${caseData.penal_over}` : "₹0"} />
                  <Field label="Amount Outstanding" value={caseData.amt_outst ? `₹${caseData.amt_outst}` : "₹0"} highlight />                
                  <Field label="TOS" value={caseData.tos ? `₹${caseData.tos}` : "-"} />
                  <Field label="BOM Bucket" value={caseData.bom_bucket} />
                  <Field label="Tenure" value={caseData.tenure ? `${caseData.tenure} Months` : "-"} />
                  <Field label="Branch" value={caseData.branch_name} />
                  <Field label="Penalty Interest" value={caseData.penal_intrst ? `₹${caseData.penal_intrst}` : "-"} />
                  <Field label="Cheque Bounce Charge" value={caseData.chq_bnc_chrg ? `₹${caseData.chq_bnc_chrg}` : "-"} />                 
                  <Field label="Last Paid Amount" value={caseData.last_paid_amount ? `₹${caseData.last_paid_amount}` : "-"} />
                  <Field label="Last Paid Date" value={formatDateOnly(caseData.last_paid_date)} />
                  <Field label="EMI Pending Count" value={caseData.emi_pending_count} />
                  <Field label="SIF Allowed" value={caseData.sif_allowed} />
                </Section>

                {/* LOAN DETAILS */}
                <Section title="Loan Details">
                  <Field label="Application ID" value={caseData.appl_id} />
                  <Field label="Child Loan 1" value={caseData.child_loan1} />
                  <Field label="Child Loan 2" value={caseData.child_loan2} />
                  <Field label="Product Code" value={caseData.product_code} />
                  <Field label="Product ID" value={caseData.product_id} />
                  <Field label="DPD" value={caseData.dpd} />
                  <Field label="Loan Status" value={caseData.loan_status} />                 
                  <Field label="Disbursement Date" value={formatDateOnly(caseData.disb_date)} />
                  <Field label="Maturity Date" value={formatDateOnly(caseData.maturity_date)} />
                  <Field label="FDD" value={formatDateOnly(caseData.fdd)} />
                  <Field label="Fresh Vintage Regular" value={caseData.fresh_vintage_regular} />
                </Section>

                {/* BANK & ASSET DETAILS */}
                <Section title="Bank & Asset Details">
                  <Field label="Bank Name" value={caseData.bank_name} />
                  <Field label="Reason Bounce Cheque" value={caseData.reason_bounc_chek} />
                  <Field label="Asset Category" value={caseData.asset_category} />
                  <Field label="Asset Description" value={caseData.asset_desc} />
                  <Field label="Disbursal Dealer" value={caseData.disb_dlr_name} />
                  <Field label="Max Txn Entry Date" value={formatDateOnly(caseData.max_txn_entry_date)} />
                  <Field label="Days Diff Max Txn" value={caseData.days_diff_max_txn_dt} />
                  <Field label="Month Diff Exp Dt" value={caseData.month_diff_exp_dt} />
                </Section>

                {/* CONTACT & DEMOGRAPHICS */}
                <Section title="Contact & Demographics">
                  <Field label="Mobile No" value={caseData.phone || caseData.mobileno} highlight />
                  <Field label="Alt Contact 1" value={caseData.contact_no1} />
                  <Field label="Res. Phone" value={caseData.ph_no_res} />
                  <Field label="DOB" value={formatDateOnly(caseData.dob)} />
                  <Field label="Current Org" value={caseData.current_org} />
                  <Field label="Group Name" value={caseData.group_name} />
                  <Field label="Residence Address" value={caseData.res_addr} />
                  <Field label="Office Address" value={caseData.off_addr} />
                  <Field label="State" value={caseData.state} />
                </Section>

                {/* TRACKING & AGENCY */}
                <Section title="Tracking & Agency">
                  <Field label="Agency" value={caseData.agency} />
                  <Field label="Hub Name" value={caseData.hub_name} />
                  <Field label="Allocation Date" value={formatFollowUp(caseData.allocation_date)} />
                  <Field label="First Call" value={formatFollowUp(caseData.first_call_at)} />
                  <Field label="Last Call" value={formatFollowUp(caseData.last_call_at)} />
                  <Field label="Scheduled Follow-up" value={formatFollowUp(caseData.follow_up_date, caseData.follow_up_time)} highlight />
                  <Field label="Old PTP Date" value={formatDateOnly(caseData.ptp_date)} />
                  <Field label="Old Feedback" value={caseData.feedback} />
                </Section>

                {/* SYSTEM DATA */}
                <Section title="System Data">
                  <Field label="Customer ID" value={caseData.cust_id} />
                  <Field label="Agent ID" value={caseData.agent_id} />
                  <Field label="Campaign ID" value={caseData.campaign_id} />
                  <Field label="Batch Month/Year" value={`${caseData.batch_month || '-'} / ${caseData.batch_year || '-'}`} />
                  <Field label="Is Active" value={caseData.is_active === 1 ? "Yes" : "No"} />
                </Section>

                {/* DISPOSITION HISTORY (SMART RENDER) */}
                {dispositions.length > 0 && (
                  <Section title="Interaction History">
                    <div className="col-span-full space-y-4">
                      {/* LATEST DISPOSITION WITH SMART ACTIONS */}
                      {(() => {
                        const latest = dispositions[0];
                        const isPTP = latest.disposition === 'PTP';
                        const isPRT = latest.disposition === 'PRT';
                        const isTerminal = ['PIF', 'SIF', 'FCL'].includes(latest.disposition);

                        return (
                          <div className={`p-5 border-2 rounded-xl ${isPTP ? 'border-amber-200 bg-amber-50' : isPRT ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Latest Status</span>
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${isPTP ? 'bg-amber-200 text-amber-800' : isPRT ? 'bg-blue-200 text-blue-800' : 'bg-slate-200 text-slate-800'}`}>
                                    {latest.disposition}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-600 mt-2">
                                  Recorded on: <span className="font-medium">{latest.created_at ? new Date(latest.created_at).toLocaleString("en-IN") : "-"}</span>
                                  {latest.agent_name && <span className="ml-2 text-indigo-600 font-semibold">(by {latest.agent_name})</span>}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              {latest.promise_amount && (
                                <div><p className="text-xs text-slate-500">Amount</p><p className="font-bold text-slate-900">₹{parseFloat(latest.promise_amount).toFixed(2)}</p></div>
                              )}
                              {latest.follow_up_date && (
                                <div className="col-span-2"><p className="text-xs text-slate-500">Follow-up Scheduled</p><p className="font-bold text-slate-900">{formatFollowUp(latest.follow_up_date, latest.follow_up_time)}</p></div>
                              )}
                              {latest.ptp_target && (
                                <div><p className="text-xs text-slate-500">PTP Target</p><p className="font-bold text-slate-900">{latest.ptp_target}</p></div>
                              )}
                            </div>
                            {latest.remarks && <p className="mt-3 text-sm text-slate-700 italic border-l-2 border-slate-300 pl-2">"{latest.remarks}"</p>}

                            {/* BUTTON BLOCK */}
                            {(isPTP || isPRT || isTerminal) && !isEditing && (
                              <div className="mt-4 pt-4 border-t border-slate-200/60 flex flex-wrap gap-3">
                                
                                {isPTP && caseData.status !== "DONE" && (
                                  <button onClick={() => handleEditDisposition(latest)} className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition shadow-sm">
                                    ✏️ Update Active PTP (Change Date/Amount)
                                  </button>
                                )}
                                
                                {isPRT && caseData.status !== "DONE" && (
                                  <button onClick={() => handleEditDisposition(latest)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
                                    📅 Extend PRT Follow-up Date
                                  </button>
                                )}
                                
                                {isTerminal && (
                                  <button onClick={() => handleEditDisposition(latest)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition shadow-sm">
                                    ✏️ Correct Final Settlement Amount
                                  </button>
                                )}
                                
                                {caseData.status !== "DONE" && (
                                  <p className="text-xs text-slate-500 self-center">
                                    Or use the form below to log a brand new status.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* OLDER EDITS & HISTORY */}
                      {dispositions.length > 1 && (
                        <div className="mt-5 border-t border-slate-200/60 pt-4">
                          <button 
                            type="button" 
                            onClick={() => setShowEditHistory(!showEditHistory)} 
                            className="group flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                          >
                            <span className={`transform transition-transform duration-200 ${showEditHistory ? 'rotate-90' : ''}`}>
                              ▶
                            </span>
                            {showEditHistory ? "Hide Past Interactions" : `View Past Interactions (${dispositions.length - 1})`}
                          </button>
                          
                          {showEditHistory && (
                            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                              {dispositions.slice(1).map((d, i) => {
                                const isPTP = d.disposition === 'PTP';
                                const isPRT = d.disposition === 'PRT';
                                const isTerminal = ['PIF', 'SIF', 'FCL'].includes(d.disposition);
                                const badgeClass = isPTP 
                                  ? 'bg-amber-100 text-amber-800 border-amber-200' 
                                  : isPRT 
                                  ? 'bg-blue-100 text-blue-800 border-blue-200' 
                                  : isTerminal 
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                                  : 'bg-slate-100 text-slate-700 border-slate-200';

                                const dateObj = d.created_at ? new Date(d.created_at) : null;
                                const dateStr = dateObj ? dateObj.toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' }) : "-";
                                const timeStr = dateObj ? dateObj.toLocaleTimeString("en-IN", { hour: 'numeric', minute: '2-digit', hour12: true }) : "";

                                return (
                                  <div 
                                    key={i} 
                                    className="flex items-center gap-3 sm:gap-4 p-2.5 sm:px-4 sm:py-3 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 hover:border-indigo-200 transition-all shadow-sm group"
                                  >
                                    {/* Date & Time */}
                                    <div className="flex-shrink-0 w-24 sm:w-28 flex flex-col">
                                      <span className="text-xs font-bold text-slate-700">{dateStr}</span>
                                      <span className="text-[10px] font-medium text-slate-500">{timeStr}</span>
                                      {d.agent_name && <span className="text-[10px] font-semibold text-indigo-600 truncate">{d.agent_name}</span>}
                                    </div>

                                    {/* Disposition Badge */}
                                    <div className="flex-shrink-0 w-14 sm:w-16">
                                      <span className={`flex items-center justify-center px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border ${badgeClass}`}>
                                        {d.disposition}
                                      </span>
                                    </div>

                                    {/* Remarks */}
                                    <div className="flex-1 min-w-0">
                                      {d.remarks ? (
                                        <p className="text-xs sm:text-sm text-slate-600 truncate" title={d.remarks}>
                                          {d.remarks}
                                        </p>
                                      ) : (
                                        <p className="text-xs text-slate-400 italic">No remarks</p>
                                      )}
                                    </div>

                                    {/* Amount / Context Data */}
                                    <div className="flex-shrink-0 w-20 sm:w-28 text-right">
                                      {d.promise_amount ? (
                                        <p className="text-xs sm:text-sm font-bold text-slate-800">
                                          ₹{parseFloat(d.promise_amount).toFixed(2)}
                                        </p>
                                      ) : d.ptp_target ? (
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                          Tgt: {d.ptp_target}
                                        </p>
                                      ) : (
                                        <span className="text-slate-300">-</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                {/* DISPOSITION FORM */}
                {(caseData.status !== "DONE" || isEditing) && (
                  <div id="disposition-form" className={`scroll-mt-6 p-6 rounded-xl border-2 transition-all duration-300 ${isEditing ? 'border-indigo-400 bg-indigo-50/30 shadow-md' : 'border-slate-200 bg-slate-50/50'}`}>
                    <div className="mb-4">
                      <h3 className={`text-lg font-bold flex items-center gap-2 ${isEditing ? 'text-indigo-800' : 'text-slate-800'}`}>
                        {isEditing ? (
                          <><span>✏️ Updating Existing State:</span> <span className="bg-indigo-200 px-2 py-0.5 rounded text-sm">{selectedDisposition}</span></>
                        ) : isAdmin ? "🛠️ Admin Override: Submit New Disposition" : "📝 Submit New Disposition"}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {isEditing 
                          ? "You are updating a previously logged status. This will NOT add duplicate amounts to analytics." 
                          : isAdmin ? "As an Admin, your submission will be logged under your account." : "Logging a new disposition will overwrite the current active status and add new financial events."}
                      </p>
                    </div>

                    <form onSubmit={handleSubmitDisposition} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Select Outcome</label>
                          <select value={selectedDisposition} onChange={(e) => setSelectedDisposition(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 text-sm bg-white">
                            <option value="">-- Choose Disposition --</option>
                            {Object.values(DISPOSITIONS).map((d) => (
                              <option key={d.code} value={d.code}>{d.code} - {d.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Remarks</label>
                          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Detailed notes about the conversation..." rows={3} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 text-sm resize-none bg-white" />
                        </div>
                      </div>

                      <div className="space-y-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        
                        {requiresAmount(selectedDisposition) && (
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Promise / Payment Amount</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">₹</span>
                              <input type="number" placeholder="0.00" value={promiseAmount} onChange={(e) => setPromiseAmount(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm pl-8 p-2.5 text-sm font-medium focus:border-indigo-500 focus:ring-indigo-500" step="0.01" />
                            </div>
                          </div>
                        )}

                        {(requiresAmountAndDate(selectedDisposition) || selectedDisposition === "PRT") && (
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Follow up Date & Time</label>
                            <div className="flex gap-2">
                              <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="flex-1 border-slate-300 rounded-lg shadow-sm p-2.5 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                              <input type="time" value={followUpTime} onChange={(e) => setFollowUpTime(e.target.value)} className="w-1/3 border-slate-300 rounded-lg shadow-sm p-2.5 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </div>
                          </div>
                        )}

                        {(shouldShowPaymentDate || (selectedDisposition === 'PRT' && requiresPaymentDate('PRT'))) && (
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Actual Payment Date & Time</label>
                            <div className="flex gap-2">
                              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="flex-1 border-slate-300 rounded-lg shadow-sm p-2.5 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                              <input type="time" value={paymentTime} onChange={(e) => setPaymentTime(e.target.value)} className="w-1/3 border-slate-300 rounded-lg shadow-sm p-2.5 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </div>
                          </div>
                        )}

                        {selectedDisposition === 'PTP' && (
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">PTP Target</label>
                            <select value={ptpTarget} onChange={(e) => setPtpTarget(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 text-sm">
                              <option value="">Select Target Type</option>
                              <option value="SIF">SIF - Settled In Full</option>
                              <option value="PIF">PIF - Paid In Full</option>
                              <option value="FCL">FCL - Foreclosure</option>
                              <option value="PRT">PRT - Part Payment</option>
                            </select>
                          </div>
                        )}

                        {!requiresAmountAndDate(selectedDisposition) && !shouldShowPaymentDate && selectedDisposition !== 'PTP' && selectedDisposition !== '' && (
                          <div className="flex items-center justify-center h-full text-slate-400 italic text-sm text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            No financial or follow-up data required for {selectedDisposition}
                          </div>
                        )}
                      </div>

                      <div className="col-span-full flex justify-end gap-3 mt-4 pt-4 border-t border-slate-200">
                        {isEditing && (
                          <button type="button" onClick={resetForm} className="px-6 py-2.5 text-sm font-medium rounded-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors">
                            Cancel Edit Mode
                          </button>
                        )}
                        <button type="submit" disabled={submitting} className={`px-8 py-2.5 text-sm font-bold rounded-lg text-white shadow-lg transition-all ${submitting ? 'bg-indigo-400 cursor-not-allowed' : isEditing ? 'bg-amber-600 hover:bg-amber-700 hover:shadow-amber-500/30' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/30'}`}>
                          {submitting ? "Processing..." : isEditing ? "Save Updated Data" : "Submit New Status"}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* RESTORED & ENHANCED: VISIT HISTORY */}
                <Section title="Visit History" badge={visitHistory.length > 0 ? `${visitHistory.length} Visits` : null}>
                  <div className="col-span-full max-h-48 overflow-y-auto pr-3 custom-scrollbar space-y-2">
                    {visitHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-sm font-medium text-slate-500">No visit history recorded yet</p>
                      </div>
                    ) : (
                      <div className="relative border-l-2 border-indigo-100 ml-3 pl-5 space-y-3 py-1">
                        {visitHistory.map((v, i) => {
                          const inProgress = v.entry_time && !v.exit_time;

                          let durationStr = "";
                          if (v.entry_time && v.exit_time) {
                            const diffMs = new Date(v.exit_time) - new Date(v.entry_time);
                            const diffMins = Math.round(diffMs / 60000);
                            if (diffMins < 60) durationStr = `${diffMins}m`;
                            else durationStr = `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
                          }

                          const entryTime = v.entry_time ? new Date(v.entry_time).toLocaleTimeString("en-IN", { hour: 'numeric', minute: '2-digit', hour12: true }) : "-";
                          const exitTime = v.exit_time ? new Date(v.exit_time).toLocaleTimeString("en-IN", { hour: 'numeric', minute: '2-digit', hour12: true }) : "-";
                          const dateStr = v.entry_time ? new Date(v.entry_time).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' }) : "";

                          return (
                            <div key={i} className="relative group">
                              <div className={`absolute -left-[27px] top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-[2px] border-white shadow-sm ${inProgress ? 'bg-green-500 animate-pulse' : 'bg-indigo-400'}`}></div>
                              
                              <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${inProgress ? 'bg-green-50/40 border-green-200 shadow-sm' : 'bg-white border-slate-200 hover:shadow-sm hover:border-indigo-200'}`}>
                                
                                <div className="flex items-center gap-4 sm:gap-6 overflow-hidden">
                                  <div className="flex items-center gap-2 min-w-[120px]">
                                    <div className={`p-1 rounded-full ${inProgress ? 'bg-green-100 text-green-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                    <p className="font-semibold text-slate-800 text-sm truncate">{v.username}</p>
                                  </div>

                                  <div className="flex items-center gap-3 text-xs hidden sm:flex">
                                    <span className="text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">{dateStr}</span>
                                    <span className="text-slate-600">
                                      {entryTime} <span className="text-slate-400 mx-1">→</span> 
                                      {inProgress ? <span className="text-green-600 font-bold animate-pulse">Active</span> : exitTime}
                                    </span>
                                    {durationStr && (
                                      <span className="text-slate-400 flex items-center gap-1 border-l pl-3 ml-1">
                                        ⏱ <span className="text-slate-600 font-medium">{durationStr}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <span className={`flex-shrink-0 ml-4 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded border ${v.disposition ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                  {v.disposition || "Viewed Only"}
                                </span>

                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
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