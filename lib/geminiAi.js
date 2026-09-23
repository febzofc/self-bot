'use strict';

const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

/**
 * Konfigurasi Resmi Google GenAI SDK
 */
let localEnvKey = '';
try {
    const envFile = path.join(__dirname, '../.env');
    if (fs.existsSync(envFile)) {
        const envContent = fs.readFileSync(envFile, 'utf8');
        const match = envContent.match(/GEMINI_API_KEY\s*=\s*['"]?([^'"\r\n]+)['"]?/);
        if (match) localEnvKey = match[1].trim();
    }
} catch (e) {}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || (typeof global !== 'undefined' && global.geminiApiKey) || localEnvKey || '';
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/**
 * Model Pool Berkecepatan Tinggi (Ultra-Fast & Stable Quota):
 * 1. gemini-3.5-flash-lite : Sangat cepat (~2-3 detik), kuota longgar tanpa batas 20 RPD.
 * 2. gemini-3.1-flash-lite : Ringan, respon kilat (~3-5 detik).
 * 3. gemini-3-flash-preview : Cepat & pintar (RPM standard).
 * 4. gemma-4-26b-a4b-it    : Fallback cadangan independen.
 */
const CANDIDATE_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemma-4-26b-a4b-it'
];
const MODEL_NAME = CANDIDATE_MODELS[0];
const FALLBACK_MODEL = CANDIDATE_MODELS[1];

/**
 * System Instruction untuk Karakter Chat Santai, Gaul, dan Natural
 */
const SYSTEM_INSTRUCTION = `
Kamu adalah asisten chat WhatsApp bot yang santai, gaul, akrab, humoris, dan cerdas khas tongkrongan anak muda Indonesia (menggunakan panggilan seperti "lu", "gua", "wir", "cuy", "bro").

Pedoman Sikap & Gaya Percakapan:
1. Respon santai, luwes, ekspresif, tidak kaku, tidak robotik, dan tidak formal seperti asisten korporat.
2. Utamakan balasan yang singkat, padat, dan to-the-point dalam 1 pesan saja.
3. JANGAN SELALU membagi respon menjadi 2 atau 3 kali chat! Jika responnya singkat, salam, konfirmasi, atau jawaban to-the-point, KIRIM 1 PESAN SAJA secara natural.
4. Hanya gunakan penanda "[SPLIT]" jika memang percakapan memerlukan jeda alami atau terdiri dari 2 pemikiran yang berbeda (maksimal 2 atau 3 potongan pesan, jangan berlebihan).
5. Ekspresi Emosi & Stiker:
   - Jika responmu mengekspresikan emosi tertentu yang cocok dengan stiker (seperti: senang, sedih, sus, pujian, mabar, lucu, kaget, marah, bingung), kamu BISA menyertakan tag ekspresi di akhir pesan dengan format: [EXPR: nama_ekspresi]
   - Contoh: [EXPR: sus], [EXPR: sedih], [EXPR: mabar], [EXPR: pujian], [EXPR: lucu]
6. Event Voice Note (Mendatang):
   - Jika percakapan memicu momen khusus tertentu (misal: menyapa hangat, nyanyi, ucapan selamat, curhat mendalam), sertakan tag: [VN_EVENT: nama_event]
7. Pengetahuan & Kemampuan:
   - Kamu adalah AI dialog umum. Jawab obrolan sehari-hari, tebak-tebakan, saran, curhat, pengetahuan umum, hingga candaan dengan cerdas dan asik.
`.trim();

/**
 * Generate respon menggunakan SDK Resmi @google/genai (Interactions API)
 * Dioptimalkan dengan thinking_level minimal & fail-fast zero-retry agar respon super kilat (~2-3 detik)
 * @param {object} params
 * @param {string} params.prompt - Teks pertanyaan / pesan dari user
 * @param {string} [params.previousInteractionId] - ID interaksi sebelumnya untuk stateful context memory
 * @param {string} [params.pushname] - Nama panggilan pengguna di WhatsApp
 */
