// server.js — Express + socket.io + whatsapp-web.js (LocalAuth)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Статика: public/index.html — UI для QR и сообщений
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server);

// Создаём клиент с LocalAuth (сессия сохраняется в ./wwebjs_auth)
const client = new Client({
  authStrategy: new LocalAuth({ clientId: "omni_1" }), // clientId для мультиаккаунтов
  puppeteer: { headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] }
});

client.on('qr', async (qr) => {
  // отправляем QR всем подключённым браузерам через socket.io
  const url = await qrcode.toDataURL(qr);
  io.emit('qr', { qrDataUrl: url });
  console.log('[WA] QR sent to frontend');
});

client.on('ready', () => {
  console.log('[WA] Client is ready!');
  io.emit('ready');
});

client.on('authenticated', (session) => {
  console.log('[WA] Authenticated');
  io.emit('authenticated');
});

client.on('auth_failure', (msg) => {
  console.error('[WA] Auth failure', msg);
  io.emit('auth_failure', msg);
});

client.on('disconnected', (reason) => {
  console.log('[WA] Disconnected', reason);
  io.emit('disconnected', reason);
});

// Входящее сообщение
client.on('message', message => {
  console.log('[WA] Message from', message.from, ':', message.body);
  // ретранслируем во все UI-клиенты
  io.emit('message', {
    from: message.from,
    body: message.body,
    timestamp: Date.now()
  });
});

// REST: отправить сообщение через WA
app.post('/send', async (req, res) => {
  try {
    const { to, text } = req.body;
    if(!to || !text) return res.status(400).json({ ok:false, error: 'to and text required' });
    // to в формате международном, без + (например 79001234567)
    const id = to.includes('@') ? to : `${to}@c.us`;
    const msg = await client.sendMessage(id, text);
    res.json({ ok: true, id: msg.id?.id || msg.id });
    // уведомим UI
    io.emit('outgoing', { to, text, timestamp: Date.now() });
  } catch (e) {
    console.error('[WA] send error', e?.message || e);
    res.status(500).json({ ok:false, error: e?.message || e });
  }
});

// Socket.io — соединение UI
io.on('connection', socket => {
  console.log('Socket connected', socket.id);
  socket.on('ping', ()=> socket.emit('pong'));
});

// стартуем
const PORT = process.env.PORT || 3000;
client.initialize();
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
