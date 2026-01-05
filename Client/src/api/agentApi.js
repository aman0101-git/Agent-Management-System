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
    }
  );

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
export const fetchAnalytics = async (timeFilter, token) => {
  const res = await axios.get(`${API_BASE}/analytics`, {
    params: { timeFilter },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
};

// Kept for backward compatibility
export const fetchAgentLoans = fetchAgentCases;
export const fetchCustomerDetails = fetchCaseDetails;
