import axios from 'axios';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://localhost:5000/api';
const TEST_AGENT = { username: 'agent', password: 'password123' };

let passed = 0;
let failed = 0;

const log = {
  ok: (msg) => { console.log(`✅ ${msg}`); passed++; },
  err: (msg) => { console.log(`❌ ${msg}`); failed++; },
  info: (msg) => console.log(`ℹ️  ${msg}`),
};

const main = async () => {
  console.log(`\n${'═'.repeat(70)}\nDISPOSITION STATUS & EDIT LOGIC TEST\n${'═'.repeat(70)}\n`);

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB,
  });

  const conn = await pool.getConnection();

  try {
    // 1. Login
    const loginRes = await axios.post(`${API_BASE}/auth/login`, TEST_AGENT);
    const agentId = loginRes.data.user.id;
    const token = loginRes.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    log.ok(`Agent logged in (ID: ${agentId})`);

    // 2. Clear active cases
    await conn.query(
      `UPDATE agent_cases SET is_active=0, status='DONE' WHERE agent_id=? AND is_active=1`,
      [agentId]
    );
    log.ok(`Cleared active cases`);

    // 3. Get next case
    const nextRes = await axios.get(`${API_BASE}/agent/cases/next`, { headers });
    const caseId = nextRes.data.caseId;
    log.ok(`Got next case (ID: ${caseId})`);

    // TEST 1: Submit FOLLOW_UP disposition (PTP)
    console.log(`\n--- Test 1: FOLLOW_UP Status (PTP) ---`);
    const ptp = await axios.post(
      `${API_BASE}/agent/cases/${caseId}/disposition`,
      {
        disposition: 'PTP',
        remarks: 'Customer will pay next week',
        promiseAmount: 5000,
        followUpDate: '2026-01-15',
        followUpTime: '14:00:00',
      },
      { headers }
    );
    if (ptp.data.status === 'FOLLOW_UP') {
      log.ok(`Status changed to FOLLOW_UP`);
    } else {
      log.err(`Status should be FOLLOW_UP but is ${ptp.data.status}`);
    }
    if (ptp.data.allocateNext === true) {
      log.ok(`Next customer ALLOCATED (status changed)`);
    } else {
      log.err(`Should allocate next on status change`);
    }

    // Get case details
    let caseRes = await axios.get(`${API_BASE}/agent/cases/${caseId}`, { headers });
    if (caseRes.data.dispositions.length === 1) {
      log.ok(`Disposition recorded`);
    }

    // TEST 2: Edit the disposition
    console.log(`\n--- Test 2: Edit Disposition ---`);
    const edit = await axios.post(
      `${API_BASE}/agent/cases/${caseId}/disposition`,
      {
        disposition: 'PTP',
        remarks: 'Customer will pay next Friday',
        promiseAmount: 7000,
        followUpDate: '2026-01-17',
        followUpTime: '15:30:00',
        isEdit: true,
      },
      { headers }
    );
    log.ok(`Disposition edited`);

    // Check edit history
    caseRes = await axios.get(`${API_BASE}/agent/cases/${caseId}`, { headers });
    if (caseRes.data.editHistory.length > 0) {
      log.ok(`Edit history tracked (${caseRes.data.editHistory.length} edits)`);
    }
    if (caseRes.data.dispositions.length === 1) {
      log.ok(`Only 1 current disposition (old one archived)`);
    }

    // TEST 3: Submit IN_PROGRESS disposition (RTP)
    console.log(`\n--- Test 3: IN_PROGRESS Status (RTP) ---`);
    const rtp = await axios.post(
      `${API_BASE}/agent/cases/${caseId}/disposition`,
      {
        disposition: 'RTP',
        remarks: 'Customer refuses to pay',
        promiseAmount: null,
        followUpDate: null,
        followUpTime: null,
      },
      { headers }
    );
    if (rtp.data.status === 'IN_PROGRESS') {
      log.ok(`Status changed to IN_PROGRESS`);
    } else {
      log.err(`Status should be IN_PROGRESS but is ${rtp.data.status}`);
    }
    if (rtp.data.allocateNext === true) {
      log.ok(`Next customer ALLOCATED (status changed)`);
    }

    // TEST 4: Submit DONE disposition (PIF)
    console.log(`\n--- Test 4: DONE Status (PIF) ---`);
    const pif = await axios.post(
      `${API_BASE}/agent/cases/${caseId}/disposition`,
      {
        disposition: 'PIF',
        remarks: 'Customer paid in full',
        promiseAmount: 50000,
        followUpDate: '2026-01-02',
        followUpTime: '10:00:00',
      },
      { headers }
    );
    if (pif.data.status === 'DONE') {
      log.ok(`Status changed to DONE`);
    } else {
      log.err(`Status should be DONE but is ${pif.data.status}`);
    }
    if (pif.data.allocateNext === true) {
      log.ok(`Next customer ALLOCATED (status reached DONE)`);
    } else {
      log.err(`Should allocate next for DONE`);
    }

    // TEST 5: Check final disposition history
    console.log(`\n--- Test 5: Final Disposition History ---`);
    caseRes = await axios.get(`${API_BASE}/agent/cases/${caseId}`, { headers });
    log.info(`Current dispositions: ${caseRes.data.dispositions.length}`);
    caseRes.data.dispositions.forEach((d, i) => {
      log.info(`  ${i + 1}. ${d.disposition} - Amount: ₹${d.promise_amount || 'N/A'}`);
    });
    
    log.info(`Edit history: ${caseRes.data.editHistory.length}`);
    caseRes.data.editHistory.forEach((e, i) => {
      log.info(`  ${i + 1}. ${e.disposition} (edited at ${e.edited_at})`);
    });

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`✅ PASSED: ${passed}`);
    console.log(`❌ FAILED: ${failed}`);
    console.log(`${'═'.repeat(70)}\n`);

  } catch (err) {
    log.err(err.response?.data?.message || err.message);
    console.error(err.response?.data || err);
  } finally {
    conn.release();
    await pool.end();
  }
};

main();
