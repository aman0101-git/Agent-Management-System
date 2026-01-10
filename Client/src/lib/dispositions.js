/**
 * Disposition codes and their descriptions (Client-side)
 * Categorized by resulting status
 */
export const DISPOSITIONS = {
  // FOLLOW_UP Status - Show Date-Time and Amount
  PTP: {
    code: 'PTP',
    name: 'Promise To Pay',
    description: 'Customer promised to pay on a specific date',
    status: 'FOLLOW_UP',
    showAmountAndDate: true,
  },
  PRT: {
    code: 'PRT',
    name: 'Part Payment',
    description: 'Customer made a partial payment',
    status: 'FOLLOW_UP',
    showAmountAndDate: true, // Amount and follow-up date/time required
    showPaymentDate: true,   // Payment date/time also required
  },
  FCL: {
    code: 'FCL',
    name: 'Foreclosure',
    description: 'Loan foreclosure initiated',
    status: 'FOLLOW_UP',
    showAmountAndDate: 'amountOnly', // Only amount required
  },
  CBC: {
    code: 'CBC',
    name: 'Call Back Confirmed',
    description: 'Callback confirmed from customer',
    status: 'FOLLOW_UP',
    showAmountAndDate: 'dateOnly', // ISSUE #9 FIX: CBC needs date/time but NO amount
  },

  // IN_PROGRESS Status - NO Date-Time and Amount
  BRP: {
    code: 'BRP',
    name: 'Broken Promise',
    description: 'Customer broke their previous promise to pay',
    status: 'IN_PROGRESS',
    showAmountAndDate: false,
  },
  RTP: {
    code: 'RTP',
    name: 'Refuse To Pay',
    description: 'Customer refuses to pay the loan amount',
    status: 'IN_PROGRESS',
    showAmountAndDate: false,
  },
  TPC: {
    code: 'TPC',
    name: 'Third Party Call',
    description: 'Need to contact third party/guarantor',
    status: 'IN_PROGRESS',
    showAmountAndDate: false,
  },
  LNB: {
    code: 'LNB',
    name: 'Language Barrier',
    description: 'Communication blocked due to language barrier',
    status: 'IN_PROGRESS',
    showAmountAndDate: false,
  },
  VOI: {
    code: 'VOI',
    name: 'Voice Issue',
    description: 'Unable to hear/speak clearly during call',
    status: 'IN_PROGRESS',
    showAmountAndDate: false,
  },
  RNR: {
    code: 'RNR',
    name: 'Ringing No Response',
    description: 'Phone ringing but no response',
    status: 'IN_PROGRESS',
    showAmountAndDate: false,
  },
  SOW: {
    code: 'SOW',
    name: 'Switch Off',
    description: 'Phone is switched off',
    status: 'IN_PROGRESS',
    showAmountAndDate: false,
  },
  OOS: {
    code: 'OOS',
    name: 'Out Of Service',
    description: 'Phone number is out of service',
    status: 'IN_PROGRESS',
    showAmountAndDate: false,
  },
  WRN: {
    code: 'WRN',
    name: 'Wrong Number',
    description: 'Called wrong number/incorrect phone',
    status: 'IN_PROGRESS',
    showAmountAndDate: false,
  },

  // DONE Status - Show Amount and Date-Time
  SIF: {
    code: 'SIF',
    name: 'Settle In Full',
    description: 'Settlement arrangement for full payment',
    status: 'DONE',
    showAmountAndDate: 'amountOnly', // Only amount required
  },
  PIF: {
    code: 'PIF',
    name: 'Paid In Full',
    description: 'Customer has paid the entire amount',
    status: 'DONE',
    showAmountAndDate: 'amountOnly', // Only amount required
  },
};

export const getDispositionsList = () => {
  return Object.values(DISPOSITIONS);
};

export const requiresAmountAndDate = (dispositionCode) => {
  const val = DISPOSITIONS[dispositionCode]?.showAmountAndDate;
  return val === true || val === 'dateOnly';
};

// Returns true if disposition requires payment date/time (for PRT, PIF, SIF, FCL)
export const requiresPaymentDate = (dispositionCode) => {
  return !!DISPOSITIONS[dispositionCode]?.showPaymentDate;
};

// Returns true if disposition requires amount (including 'amountOnly')
export const requiresAmount = (dispositionCode) => {
  const val = DISPOSITIONS[dispositionCode]?.showAmountAndDate;
  return val === true || val === 'amountOnly';
};

// ISSUE #9 FIX: New helper to check if only date is required (not amount)
export const requiresDateOnly = (dispositionCode) => {
  return DISPOSITIONS[dispositionCode]?.showAmountAndDate === 'dateOnly';
};

export const getStatusForDisposition = (dispositionCode) => {
  return DISPOSITIONS[dispositionCode]?.status || 'IN_PROGRESS';
};

export default DISPOSITIONS;
