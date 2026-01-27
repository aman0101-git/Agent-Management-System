/**
 * DISPOSITION RULES ENGINE
 * 
 * Industry-standard, rule-driven approach for disposition validation and behavior.
 * Single source of truth for all disposition logic across backend and frontend.
 * 
 * Each disposition defines:
 * - What fields are required/optional
 * - How status should change
 * - Default behavior
 */

export const DISPOSITION_RULES = {
  // ============================================
  // FOLLOW-UP STATUS DISPOSITIONS
  // ============================================
  
  PTP: {
    code: 'PTP',
    name: 'Promise To Pay',
    description: 'Customer promised to pay on a specific date',
    resultStatus: 'FOLLOW_UP',
    // Validation rules
    requires: {
      amount: true,        // Must have promise amount
      followUpDate: true,  // Must have follow-up date
      followUpTime: true,  // Must have follow-up time
    },
    optional: {
      remarks: true,       // Remarks are optional
      ptpTarget: true,     // PTP target disposition is optional
    },
  },

  PRT: {
    code: 'PRT',
    name: 'Part Payment',
    description: 'Customer made a partial payment',
    resultStatus: 'FOLLOW_UP',
    requires: {
      amount: true,
      followUpDate: true,
      followUpTime: true,
      paymentDate: true,
      paymentTime: true,
    },
    optional: {
      remarks: true,
    },
  },

  CBC: {
    code: 'CBC',
    name: 'Call Back Confirmed',
    description: 'Callback confirmed from customer',
    resultStatus: 'FOLLOW_UP',
    requires: {
      amount: false,       // NO AMOUNT REQUIRED - Key difference
      followUpDate: true,
      followUpTime: true,
    },
    optional: {
      remarks: true,
    },
  },

  // ============================================
  // IN-PROGRESS STATUS DISPOSITIONS
  // ============================================
  
  BRP: {
    code: 'BRP',
    name: 'Broken Promise',
    description: 'Customer broke their previous promise to pay',
    resultStatus: 'IN_PROGRESS',
    requires: {
      amount: false,
      followUpDate: false,
      followUpTime: false,
    },
    optional: {
      remarks: true,
    },
  },

  RTP: {
    code: 'RTP',
    name: 'Refuse To Pay',
    description: 'Customer refuses to pay the loan amount',
    resultStatus: 'IN_PROGRESS',
    requires: {
      amount: false,
      followUpDate: false,
      followUpTime: false,
    },
    optional: {
      remarks: true,
    },
  },

  TPC: {
    code: 'TPC',
    name: 'Third Party Call',
    description: 'Need to contact third party/guarantor',
    resultStatus: 'IN_PROGRESS',
    requires: {
      amount: false,
      followUpDate: false,
      followUpTime: false,
    },
    optional: {
      remarks: true,
    },
  },

  LNB: {
    code: 'LNB',
    name: 'Language Barrier',
    description: 'Communication blocked due to language barrier',
    resultStatus: 'IN_PROGRESS',
    requires: {
      amount: false,
      followUpDate: false,
      followUpTime: false,
    },
    optional: {
      remarks: true,
    },
  },

  VOI: {
    code: 'VOI',
    name: 'Voice Issue',
    description: 'Unable to hear/speak clearly during call',
    resultStatus: 'IN_PROGRESS',
    requires: {
      amount: false,
      followUpDate: false,
      followUpTime: false,
    },
    optional: {
      remarks: true,
    },
  },

  RNR: {
    code: 'RNR',
    name: 'Ringing No Response',
    description: 'Phone ringing but no response',
    resultStatus: 'IN_PROGRESS',
    requires: {
      amount: false,
      followUpDate: false,
      followUpTime: false,
    },
    optional: {
      remarks: true,
    },
  },

  SOW: {
    code: 'SOW',
    name: 'Switch Off',
    description: 'Phone is switched off',
    resultStatus: 'IN_PROGRESS',
    requires: {
      amount: false,
      followUpDate: false,
      followUpTime: false,
    },
    optional: {
      remarks: true,
    },
  },

  OOS: {
    code: 'OOS',
    name: 'Out Of Service',
    description: 'Phone number is out of service',
    resultStatus: 'IN_PROGRESS',
    requires: {
      amount: false,
      followUpDate: false,
      followUpTime: false,
    },
    optional: {
      remarks: true,
    },
  },

  WRN: {
    code: 'WRN',
    name: 'Wrong Number',
    description: 'Called wrong number/incorrect phone',
    resultStatus: 'IN_PROGRESS',
    requires: {
      amount: false,
      followUpDate: false,
      followUpTime: false,
    },
    optional: {
      remarks: true,
    },
  },

  // ============================================
  // DONE STATUS DISPOSITIONS
  // ============================================
  
  SIF: {
    code: 'SIF',
    name: 'Settle In Full',
    description: 'Settlement arrangement for full payment',
    resultStatus: 'DONE',
    requires: {
      amount: true,
      followUpDate: false,  // No follow-up needed
      followUpTime: false,
    },
    optional: {
      remarks: true,
    },
  },

  PIF: {
    code: 'PIF',
    name: 'Paid In Full',
    description: 'Customer has paid the entire amount',
    resultStatus: 'DONE',
    requires: {
      amount: true,
      followUpDate: false,
      followUpTime: false,
    },
    optional: {
      remarks: true,
    },
  },

  FCL: {
    code: 'FCL',
    name: 'Foreclosure',
    description: 'Loan foreclosure initiated',
    resultStatus: 'DONE',
    requires: {
      amount: true,
      followUpDate: false,
      followUpTime: false,
    },
    optional: {
      remarks: true,
    },
  },
};

