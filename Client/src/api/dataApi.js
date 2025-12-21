import axios from "axios";

const API_URL = "http://localhost:5000/api/data";

export const ingestLoanFile = async (file, token) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await axios.post(`${API_URL}/ingest`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
};
