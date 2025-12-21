import axios from "axios";

const API = "http://localhost:5000/api/campaigns";

export const fetchCampaigns = (token) =>
  axios.get(API, { headers: { Authorization: `Bearer ${token}` } });

export const createCampaign = (name, token) =>
  axios.post(API, { campaign_name: name }, {
    headers: { Authorization: `Bearer ${token}` }
  });

export const deactivateCampaign = (id, token) =>
  axios.patch(`${API}/${id}/deactivate`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });

// Distribute data to agents for a campaign
export const distributeCampaignData = (campaignId, token) =>
  axios.post(
    `${API}/${campaignId}/distribute`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

// Distribution Summary
export const fetchCampaignDistributionSummary = (campaignId, token) =>
  axios.get(
    `${API}/${campaignId}/distribution-summary`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