/**
 * Validate disposition submission against rules
 * @param {string} dispositionCode - Disposition code (e.g., 'PTP')
 * @param {object} data - Submitted data { amount, followUpDate, followUpTime, remarks }
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateDispositionData(dispositionCode, data) {
  const rule = DISPOSITION_RULES[dispositionCode];
  
  if (!rule) {
    return { valid: false, errors: [`Unknown disposition: ${dispositionCode}`] };
  }

  const errors = [];

  // Check required fields
  if (rule.requires.amount && (!data.amount || isNaN(data.amount) || Number(data.amount) <= 0)) {
    errors.push(`Amount is required for ${rule.code}`);
  }
  if (rule.requires.followUpDate && !data.followUpDate) {
    errors.push(`Follow-up date is required for ${rule.code}`);
  }
  if (rule.requires.followUpTime && !data.followUpTime) {
    errors.push(`Follow-up time is required for ${rule.code}`);
  }
  if (rule.requires.paymentDate && !data.paymentDate) {
    errors.push(`Payment date is required for ${rule.code}`);
  }
  if (rule.requires.paymentTime && !data.paymentTime) {
    errors.push(`Payment time is required for ${rule.code}`);
  }

  // For dispositions that don't require amount, enforce it's NULL
  if (!rule.requires.amount && data.amount) {
    // Amount will be set to NULL in processing, but we validate it shouldn't be sent
    errors.push(`${rule.code} should not have an amount`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get field requirements for UI rendering
 * @param {string} dispositionCode
 * @returns {object} { requiresAmount, requiresFollowUpDate, requiresFollowUpTime }
 */
export function getFieldRequirements(dispositionCode) {
  const rule = DISPOSITION_RULES[dispositionCode];
  
  if (!rule) {
    return { requiresAmount: false, requiresFollowUpDate: false, requiresFollowUpTime: false };
  }

  return {
    requiresAmount: rule.requires.amount,
    requiresFollowUpDate: rule.requires.followUpDate,
    requiresFollowUpTime: rule.requires.followUpTime,
  };
}

/**
 * Get result status for a disposition
 * @param {string} dispositionCode
 * @returns {string} 'FOLLOW_UP', 'IN_PROGRESS', 'DONE'
 */
export function getResultStatus(dispositionCode) {
  return DISPOSITION_RULES[dispositionCode]?.resultStatus || 'IN_PROGRESS';
}

/**
 * Get all dispositions grouped by status
 * @returns {object} { FOLLOW_UP: [...], IN_PROGRESS: [...], DONE: [...] }
 */
export function getDispositionsByStatus() {
  const grouped = {
    FOLLOW_UP: [],
    IN_PROGRESS: [],
    DONE: [],
  };

  Object.values(DISPOSITION_RULES).forEach((rule) => {
    grouped[rule.resultStatus].push(rule);
  });

  return grouped;
}

export default DISPOSITION_RULES;
