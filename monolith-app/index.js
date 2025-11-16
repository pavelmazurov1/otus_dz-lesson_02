import express from 'express';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

// Simple request-id middleware (accept incoming or generate)
app.use((req, res, next) => {
  const rid = req.header('x-request-id') || uuidv4();
  req.requestId = rid;
  res.set('x-request-id', rid);
  next();
});

// Logging with request-id
morgan.token('rid', (req) => req.requestId);
app.use(morgan(':method :url :status - rid=:rid - :response-time ms'));

// In-memory db
const db = {
  users: [], // {id, name}
  tokens: new Map(), // token -> userId
  messages: [] // {id, from, to, text, reply_to, ts}
};

// Helpers
function nowIso() { return new Date().toISOString(); }

function authOptional(req, res, next) {
  const header = req.header('authorization') || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (m) {
    const token = m[1];
    const uid = db.tokens.get(token);
    if (uid) req.userId = uid;
  }
  next();
}

function authRequired(req, res, next) {
  const header = req.header('authorization') || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: 'missing bearer token' });
  const token = m[1];
  const uid = db.tokens.get(token);
  if (!uid) return res.status(401).json({ error: 'invalid token' });
  req.userId = uid;
  next();
}

// Health
app.get('/health', (req, res) => res.json({ status: 'OK', time: nowIso() }));

// Users
// Register user (no password for demo). Returns token.
app.post('/user/register', (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const id = db.users.length + 1;
  const user = { id, name };
  db.users.push(user);
  // token for demo
  const token = `demo-${uuidv4()}`;
  db.tokens.set(token, id);
  res.json({ user, token });
});

// Get user by id
app.get('/user/get/:id', authOptional, (req, res) => {
  const id = Number(req.params.id);
  const user = db.users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'user not found' });
  res.json(user);
});

// Dialogs (обрати внимание на это! тот самый функционал диалогов)
// Send a message to user_id
app.post('/dialog/:user_id/send', authRequired, (req, res) => {
  const to = Number(req.params.user_id);
  const { text, reply_to } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }
  const from = req.userId;
  const id = db.messages.length + 1;
  const msg = { id, from, to, text, reply_to: reply_to || null, ts: nowIso(), request_id: req.requestId };
  db.messages.push(msg);
  res.status(201).json(msg);
});

// List messages with user_id (two-sided dialog for current user)
app.get('/dialog/:user_id/list', authRequired, (req, res) => {
  const other = Number(req.params.user_id);
  const me = req.userId;
  // Filter two-way conversation
  const list = db.messages.filter(m =>
    (m.from === me && m.to === other) || (m.from === other && m.to === me)
  );
  // Optional pagination
  const limit = Number(req.query.limit || 50);
  const offset = Number(req.query.offset || 0);
  const sliced = list.slice(offset, offset + limit);
  res.json({ total: list.length, items: sliced });
});

// Fallback 404
app.use((req, res) => res.status(404).json({ error: 'not found' }));

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Monolith listening on http://0.0.0.0:${port}`);
});
