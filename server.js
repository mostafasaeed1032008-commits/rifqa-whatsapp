// -*- coding: utf-8 -*-
/**
 * Rifqa Smart WhatsApp & CRM Service
 * Ready for GitHub & Render.com (24/7 Cloud Deployment)
 * Port: process.env.PORT || 3005
 * Integrates with Supabase: https://nifwgokownhyyksgcykk.supabase.co
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Dynamic module loader: checks local node_modules first, with local environment fallback
let baileys, QRCode, pino;
try {
  baileys = await import('@whiskeysockets/baileys');
  const qrMod = await import('qrcode');
  QRCode = qrMod.default || qrMod;
  const pinoMod = await import('pino');
  pino = pinoMod.default || pinoMod;
} catch (e) {
  try {
    const WLT_MODULES = 'C:/Users/win10/Downloads/Productivity Station/شغل/White Line Tours-studio/node_modules';
    baileys = require(path.join(WLT_MODULES, '@whiskeysockets/baileys'));
    QRCode = require(path.join(WLT_MODULES, 'qrcode'));
    pino = require(path.join(WLT_MODULES, 'pino'));
  } catch (err2) {
    console.error('Fatal: Could not load dependencies. Run `npm install` first.');
    process.exit(1);
  }
}

const makeWASocket = baileys.default || baileys.makeWASocket;
const { 
  DisconnectReason, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion 
} = baileys;

const PORT = process.env.PORT || 3005;
const AUTH_DIR = path.join(__dirname, 'whatsapp_auth_session');
const SUPABASE_URL = 'https://nifwgokownhyyksgcykk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pZndnb2tvd25oeXlrc2djeWtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMDEwNzAsImV4cCI6MjEwNzY3NzA3MH0.9IY6lY4uU85LvkdYZI0RyChH_UIWXGMSvtmS3Ks1cj0';

// State
let sock = null;
let currentQR = null;
let currentPairingCode = null;
const PHONE_NUMBER = '201554463293';
let connectionStatus = 'disconnected'; // disconnected, scan_qr, connecting, connected
let connectedPhone = '';
let autoReplyEnabled = true;
const processedMsgIds = new Set();
const userStages = new Map();


console.log('====================================================');
console.log('🕋  RIFQA SMART WHATSAPP & CRM REALTIME ENGINE');
console.log('====================================================');

// ========================================================
// Supabase Sync Helpers
// ========================================================
async function fetchLeadFromSupabase(phone) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?phone=eq.${phone}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (res.ok) {
      const data = await res.json();
      return data[0] || null;
    }
  } catch(e) {}
  return null;
}

async function upsertLeadToSupabase(leadData) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?on_conflict=phone`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(leadData)
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn('[Supabase Sync Warning]:', err);
    }
  } catch(e) {
    console.warn('[Supabase Sync Error]:', e.message);
  }
}

// ========================================================
// Baileys Connection Setup
// ========================================================
async function initWhatsApp() {
  connectionStatus = 'connecting';
  console.log('[WhatsApp] Starting connection...');

  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      printQRInTerminal: true,
      browser: ['Rifqa CRM', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    // Auto-generate 8-digit Pairing Code for direct linking without camera
    if (!state.creds.registered) {
      setTimeout(async () => {
        try {
          if (!sock?.user) {
            currentPairingCode = await sock.requestPairingCode(PHONE_NUMBER);
            console.log('\n======================================================');
            console.log(`🔑 كود الربط الرقمي المباشر لواتساب (Pairing Code):`);
            console.log(`               👉  ${currentPairingCode}  👈`);
            console.log('======================================================');
            console.log('في واتساب: الأجهزة المرتبطة ➔ ربط برقم الهاتف واكتب الكود!');
            console.log('الكود ثابت ومش بيتغير كل 20 ثانية!');
            console.log('======================================================\n');
          }
        } catch(e) {}
      }, 3500);
    }


    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionStatus = 'scan_qr';
        try {
          currentQR = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
          console.log('\n[WhatsApp] 📷 NEW QR CODE READY! Scan it in CRM or terminal to link.\n');
        } catch(e){}
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[WhatsApp] Closed (code: ${statusCode}). Reconnect: ${shouldReconnect}`);
        connectionStatus = 'disconnected';
        currentQR = null;
        if (shouldReconnect) {
          setTimeout(initWhatsApp, 3000);
        } else {
          try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch(e){}
          setTimeout(initWhatsApp, 3000);
        }
      } else if (connection === 'open') {
        connectionStatus = 'connected';
        currentQR = null;
        const userJid = sock.user?.id || '';
        connectedPhone = userJid.split(':')[0] || '';
        console.log(`\n======================================================`);
        console.log(`[WhatsApp] 🟢 CONNECTED! Phone: ${connectedPhone}`);
        console.log(`[WhatsApp] Rifqa AI Triage & CRM Bridge is LIVE!`);
        console.log(`======================================================\n`);
      }
    });

    // Inbound Messages Listener
    sock.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        if (!msg.message) continue;
        const fromJid = msg.key.remoteJid;
        if (fromJid.endsWith('@g.us') || fromJid === 'status@broadcast') continue;

        const msgId = msg.key.id;
        if (processedMsgIds.has(msgId)) continue;
        processedMsgIds.add(msgId);
        if (processedMsgIds.size > 5000) {
          processedMsgIds.delete(processedMsgIds.values().next().value);
        }

        const isFromMe = Boolean(msg.key.fromMe);
        const senderPhone = fromJid.replace('@s.whatsapp.net', '');
        const pushName = msg.pushName || `معتمر (${senderPhone.slice(-4)})`;
        const text = msg.message.conversation ||
                     msg.message.extendedTextMessage?.text ||
                     msg.message.imageMessage?.caption || '';

        if (!text.trim()) continue;

        console.log(`[WhatsApp] ${isFromMe ? 'OUT ->' : 'IN <-'} [${pushName} - ${senderPhone}]: ${text}`);

        // Get or initialize lead from Supabase
        let lead = await fetchLeadFromSupabase(senderPhone);
        const now = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const existingMessages = Array.isArray(lead?.messages) ? lead.messages : [];

        existingMessages.push({
          id: Date.now(),
          sender: isFromMe ? 'agent' : 'customer',
          text: text,
          time: now
        });

        // If inbound and auto-reply is active
        if (!isFromMe && autoReplyEnabled && lead?.stage !== 'needs_human') {
          const reply = computeTriageReply(text, senderPhone, lead);
          if (reply) {
            try {
              await sock.sendPresenceUpdate('composing', fromJid);
              await new Promise(r => setTimeout(r, 600));
              await sock.sendMessage(fromJid, { text: reply.text });

              existingMessages.push({
                id: Date.now() + 1,
                sender: 'bot',
                text: reply.text,
                time: now
              });

              lead = {
                id: lead?.id || `lead_${senderPhone}`,
                name: pushName,
                phone: senderPhone,
                stage: reply.stage || lead?.stage || 'new_lead',
                handled_by: reply.stage === 'needs_human' ? 'agent' : 'bot',
                pax: reply.pax || lead?.pax || 2,
                companions: reply.companions || lead?.companions || 'عائلة',
                priority: reply.priority || lead?.priority || '',
                recommended_program: reply.program || lead?.recommended_program || 'جاري التحديد',
                commission: reply.commission || lead?.commission || 0,
                month: 'شهر ديسمبر 2026',
                last_activity: 'منذ ثوانٍ',
                messages: existingMessages
              };
            } catch(e) {
              console.error('[Reply Send Error]:', e.message);
            }
          }
        } else {
          lead = {
            id: lead?.id || `lead_${senderPhone}`,
            name: pushName,
            phone: senderPhone,
            stage: lead?.stage || 'new_lead',
            handled_by: lead?.handled_by || (isFromMe ? 'agent' : 'bot'),
            pax: lead?.pax || 2,
            companions: lead?.companions || '',
            priority: lead?.priority || '',
            recommended_program: lead?.recommended_program || '',
            commission: lead?.commission || 0,
            month: lead?.month || 'شهر ديسمبر 2026',
            last_activity: 'منذ ثوانٍ',
            messages: existingMessages
          };
        }

        // Persist to Supabase
        await upsertLeadToSupabase(lead);
      }
    });

  } catch(err) {
    console.error('[WhatsApp Init Error]:', err);
    setTimeout(initWhatsApp, 5000);
  }
}

// ========================================================
// Rifqa 4-Program Triage Engine
// ========================================================
function computeTriageReply(userText, phone, existingLead) {
  const lower = userText.trim().toLowerCase();

  // 1. Human Request Trigger
  const humanWords = ['موظف', 'مدير', 'تليفون', 'رن عليا', 'كلمني', 'مسؤول', 'حد يكلمني', 'هشتكي', 'انسان'];
  if (humanWords.some(w => lower.includes(w))) {
    return {
      text: 'تمام يا فندم، تم إشعار مدير الحجوزات 👤 وسيقوم بالتواصل مع حضرتك فوراً للرد على كافة الاستفسارات.',
      stage: 'needs_human'
    };
  }

  // 2. Passports / Booking deposit
  const depositWords = ['جواز', 'جوازات', 'صور', 'مقدم', 'عربون', 'حجز', 'احجز'];
  if (depositWords.some(w => lower.includes(w))) {
    return {
      text: 'مبارك مقدماً يا فندم زيارة بيت الله الحرام 🕋✨\nتفضل بإرسال صور الجوازات واضحة هنا، وسيقوم مسؤول الحجوزات بتثبيت السعر وإصدار العقد فوراً.',
      stage: 'deposit_paid'
    };
  }

  // 3. Program choice (1..4)
  if (lower === '1' || lower.includes('قريب المشي') || lower.includes('اقتصادي مميز') || lower.includes('مشي')) {
    userStages.set(phone, 'done');
    return {
      text: `🎯 تم تشخيص طلبكم واختيار «البرنامج الاقتصادي المميز - قريب المشي (3 نجوم)» بالملي:\n\n• مكة المكرمة: فندق 3 نجوم 500 متر فقط مشي مباشر للحرم (أجياد / إبراهيم الخليل) بدون انتظار باصات.\n• المدينة المنورة: فندق بالمركزية خطوات من المسجد النبوي.\n• المدة: 14 يوماً.\n• السعر للفرد: 42,000 ج.م فقط شامل الطيران والتأشيرة والباركود والانتقالات.\n\nلتأكيد المقاعد، تفضل بإرسال صور الجوازات هنا للمتابعة فوراً 🪪`,
      stage: 'qualified',
      program: 'الاقتصادي المميز (قريب المشي 3 نجوم)',
      commission: 9000,
      priority: 'فندق 3 نجوم قريب مشي بدون باصات'
    };
  }

  if (lower === '2' || lower.includes('شاتل') || (lower.includes('اقتصادي') && !lower.includes('مميز'))) {
    userStages.set(phone, 'done');
    return {
      text: `🎯 تم اختيار «البرنامج الاقتصادي المعتمد (14 يوماً)» الأوفر تكلفة:\n\n• مكة المكرمة: فنادق حديثة بالعزيزية / محبس الجن بباصات شاتل مكيفة 24 ساعة لساحة الحرم.\n• المدينة المنورة: المنطقة المركزية.\n• المدة: 14 يوماً.\n• السعر للفرد: يبدأ من 35,500 ج.م فقط شامل الطيران والتأشيرة!\n\nأرسل صور الجوازات هنا لتثبيت السعر وحجز المقاعد.`,
      stage: 'qualified',
      program: 'البرنامج الاقتصادي (14 يوم)',
      commission: 7000,
      priority: 'أقل تكلفة مالية ممكنة (اقتصادي شاتل)'
    };
  }

  if (lower === '3' || lower.includes('4 نجوم') || lower.includes('بوفيه') || lower.includes('مميز')) {
    userStages.set(phone, 'done');
    return {
      text: `🎯 تم اختيار «البرنامج المميز (مستوى 4 نجوم فندقي راقي)»:\n\n• مكة المكرمة: فندق 4 نجوم فخم شامل بوفيه إفطار مفتوح يومياً.\n• المدينة المنورة: صف ثاني مباشر على ساحة الحرم النبوي.\n• المدة: 10 إلى 14 يوماً.\n• السعر للفرد: 54,500 ج.م شامل باصات VIP وطيران مباشر.\n\nتفضل بإرسال صور الجوازات لتأكيد الحجز.`,
      stage: 'qualified',
      program: 'البرنامج المميز (4 نجوم راقي)',
      commission: 13000,
      priority: 'فندق 4 نجوم فخم مع بوفيه إفطار'
    };
  }

  if (lower === '4' || lower.includes('5 نجوم') || lower.includes('vip') || lower.includes('ابراج') || lower.includes('أبراج')) {
    userStages.set(phone, 'done');
    return {
      text: `🕌 تم اختيار «برنامج النخبة والـ VIP» الخاص بـ «رِفقة»:\n\n• مكة المكرمة: صف أول مباشر ومطل على الكعبة المشرفة في أبراج الساعة (فيرمونت / سويس) أو جبل عمر.\n• المدينة المنورة: صف أول مباشر على الساحة (أوبروي / دار التقوى).\n• الانتقالات: قطار الحرمين السريع وسيارات GMC خاصة.\n• السعر: يبدأ من 85,000 ج.م.\n\n🔔 تم إشعار مدير حجوزات الـ VIP وسيقوم بالتواصل مع حضرتك فوراً لتأكيد إطلالة الغرفة وتجهيز التأشيرة.`,
      stage: 'needs_human',
      program: 'برنامج الـ 5 نجوم والـ VIP',
      commission: 26000,
      priority: 'أبراج الساعة صف أول كعبة'
    };
  }

  // Companions qualification
  if (lower.includes('لوحدي') || lower.includes('فردي') || lower.includes('اسرة') || lower.includes('أسرة') || lower.includes('كبار') || lower.includes('والد')) {
    userStages.set(phone, 'step_program');
    const comp = lower.includes('كبار') ? 'مع الوالدين وكبار سن' : (lower.includes('اسرة') || lower.includes('أسرة') ? 'مع الأسرة وأطفال' : 'مسافر منفرد');
    return {
      text: `ربنا يحفظكم ويبارك فيكم ويتقبل مقدماً يا رب 🤲\nعشان نحدد البرنامج المناسب بالملي، إيه الأولوية الأهم لحضراتكم في الإقامة والميزانية؟\n\n1️⃣ الاقتصادي المميز (3 نجوم 500م مشي مباشر للحرم بدون باصات - 42,000 ج)\n2️⃣ البرنامج الاقتصادي (14 يوم شاتل 24 ساعة بأقل تكلفة - 35,500 ج)\n3️⃣ البرنامج المميز (4 نجوم راقي شامل إفطار بوفيه مفتوح - 54,500 ج)\n4️⃣ برنامج الـ 5 نجوم والـ VIP (أبراج الساعة صف أول كعبة - 85,000 ج)\n\n(اكتب رقم البرنامج المناسب من 1 إلى 4)`,
      companions: comp,
      pax: comp === 'مسافر منفرد' ? 1 : 2
    };
  }

  // Default Welcome
  userStages.set(phone, 'step_companions');
  return {
    text: `أهلاً بحضرتك في «رِفقة» لرحلات العمرة 🕋✨\nكتب الله لكم زيارة بيته الحرام عاجلاً غير آجل.\n\nعشان أقدر أرشح لحضرتك أفضل برنامج يناسبكم تماماً، ممكن توضح لي:\nحضرتك مسافر:\n1️⃣ لوحدي\n2️⃣ مع الأسرة وأطفال\n3️⃣ مع الوالد/الوالدة وكبار سن 👵👴\n\n(اكتب رقم 1 أو 2 أو 3)`
  };
}

// ========================================================
// HTTP API Server (Render & CRM Integration)
// ========================================================
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Health check
  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      status: 'online',
      service: 'Rifqa WhatsApp Engine',
      port: PORT,
      whatsapp: connectionStatus,
      phone: connectedPhone,
      timestamp: new Date().toISOString()
    }));
  }

  // Status check & QR code
  if (url.pathname === '/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      status: connectionStatus,
      qr: currentQR,
      pairingCode: currentPairingCode,
      phone: connectedPhone,
      autoReply: autoReplyEnabled
    }));
  }

  // Toggle Auto Reply
  if (url.pathname === '/toggle-bot' && req.method === 'POST') {
    autoReplyEnabled = !autoReplyEnabled;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ autoReply: autoReplyEnabled }));
  }

  // Send message endpoint
  if (url.pathname === '/send' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { to, text } = JSON.parse(body);
        if (!to || !text || !sock) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ error: 'Missing parameters or WhatsApp socket not ready' }));
        }

        let cleanPhone = to.replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '2' + cleanPhone;
        const jid = `${cleanPhone}@s.whatsapp.net`;

        await sock.sendMessage(jid, { text: text });

        // Sync to Supabase
        let lead = await fetchLeadFromSupabase(cleanPhone);
        const now = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const existingMessages = Array.isArray(lead?.messages) ? lead.messages : [];
        existingMessages.push({
          id: Date.now(),
          sender: 'agent',
          text: text,
          time: now
        });

        await upsertLeadToSupabase({
          id: lead?.id || `lead_${cleanPhone}`,
          name: lead?.name || `معتمر (${cleanPhone.slice(-4)})`,
          phone: cleanPhone,
          stage: lead?.stage || 'proposal_sent',
          handled_by: 'agent',
          messages: existingMessages,
          last_activity: 'منذ ثوانٍ'
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true }));
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠️ Port ${PORT} is currently in use by another instance.`);
    console.error(`Please close any existing terminal, or run start.bat to auto-free it.\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Rifqa HTTP Server listening on port ${PORT}`);
  initWhatsApp();
});
