// server.js — Express + socket.io + whatsapp-web.js (LocalAuth, puppeteer-core)
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
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server);

// Путь до Chromium берём из переменной окружения (см. Dockerfile/Render)
const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
const launchArgs = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
  '--single-process'
];

const client = new Client({
  authStrategy: new LocalAuth({ clientId: "omni_1" }),
  puppeteer: { headless: true, executablePath, args: launchArgs }
});

client.on('qr', async (qr) => {
  const url = await qrcode.toDataURL(qr);
  io.emit('qr', { qrDataUrl: url });
  console.log('[WA] QR ready');
});
client.on('ready', () => { console.log('[WA] Ready'); io.emit('ready'); });
client.on('authenticated', () => { console.log('[WA] Authenticated'); io.emit('authenticated'); });
client.on('auth_failure', (m) => { console.error('[WA] auth_failure', m); io.emit('auth_failure', m); });
client.on('disconnected', (r) => { console.log('[WA] disconnected', r); io.emit('disconnected', r); });

client.on('message', message => {
  io.emit('message', { from: message.from, body: message.body, timestamp: Date.now() });
});

app.post('/send', async (req,res)=>{
  try{
    const { to, text } = req.body;
    if(!to || !text) return res.status(400).json({ ok:false, error:'to and text required' });
    const id = to.includes('@') ? to : `${to}@c.us`;
    const msg = await client.sendMessage(id, text);
    io.emit('outgoing', { to, text, timestamp: Date.now() });
    res.json({ ok:true, id: msg.id? (msg.id.id || msg.id._serialized || msg.id) : null });
  }catch(e){
    console.error('[WA] send error', e?.message || e);
    res.status(500).json({ ok:false, error: e?.message || e });
  }
});

const PORT = process.env.PORT || 3000;
client.initialize();
server.listen(PORT, ()=> console.log('HTTP on :' + PORT));
