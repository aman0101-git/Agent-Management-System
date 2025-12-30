/**
 * Disposition codes and their descriptions (Client-side)
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
    requiresFollowUp: false,
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
    requiresFollowUp: false,
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

export const getDispositionsList = () => {
  return Object.values(DISPOSITIONS);
};

export const getFollowUpRequiredDispositions = () => {
  return Object.values(DISPOSITIONS).filter((d) => d.requiresFollowUp);
};

export const requiresFollowUp = (dispositionCode) => {
  return DISPOSITIONS[dispositionCode]?.requiresFollowUp || false;
};

export default DISPOSITIONS;
