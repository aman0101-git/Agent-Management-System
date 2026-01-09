// src/api/agentApi.js
import axios from "axios";

const API_BASE = "http://localhost:5000/api/agent";

// Fetch allocated cases for agent
export const fetchAgentCases = async (token) => {
  const res = await axios.get(`${API_BASE}/cases`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
};

// Fetch case details by ID
export const fetchCaseDetails = async (caseId, token) => {
  const res = await axios.get(`${API_BASE}/cases/${caseId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
};

// Submit disposition for a case
export const submitDisposition = async (caseId, payload, token) => {
  const res = await axios.post(
    `${API_BASE}/cases/${caseId}/disposition`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      // Allow 4xx errors to be handled by caller
      validateStatus: (status) => status >= 200 && status < 500,
    }
  );

  // If there's an error response, throw it with details
  if (res.status >= 400) {
    const error = new Error(res.data?.message || 'Disposition submission failed');
    error.errors = res.data?.errors; // Include validation errors array
    error.status = res.status;
    throw error;
  }

  return res.data;
};

// Allocate and fetch a single next queued case for the agent
export const fetchNextCase = async (token) => {
  const res = await axios.get(`${API_BASE}/cases/next`, {
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: (s) => s >= 200 && s < 500,
  });

  return res;
};

// Search customers across entire database
export const searchCustomers = async (query, token) => {
  const res = await axios.post(
    `${API_BASE}/search`,
    { query },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return res.data;
};

// Fetch agent performance analytics
export const fetchAnalytics = async (timeFilter, token, fromDate, toDate) => {
  const params = { timeFilter };
  
  if (timeFilter === 'custom' && fromDate && toDate) {
    params.fromDate = fromDate;
    params.toDate = toDate;
  }
  
  const res = await axios.get(`${API_BASE}/analytics`, {
    params,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
};

// Fetch agent's monthly target
export const fetchAgentTarget = async (token) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const res = await axios.get(`${API_BASE}/target`, {
      params: { month: currentMonth },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  } catch (error) {
    return null; // If no target found, return null
  }
};

// Update agent's monthly target
export const updateAgentTarget = async (targetAmount, token) => {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const res = await axios.post(
    `${API_BASE}/target`,
    { 
      month: currentMonth, 
      targetAmount 
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return res.data;
};

// Kept for backward compatibility
export const fetchAgentLoans = fetchAgentCases;
export const fetchCustomerDetails = fetchCaseDetails;

// Start a customer visit when drawer opens
export const startCustomerVisit = async (customerId, token) => {
  const res = await axios.post(
    `${API_BASE}/customer-visit/start`,
    { customer_id: customerId },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};

// End a customer visit when drawer closes or disposition submitted
export const endCustomerVisit = async (visitId, token) => {
  const res = await axios.post(
    `${API_BASE}/customer-visit/end`,
    { visit_id: visitId },
    { headers: { Authorization: `Bearer ${token}` }, validateStatus: (s) => s >= 200 && s < 500 }
  );
  return res.data;
};

// Fetch visit history for a customer
export const fetchCustomerVisitHistory = async (customerId, token) => {
  const res = await axios.get(`${API_BASE}/customer-visit/history/${customerId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};
