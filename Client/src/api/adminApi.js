// src/api/adminApi.js
import axios from "axios";

const API_BASE = "http://localhost:5000/api/admin";

// Fetch monitoring analytics (aggregated across agents/campaigns)
export const fetchMonitoringAnalytics = async (
  campaignId = "ALL",
  agentId = "ALL",
  startDate,
  endDate,
  token
) => {
  const params = {
    campaign_id: campaignId,
    agent_id: agentId,
    start_date: startDate,
    end_date: endDate,
  };

  const res = await axios.get(`${API_BASE}/monitoring-analytics`, {
    params,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
};

// Get all active agents for dropdown
export const fetchMonitoringAgents = async (token) => {
  const res = await axios.get(`${API_BASE}/monitoring-analytics/agents`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data.agents;
};

// Get all campaigns for dropdown
export const fetchMonitoringCampaigns = async (token) => {
  const res = await axios.get(`${API_BASE}/monitoring-analytics/campaigns`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data.campaigns;
};

// Fetch detailed customer list for a specific disposition
export const fetchMonitoringDrilldown = async (
  disposition,
  campaignId = "ALL",
  agentId = "ALL",
  startDate,
  endDate,
  token
) => {
  const params = {
    disposition,
    campaign_id: campaignId,
    agent_id: agentId,
    start_date: startDate,
    end_date: endDate,
  };

  const res = await axios.get(`${API_BASE}/monitoring-analytics/drilldown`, {
    params,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data.data;
};

// Export detailed customer list to CSV
export const fetchMonitoringDrilldownExport = async (
  disposition,
  campaignId = "ALL",
  agentId = "ALL",
  startDate,
  endDate,
  token
) => {
  const params = {
    disposition,
    campaign_id: campaignId,
    agent_id: agentId,
    start_date: startDate,
    end_date: endDate,
  };

  const res = await axios.get(`${API_BASE}/monitoring-analytics/drilldown/export`, {
    params,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseType: 'blob',
  });

  return res.data;
};

export const searchGlobalCustomers = async (query, token) => {
  const res = await axios.post(`${API_BASE}/search`, { query }, { headers: { Authorization: `Bearer ${token}` } });
  return res.data;
};

export const fetchAdminCaseDetails = async (caseId, token) => {
  const res = await axios.get(`${API_BASE}/cases/${caseId}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.data;
};

export const submitAdminDisposition = async (caseId, payload, token) => {
  const res = await axios.post(`${API_BASE}/cases/${caseId}/disposition`, payload, {
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: (status) => status >= 200 && status < 500,
  });
  if (res.status >= 400) {
    const error = new Error(res.data?.message || 'Disposition submission failed');
    error.errors = res.data?.errors;
    error.status = res.status;
    throw error;
  }
  return res.data;
};

export const startAdminCustomerVisit = async (customerId, token) => {
  const res = await axios.post(`${API_BASE}/customer-visit/start`, { customer_id: customerId }, { headers: { Authorization: `Bearer ${token}` } });
  return res.data;
};

export const endAdminCustomerVisit = async (visitId, token) => {
  const res = await axios.post(`${API_BASE}/customer-visit/end`, { visit_id: visitId }, { headers: { Authorization: `Bearer ${token}` }, validateStatus: (s) => s >= 200 && s < 500 });
  return res.data;
};

export const fetchAdminCustomerVisitHistory = async (customerId, token) => {
  const res = await axios.get(`${API_BASE}/customer-visit/history/${customerId}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.data;
};

export const fetchAdminOnceConstraints = async (collDataId, token) => {
  const res = await axios.get(`${API_BASE}/customers/${collDataId}/once-constraints`, { headers: { Authorization: `Bearer ${token}` } });
  return res.data;
};