async function generateChatResponse({ prompt, previousInteractionId = null, pushname = '' }) {
    const userPromptText = pushname
        ? `[Pengirim: ${pushname}]\n${prompt}`
        : prompt;

    let rawReply = '';
    let interactionId = null;
    let usedModel = null;
    let lastError = null;

    // Iterasi model pool dengan fail-fast (maxRetries: 0) agar tidak tertahan delay retry SDK
    for (const model of CANDIDATE_MODELS) {
        try {
            const payload = {
                model,
                input: userPromptText,
                system_instruction: SYSTEM_INSTRUCTION,
                generation_config: {
                    thinking_level: 'minimal'
                }
            };

            if (previousInteractionId) {
                payload.previous_interaction_id = previousInteractionId;
            }

            const interaction = await ai.interactions.create(payload, { maxRetries: 0 });
            interactionId = interaction.id;
            rawReply = interaction.output_text || '';
            usedModel = model;
            break;
        } catch (err) {
            lastError = err;
            console.warn(`[geminiAi] Model ${model} terkendala (${err.message?.substring(0, 100)}), mencoba model berikutnya...`);

            // Jika error disebabkan oleh previous_interaction_id (misal id kedaluwarsa atau mismatch model), coba sekali lagi tanpa previous_interaction_id
            if (previousInteractionId) {
                try {
                    const freshPayload = {
                        model,
                        input: userPromptText,
                        system_instruction: SYSTEM_INSTRUCTION,
                        generation_config: {
                            thinking_level: 'minimal'
                        }
                    };
                    const interaction = await ai.interactions.create(freshPayload, { maxRetries: 0 });
                    interactionId = interaction.id;
                    rawReply = interaction.output_text || '';
                    usedModel = model;
                    break;
                } catch (retryErr) {
                    lastError = retryErr;
                }
            }
        }
    }

    if (!rawReply && lastError) {
        console.error('[geminiAi] Seluruh model AI dalam pool gagal dieksekusi:', lastError);
        throw new Error(`Gagal mendapatkan respon dari AI: ${lastError.message}`);
    }

    // 2. Parsing tag ekspresi emosi & event VN
    let expression = null;
    let vnEvent = null;

    // Ambil tag [EXPR: xxx]
    const exprMatch = rawReply.match(/\[EXPR:\s*([a-zA-Z0-9_\-]+)\]/i);
    if (exprMatch) {
        expression = exprMatch[1].toLowerCase().trim();
        rawReply = rawReply.replace(/\[EXPR:\s*([a-zA-Z0-9_\-]+)\]/gi, '').trim();
    }

    // Ambil tag [VN_EVENT: xxx]
    const vnMatch = rawReply.match(/\[VN_EVENT:\s*([a-zA-Z0-9_\-]+)\]/i);
    if (vnMatch) {
        vnEvent = vnMatch[1].toLowerCase().trim();
        rawReply = rawReply.replace(/\[VN_EVENT:\s*([a-zA-Z0-9_\-]+)\]/gi, '').trim();
    }

    // 3. Penataan Balon Chat (Hanya pecah jika ada [SPLIT], jika singkat/biasa cukup 1 kali)
    let bubbles = [];
    if (rawReply.includes('[SPLIT]')) {
        bubbles = rawReply
            .split('[SPLIT]')
            .map(t => t.trim())
            .filter(t => t.length > 0)
            .slice(0, 3);
    } else {
        // Balasan normal/singkat: default 1 balon chat saja
        bubbles = [rawReply.trim()];
    }

    if (bubbles.length === 0 || !bubbles[0]) {
        bubbles = [rawReply.trim() || 'Halo wir!'];
    }

    const cleanFullText = bubbles.join('\n');

    return {
        bubbles,
        fullText: cleanFullText,
        interactionId,
        expression,
        vnEvent,
        usedModel: usedModel || MODEL_NAME
    };
}

/**
 * Placeholder API Voice Note (VN)
 * Saat API VN / TTS dari pengguna sudah siap, fungsi ini akan memanggil endpoint tsb
 */
async function generateVoiceNoteBuffer(text, event = 'general') {
    // Siap diintegrasikan dengan API VN pengguna saat API disusulkan
    return null;
}

/**
 * Cek apakah fitur VN aktif untuk event tertentu
 */
function isVoiceNoteEnabled(event) {
    return false;
}

module.exports = {
    ai,
    GEMINI_API_KEY,
    MODEL_NAME,
    FALLBACK_MODEL,
    CANDIDATE_MODELS,
    SYSTEM_INSTRUCTION,
    generateChatResponse,
    generateVoiceNoteBuffer,
    isVoiceNoteEnabled
};
