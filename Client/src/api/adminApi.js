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
