// src/api/agentApi.js
import axios from "axios";

const API_BASE = "http://localhost:5000/api/agent";

// Fetch allocated loans for agent
export const fetchAgentLoans = async (token) => {
  const res = await axios.get(`${API_BASE}/loans`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
};
