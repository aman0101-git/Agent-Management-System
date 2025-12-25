import { useEffect, useState } from "react";
import { fetchCustomerDetails } from "@/api/agentApi";
import { useAuth } from "@/context/AuthContext";

/* ---------- Reusable UI ---------- */

const Section = ({ title, children }) => (
  <div className="space-y-4 border-b pb-6 last:border-b-0">
    <h3 className="text-lg font-semibold text-slate-800">
      {title}
    </h3>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
      {children}
    </div>
  </div>
);

const Field = ({ label, value }) => (
  <div>
    <p className="text-slate-500 mb-1">
      {label}
    </p>
    <p className="font-medium text-slate-900 break-words">
      {value || "-"}
    </p>
  </div>
);

/* ---------- Main ---------- */

const CustomerDetailDrawer = ({ customerId, isOpen, onClose }) => {
  const { token } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && customerId) loadCustomer();
  }, [isOpen, customerId]);

  const loadCustomer = async () => {
    try {
      setLoading(true);
      const res = await fetchCustomerDetails(customerId, token);
      const data = res.data;

      if (typeof data.extra_fields === "string") {
        data.extra_fields = JSON.parse(data.extra_fields);
      }

      setCustomer(data);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="relative w-full max-w-6xl h-[85vh] rounded-2xl bg-white shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4 rounded-t-2xl">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {customer?.cust_name || "Customer Details"}
              </h2>
              <p className="text-sm text-slate-500">
                Mobile: {customer?.mobileno || "-"}
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="h-[calc(85vh-72px)] overflow-y-auto px-6 py-6">
            {loading && (
              <p className="text-slate-500">
                Loading customer details…
              </p>
            )}

            {!loading && customer && (
              <div className="space-y-10">
                <Section title="Customer Information">
                  <Field label="Name" value={customer.cust_name} />
                  <Field label="Mobile" value={customer.mobileno} />
                  <Field label="Customer ID" value={customer.id} />
                  <Field label="Loan ID" value={customer.loan_agreement_no} />
                </Section>

                <Section title="Loan Details">
                  <Field label="Outstanding Amount" value={customer.amt_outst} />
                  <Field label="DPD" value={customer.dpd} />
                  <Field label="EMI Pending" value={customer.emi_pending_count} />
                  <Field label="POS" value={customer.pos} />
                  <Field label="Last Paid Amount" value={customer.last_paid_amount} />
                  <Field label="Last Paid Date" value={customer.last_paid_date} />
                </Section>

                <Section title="Address & Contact">
                  <Field label="State" value={customer.state} />
                  <Field label="Residential Address" value={customer.res_addr} />
                  <Field label="Office Address" value={customer.off_addr} />
                  <Field label="Residential Phone" value={customer.ph_no_res} />
                  <Field label="Contact No 1" value={customer.contact_no1} />
                </Section>

                <Section title="Personal Details">
                  <Field label="DOB" value={customer.dob} />
                  <Field label="Current Organization" value={customer.current_org} />
                </Section>

                <Section title="Product Details">
                  <Field label="Product ID" value={customer.product_id} />
                  <Field label="Asset Category" value={customer.asset_category} />
                  <Field label="Asset Description" value={customer.asset_desc} />
                  <Field label="Installment Amount" value={customer.insl_amt} />
                  <Field label="Installment Over" value={customer.inst_over} />
                  <Field label="Bom Bucket" value={customer.bom_bucket} />
                  <Field label="Penalty Over" value={customer.penal_over} />
                  <Field label="Branch Name" value={customer.branch_name} />
                </Section>

                {customer.extra_fields && (
                  <Section title="Additional Information">
                    {Object.entries(customer.extra_fields).map(
                      ([key, value]) => (
                        <Field
                          key={key}
                          label={formatLabel(key)}
                          value={value}
                        />
                      )
                    )}
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

const formatLabel = (key) =>
  key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default CustomerDetailDrawer;
