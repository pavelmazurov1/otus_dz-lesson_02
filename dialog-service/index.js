import express from 'express';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

// no auth!

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
  messages: [] // {id, from, to, text, reply_to, ts}
};

// Helpers
function nowIso() { return new Date().toISOString(); }

// Health
app.get('/health', (req, res) => res.json({ status: 'dialog service OK', time: nowIso() }));

// Dialogs (обрати внимание на это! тот самый функционал диалогов)
// Send a message to user_id
app.post('/dialog/:user_id/send', (req, res) => {
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
app.get('/dialog/:user_id/list', (req, res) => {
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
  console.log(`Dialog service listening on http://0.0.0.0:${port}`);
});
