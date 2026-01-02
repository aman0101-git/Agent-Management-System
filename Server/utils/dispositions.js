/**
 * Disposition codes and their descriptions
 * Used for agent call handling and case status tracking
 */
export const DISPOSITIONS = {
  PTP: {
    code: 'PTP',
    name: 'Promise To Pay',
    description: 'Customer promised to pay on a specific date',
    requiresFollowUp: true,
  },
  RTP: {
    code: 'RTP',
    name: 'Refuse To Pay',
    description: 'Customer refuses to pay the loan amount',
    requiresFollowUp: false,
  },
  BRP: {
    code: 'BRP',
    name: 'Broken Promise',
    description: 'Customer broke their previous promise to pay',
    requiresFollowUp: true,
  },
  PRT: {
    code: 'PRT',
    name: 'Part Payment',
    description: 'Customer made a partial payment',
    requiresFollowUp: true,
  },
  SIF: {
    code: 'SIF',
    name: 'Settle In Full',
    description: 'Settlement arrangement for full payment',
    requiresFollowUp: false,
  },
  PIF: {
    code: 'PIF',
    name: 'Paid In Full',
    description: 'Customer has paid the entire amount',
    requiresFollowUp: false,
  },
  FCL: {
    code: 'FCL',
    name: 'Foreclosure',
    description: 'Loan foreclosure initiated',
    requiresFollowUp: true,
  },
  CBC: {
    code: 'CBC',
    name: 'Call Back',
    description: 'Callback required from customer',
    requiresFollowUp: true,
  },
  TPC: {
    code: 'TPC',
    name: 'Third Party Call',
    description: 'Need to contact third party/guarantor',
    requiresFollowUp: false,
  },
  LNB: {
    code: 'LNB',
    name: 'Language Barrier',
    description: 'Communication blocked due to language barrier',
    requiresFollowUp: false,
  },
  VOI: {
    code: 'VOI',
    name: 'Voice Issue',
    description: 'Unable to hear/speak clearly during call',
    requiresFollowUp: false,
  },
  RNR: {
    code: 'RNR',
    name: 'Ringing',
    description: 'Phone ringing but no response',
    requiresFollowUp: false,
  },
  SOW: {
    code: 'SOW',
    name: 'Switch Off',
    description: 'Phone is switched off',
    requiresFollowUp: false,
  },
  OOS: {
    code: 'OOS',
    name: 'Out Of Service',
    description: 'Phone number is out of service',
    requiresFollowUp: false,
  },
  WRN: {
    code: 'WRN',
    name: 'Wrong Number',
    description: 'Called wrong number/incorrect phone',
    requiresFollowUp: false,
  },
};

/**
 * Get all dispositions as array
 */
export const getDispositionsList = () => {
  return Object.values(DISPOSITIONS);
};

/**
 * Get dispositions that require follow-up
 */
export const getFollowUpRequiredDispositions = () => {
  return Object.values(DISPOSITIONS).filter((d) => d.requiresFollowUp);
};

/**
 * Check if a disposition requires follow-up
 */
export const requiresFollowUp = (dispositionCode) => {
  return DISPOSITIONS[dispositionCode]?.requiresFollowUp || false;
};

export default DISPOSITIONS;
