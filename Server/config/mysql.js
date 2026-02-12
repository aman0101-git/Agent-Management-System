import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,

  waitForConnections: true,
  connectionLimit: 10,        // enough for 50 agents
  queueLimit: 0,              // unlimited queue
  connectTimeout: 10000,      // 10 secondsgit 
});

// Optional but strongly recommended
pool.on('connection', () => {
  console.log('MySQL pool connected');
});

pool.on('error', (err) => {
  console.error('MySQL Pool Error:', err.message);
});

export default pool;
