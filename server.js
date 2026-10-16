// -*- coding: utf-8 -*-
/**
 * ==============================================================================
 * 🕋  RIFQA SMART WHATSAPP & CRM REALTIME ENGINE
 * ==============================================================================
 * - Clean Code Architecture
 * - Native WhatsApp Interactive List Menus (single_select) & Native Buttons (quick_reply)
 * - Professional Luxury Brand Copywriting (Zero spam links, zero cheesy emojis)
 * - 4 Umrah Programs & Live Commission Triage (Zero "شعبي")
 * - Realtime Supabase Synchronization & Admin CRM Integration
 * - Port: process.env.PORT || 3005
 * ==============================================================================
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// ==============================================================================
// 1. Dependency Loader
// ==============================================================================
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
    console.error('[Fatal Error]: Could not load dependencies. Run `npm install` first.');
    process.exit(1);
  }
}

const makeWASocket = baileys.default || baileys.makeWASocket;
const { 
  DisconnectReason, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion 
} = baileys;

process.on('uncaughtException', (err) => {
  console.error('[Process UncaughtException]:', err.stack || err.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Process UnhandledRejection]:', reason?.stack || reason?.message || reason);
});
process.on('exit', (code) => {
  console.log(`[Process EXIT Event] Code: ${code}`);
});

// ==============================================================================
// 2. Global Configuration & State
// ==============================================================================
const PORT = process.env.PORT || 3005;
const PHONE_NUMBER = '201554463293';
const AUTH_DIR = path.join(__dirname, 'whatsapp_auth_session');
const SUPABASE_URL = 'https://nifwgokownhyyksgcykk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pZndnb2tvd25oeXlrc2djeWtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMDEwNzAsImV4cCI6MjEwNzY3NzA3MH0.9IY6lY4uU85LvkdYZI0RyChH_UIWXGMSvtmS3Ks1cj0';

// Live Engine State
let sock = null;
let currentQR = null;
let currentPairingCode = null;
let connectionStatus = 'disconnected'; // disconnected, scan_qr, connecting, connected
let connectedPhone = '';
let autoReplyEnabled = true;
const processedMsgIds = new Set();
const userStages = new Map();

// ==============================================================================
// 3. Rifqa 4 Umrah Programs Catalog (Strict Rule: Zero "شعبي")
// ==============================================================================
const RIFQA_PROGRAMS = {
  prog_1: {
    id: 'prog_1',
    name: 'البرنامج الاقتصادي المميز (3 نجوم قريب المشي)',
    price: 42000,
    priceStr: '42,000 ج.م',
    commission: 9000,
    hotelMakkah: 'فندق 3 نجوم يبعد 500 متر فقط مشي مباشر للحرم (أجياد / إبراهيم الخليل) دون باصات',
    hotelMadinah: 'المنطقة المركزية بجوار الحرم النبوي',
    duration: '14 يوماً',
    priority: 'فندق 3 نجوم قريب مشي دون باصات'
  },
  prog_2: {
    id: 'prog_2',
    name: 'البرنامج الاقتصادي المعتمد (14 يوماً)',
    price: 35500,
    priceStr: '35,500 ج.م',
    commission: 7000,
    hotelMakkah: 'فنادق حديثة بالعزيزية / محبس الجن مع باصات شاتل مكيفة على مدار 24 ساعة لساحة الحرم',
    hotelMadinah: 'المنطقة المركزية',
    duration: '14 يوماً',
    priority: 'أوفر تكلفة اقتصادية مع باصات شاتل'
  },
  prog_3: {
    id: 'prog_3',
    name: 'البرنامج المميز (4 نجوم فندقي راقي)',
    price: 54500,
    priceStr: '54,500 ج.م',
    commission: 13000,
    hotelMakkah: 'فندق 4 نجوم راقي شامل بوفيه إفطار مفتوح يومياً',
    hotelMadinah: 'صف ثاني مباشر على ساحة الحرم النبوي',
    duration: '10 إلى 14 يوماً',
    priority: 'فندق 4 نجوم فخم مع بوفيه إفطار'
  },
  prog_4: {
    id: 'prog_4',
    name: 'برنامج الـ 5 نجوم والـ VIP',
    price: 85000,
    priceStr: '85,000 ج.م',
    commission: 26000,
    hotelMakkah: 'أبراج الساعة صف أول مباشر ومطل على الكعبة (فيرمونت / سويس) أو جبل عمر',
    hotelMadinah: 'صف أول مباشر على الحرم النبوي (دار التقوى / أوبروي)',
    duration: '10 إلى 14 يوماً',
    priority: 'أبراج الساعة صف أول كعبة وسيارات VIP خاصة'
  }
};

// ==============================================================================
// 4. Supabase Realtime Persistence Layer
// ==============================================================================
async function fetchLeadFromSupabase(phone) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?phone=eq.${phone}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (res.ok) {
      const data = await res.json();
      return data[0] || null;
    }
  } catch (e) {}
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
      console.warn('[Supabase Warning]:', err);
    }
  } catch (e) {
    console.warn('[Supabase Error]:', e.message);
  }
}

// ==============================================================================
// 5. Inbound Message & Button Event Normalizer
// ==============================================================================
function extractMessageContent(msg) {
  const m = msg.message;
  if (!m) return { text: '', buttonId: null, isButton: false };

  // 1. Native Flow Interactive Response
  const interactive = m.interactiveResponseMessage ||
                      m.messageContextInfo?.deviceSentMessage?.message?.interactiveResponseMessage;
  if (interactive) {
    const nativeFlow = interactive.nativeFlowResponseMessage;
    if (nativeFlow) {
      try {
        const parsed = JSON.parse(nativeFlow.paramsJson || '{}');
        const id = parsed.id || parsed.rowId || nativeFlow.selectedButtonId || '';
        return { text: id, buttonId: id, isButton: true };
      } catch (e) {
        const id = nativeFlow.selectedButtonId || '';
        return { text: id, buttonId: id, isButton: true };
      }
    }
    if (interactive.body?.text) {
      return { text: interactive.body.text, buttonId: null, isButton: false };
    }
  }

  // 2. Single Select List Response
  if (m.listResponseMessage) {
    const rowId = m.listResponseMessage.singleSelectReply?.selectedRowId || '';
    return { text: rowId, buttonId: rowId, isButton: true };
  }

  // 3. Template Buttons Response
  if (m.templateButtonReplyMessage) {
    const btnId = m.templateButtonReplyMessage.selectedId || '';
    return { text: btnId, buttonId: btnId, isButton: true };
  }

  // 4. Quick Reply Buttons Response
  if (m.buttonsResponseMessage) {
    const btnId = m.buttonsResponseMessage.selectedButtonId || '';
    return { text: btnId, buttonId: btnId, isButton: true };
  }

  // 5. Standard Text Message
  const rawText = m.conversation ||
                  m.extendedTextMessage?.text ||
                  m.imageMessage?.caption || '';

  return { text: rawText.trim(), buttonId: null, isButton: false };
}

// ==============================================================================
// 6. Native Interactive Message Dispatcher (Pure Native Menu & Buttons)
// ==============================================================================
async function sendNativeInteractiveReply(socket, jid, replyData) {
  const { text, header = 'شركة رِفقة للعمرة', footer = 'رِفقة - رفيقكم لبيت الله الحرام', buttons = [] } = replyData;

  // If no buttons, send clean plain text
  if (!buttons || buttons.length === 0) {
    return await socket.sendMessage(jid, { text });
  }

  try {
    const formattedButtons = buttons.map(btn => {
      if (btn.type === 'single_select') {
        return {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: btn.title,
            sections: btn.sections
          })
        };
      } else {
        return {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: btn.displayText,
            id: btn.id
          })
        };
      }
    });

    const payload = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            header: { title: header, hasMediaAttachment: false },
            body: { text: text },
            footer: { text: footer },
            nativeFlowMessage: {
              buttons: formattedButtons
            }
          }
        }
      }
    };

    return await socket.sendMessage(jid, payload);
  } catch (err) {
    console.warn('[Interactive Fallback to Text]:', err.message);
    return await socket.sendMessage(jid, { text });
  }
}

// ==============================================================================
// 7. Rifqa Triage Engine (Clean Luxury Copy & Native Menus)
// ==============================================================================
function computeTriageReply(userText, buttonId, phone, existingLead) {
  const lower = (userText || '').trim().toLowerCase();
  const clickedId = buttonId || '';

  // 1. Human Escalation Trigger
  const humanWords = ['موظف', 'مدير', 'تليفون', 'رن عليا', 'كلمني', 'مسؤول', 'حد يكلمني', 'انسان'];
  if (clickedId === 'ask_human' || humanWords.some(w => lower.includes(w))) {
    return {
      text: 'تم إشعار مدير الحجوزات، وسيقوم بالتواصل مع حضرتك فوراً للرد على كافة الاستفسارات وتثبيت السعر.',
      stage: 'needs_human',
      buttons: [
        { type: 'quick_reply', displayText: 'عرض برامج العمرة', id: 'show_programs' }
      ]
    };
  }

  // 2. Deposit / Passports Booking Step
  const depositWords = ['جواز', 'جوازات', 'صور', 'مقدم', 'عربون', 'حجز', 'احجز'];
  if (clickedId === 'book_now' || depositWords.some(w => lower.includes(w))) {
    return {
      text: 'مبارك مقدماً زيارة بيت الله الحرام.\nيرجى إرسال صور جوازات السفر واضحة هنا، وسيقوم مسؤول الحجوزات بإصدار العقد وتثبيت المقاعد فوراً.',
      stage: 'deposit_paid',
      buttons: [
        { type: 'quick_reply', displayText: 'التواصل مع مسؤول الحجوزات', id: 'ask_human' }
      ]
    };
  }

  // 3. Program Choice Routing (1 to 4 or Button IDs)
  if (clickedId === 'prog_1' || lower === '1' || lower.includes('قريب المشي') || lower.includes('اقتصادي مميز') || lower.includes('مشي')) {
    userStages.set(phone, 'done');
    const p = RIFQA_PROGRAMS.prog_1;
    return {
      text: `تم اختيار «${p.name}»:\n\n• مكة المكرمة: ${p.hotelMakkah}.\n• المدينة المنورة: ${p.hotelMadinah}.\n• المدة: ${p.duration}.\n• السعر للفرد: ${p.priceStr} فقط شامل الطيران والتأشيرة والباركود والانتقالات.\n\nلتأكيد المقاعد وتثبيت السعر، يرجى الضغط على زر تأكيد الحجز أدناه وإرسال صور جوازات السفر.`,
      stage: 'qualified',
      program: p.name,
      commission: p.commission,
      priority: p.priority,
      buttons: [
        { type: 'quick_reply', displayText: 'تأكيد الحجز الآن', id: 'book_now' },
        { type: 'quick_reply', displayText: 'التواصل مع مسؤول الحجوزات', id: 'ask_human' }
      ]
    };
  }

  if (clickedId === 'prog_2' || lower === '2' || lower.includes('شاتل') || (lower.includes('اقتصادي') && !lower.includes('مميز'))) {
    userStages.set(phone, 'done');
    const p = RIFQA_PROGRAMS.prog_2;
    return {
      text: `تم اختيار «${p.name}»:\n\n• مكة المكرمة: ${p.hotelMakkah}.\n• المدينة المنورة: ${p.hotelMadinah}.\n• المدة: ${p.duration}.\n• السعر للفرد: يبدأ من ${p.priceStr} فقط شامل الطيران والتأشيرة!\n\nلتأكيد المقاعد وتثبيت السعر، يرجى الضغط على زر تأكيد الحجز أدناه وإرسال صور جوازات السفر.`,
      stage: 'qualified',
      program: p.name,
      commission: p.commission,
      priority: p.priority,
      buttons: [
        { type: 'quick_reply', displayText: 'تأكيد الحجز الآن', id: 'book_now' },
        { type: 'quick_reply', displayText: 'التواصل مع مسؤول الحجوزات', id: 'ask_human' }
      ]
    };
  }

  if (clickedId === 'prog_3' || lower === '3' || lower.includes('4 نجوم') || lower.includes('بوفيه') || lower.includes('مميز')) {
    userStages.set(phone, 'done');
    const p = RIFQA_PROGRAMS.prog_3;
    return {
      text: `تم اختيار «${p.name}»:\n\n• مكة المكرمة: ${p.hotelMakkah}.\n• المدينة المنورة: ${p.hotelMadinah}.\n• المدة: ${p.duration}.\n• السعر للفرد: ${p.priceStr} شامل باصات VIP وطيران مباشر.\n\nلتأكيد المقاعد وتثبيت السعر، يرجى الضغط على زر تأكيد الحجز أدناه وإرسال صور جوازات السفر.`,
      stage: 'qualified',
      program: p.name,
      commission: p.commission,
      priority: p.priority,
      buttons: [
        { type: 'quick_reply', displayText: 'تأكيد الحجز الآن', id: 'book_now' },
        { type: 'quick_reply', displayText: 'التواصل مع مسؤول الحجوزات', id: 'ask_human' }
      ]
    };
  }

  if (clickedId === 'prog_4' || lower === '4' || lower.includes('5 نجوم') || lower.includes('vip') || lower.includes('ابراج') || lower.includes('أبراج')) {
    userStages.set(phone, 'done');
    const p = RIFQA_PROGRAMS.prog_4;
    return {
      text: `تم اختيار «${p.name}» الخاص بـ «رِفقة»:\n\n• مكة المكرمة: ${p.hotelMakkah}.\n• المدينة المنورة: ${p.hotelMadinah}.\n• الانتقالات: قطار الحرمين السريع وسيارات خاصة.\n• السعر: يبدأ من ${p.priceStr}.\n\nتم إشعار مدير حجوزات الـ VIP وسيقوم بالتواصل مع حضرتك فوراً لتأكيد إطلالة الغرفة وتجهيز التأشيرة.`,
      stage: 'needs_human',
      program: p.name,
      commission: p.commission,
      priority: p.priority,
      buttons: [
        { type: 'quick_reply', displayText: 'تأكيد الحجز الآن', id: 'book_now' },
        { type: 'quick_reply', displayText: 'التواصل مع مدير الـ VIP', id: 'ask_human' }
      ]
    };
  }

  // 4. Companionship Routing & Programs Presentation
  if (clickedId === 'show_programs' || clickedId.startsWith('comp_') || lower.includes('لوحدي') || lower.includes('فردي') || lower.includes('اسرة') || lower.includes('أسرة') || lower.includes('كبار') || lower.includes('والد')) {
    userStages.set(phone, 'step_program');
    const isParents = clickedId === 'comp_parents' || lower.includes('كبار') || lower.includes('والد');
    const isFamily = clickedId === 'comp_family' || lower.includes('اسرة') || lower.includes('أسرة');
    const compText = isParents ? 'مع الوالدين (كبار السن)' : (isFamily ? 'مع الأسرة والأطفال' : 'مسافر منفرد');

    return {
      text: `برامج العمرة المعتمدة لدى «رِفقة»:\n\n• البرنامج الاقتصادي المميز: 3 نجوم 500 متر مشي مباشر للحرم (42,000 ج.م)\n• البرنامج الاقتصادي: 14 يوماً شاتل باص 24 ساعة (35,500 ج.م)\n• البرنامج المميز: 4 نجوم راقي شامل إفطار بوفيه مفتوح (54,500 ج.م)\n• برنامج الـ 5 نجوم والـ VIP: أبراج الساعة صف أول كعبة (85,000 ج.م)\n\nيرجى فتح القائمة أدناه لاختيار البرنامج المناسب:`,
      stage: 'proposal_sent',
      companions: compText,
      pax: compText === 'مسافر منفرد' ? 1 : 2,
      buttons: [
        {
          type: 'single_select',
          title: 'اختيار برنامج العمرة',
          sections: [
            {
              title: 'برامج عمرة رِفقة المعتمدة',
              rows: [
                { id: 'prog_1', rowId: 'prog_1', title: 'البرنامج الاقتصادي المميز', description: '42,000 ج.م - 3 نجوم 500م مشي مباشر' },
                { id: 'prog_2', rowId: 'prog_2', title: 'البرنامج الاقتصادي المعتمد', description: '35,500 ج.م - 14 يوماً شاتل باص 24 ساعة' },
                { id: 'prog_3', rowId: 'prog_3', title: 'البرنامج المميز (4 نجوم)', description: '54,500 ج.م - فندق راقي مع إفطار بوفيه' },
                { id: 'prog_4', rowId: 'prog_4', title: 'برنامج النخبة والـ VIP', description: '85,000 ج.م - أبراج الساعة صف أول كعبة' }
              ]
            }
          ]
        },
        { type: 'quick_reply', displayText: 'التواصل مع مسؤول الحجوزات', id: 'ask_human' }
      ]
    };
  }

  // 5. Default Welcome Greeting
  userStages.set(phone, 'step_companions');
  return {
    text: `أهلاً بحضرتك في «رِفقة» لرحلات العمرة.\nتقبل الله منكم صالح الأعمال ومبارك الزيارة مقدماً.\n\nلتحديد البرنامج الأنسب لرحلتكم وتفاصيل الإقامة، يرجى اختيار الفئة المسافرة من القائمة أدناه:`,
    stage: 'new_lead',
    buttons: [
      {
        type: 'single_select',
        title: 'تحديد رفقاء السفر',
        sections: [
          {
            title: 'من سيسافر معكم في هذه الرحلة؟',
            rows: [
              { id: 'comp_solo', rowId: 'comp_solo', title: 'مسافر منفرد (لوحدي)', description: 'حجز غرفة مفردة أو مشاركة ثنائية' },
              { id: 'comp_family', rowId: 'comp_family', title: 'مع الأسرة والأطفال', description: 'برامج عائلية مريحة وفسيحة' },
              { id: 'comp_parents', rowId: 'comp_parents', title: 'مع الوالدين (كبار السن)', description: 'أقرب الفنادق لساحة الحرم لتجنب المشقة' }
            ]
          }
        ]
      },
      { type: 'quick_reply', displayText: 'التواصل مع مسؤول الحجوزات', id: 'ask_human' }
    ]
  };
}

// ==============================================================================
// 8. Baileys WhatsApp Connection Manager
// ==============================================================================
async function initWhatsApp() {
  connectionStatus = 'connecting';
  console.log('[WhatsApp] Initializing connection socket...');

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
      browser: ['Rifqa CRM', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false
    });

    sock.ev.on('creds.update', saveCreds);

    // Auto-generate 8-digit Pairing Code if session is not yet registered
    if (!state.creds.registered && !state.creds.me) {
      setTimeout(async () => {
        try {
          if (!sock?.user && connectionStatus !== 'connected') {
            currentPairingCode = await sock.requestPairingCode(PHONE_NUMBER);
            console.log('\n======================================================');
            console.log(`🔑 كود الربط الرقمي المباشر لواتساب (Pairing Code):`);
            console.log(`               👉  ${currentPairingCode}  👈`);
            console.log('======================================================\n');
          }
        } catch (e) {
          console.warn('[Pairing Code Guard]:', e.message);
        }
      }, 4000);
    }

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionStatus = 'scan_qr';
        try {
          currentQR = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
          console.log('[WhatsApp] 📷 NEW QR CODE READY in CRM Dashboard!');
        } catch (e) {}
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[WhatsApp] Closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
        connectionStatus = 'disconnected';
        currentQR = null;
        if (shouldReconnect) {
          setTimeout(initWhatsApp, 3000);
        } else {
          try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (e) {}
          setTimeout(initWhatsApp, 3000);
        }
      } else if (connection === 'open') {
        connectionStatus = 'connected';
        currentQR = null;
        const userJid = sock.user?.id || '';
        connectedPhone = userJid.split(':')[0] || '';
        state.creds.registered = true;
        try { await saveCreds(); } catch (e) {}
        console.log('\n======================================================');
        console.log(`[WhatsApp] 🟢 CONNECTED! Phone: ${connectedPhone}`);
        console.log(`[WhatsApp] Rifqa Smart Triage Engine is LIVE!`);
        console.log('======================================================\n');
      }
    });

    // Inbound Messages & Interactive Events Listener
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
        
        // Extract normalized content & button payload
        const { text, buttonId, isButton } = extractMessageContent(msg);
        if (!text && !buttonId) continue;

        const logBadge = isButton ? `🔘 BUTTON [${buttonId}]` : `💬 TEXT [${text}]`;
        console.log(`[WhatsApp] ${isFromMe ? 'OUT ->' : 'IN <-'} [${pushName} - ${senderPhone}]: ${logBadge}`);

        // Supabase Lead History
        let lead = await fetchLeadFromSupabase(senderPhone);
        const now = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const existingMessages = Array.isArray(lead?.messages) ? lead.messages : [];

        existingMessages.push({
          id: Date.now(),
          sender: isFromMe ? 'agent' : 'customer',
          text: isButton ? `[اختيار: ${buttonId}]` : text,
          time: now
        });

        // Compute Automated Triage Reply (Allows owner self-testing without loop)
        const isSelfTest = isFromMe && fromJid.includes(PHONE_NUMBER);
        const shouldReply = autoReplyEnabled && lead?.stage !== 'needs_human' && (!isFromMe || isSelfTest);

        if (shouldReply) {
          const reply = computeTriageReply(text, buttonId, senderPhone, lead);
          if (reply) {
            try {
              await sock.sendPresenceUpdate('composing', fromJid);
              await new Promise(r => setTimeout(r, 600));

              // Send native interactive message with dropdown list & buttons
              const sentMsg = await sendNativeInteractiveReply(sock, fromJid, reply);
              if (sentMsg?.key?.id) {
                processedMsgIds.add(sentMsg.key.id);
              }

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
            } catch (sendErr) {
              console.error('[Send Reply Error]:', sendErr.message);
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

  } catch (err) {
    console.error('[WhatsApp Init Error]:', err);
    setTimeout(initWhatsApp, 5000);
  }
}

// ==============================================================================
// 9. HTTP REST API Server (CRM & Dashboard Bridge)
// ==============================================================================
const server = http.createServer(async (req, res) => {
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

  // Engine Status & Live Auth Tokens
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

  // Toggle Bot Auto Reply
  if (url.pathname === '/toggle-bot' && req.method === 'POST') {
    autoReplyEnabled = !autoReplyEnabled;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ autoReply: autoReplyEnabled }));
  }

  // CRM Agent Manual Send Message
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
      } catch (e) {
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
  console.log(`====================================================`);
  console.log(`🕋  RIFQA SMART WHATSAPP & CRM REALTIME ENGINE`);
  console.log(`🚀  HTTP Server listening on port ${PORT}`);
  console.log(`====================================================`);
  initWhatsApp();
});
