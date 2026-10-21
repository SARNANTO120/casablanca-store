const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { put, list } = require('@vercel/blob');

const app = express();

// إعدادات أساسية
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..'))); // لجلب ملف index.html من المجلد الأعلى

const HAS_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const DB_BLOB_PATH = 'db/database.json';

// --- إعدادات قاعدة البيانات (مؤقتة لـ Vercel) ---
// ملاحظة: Vercel لا يحفظ الملفات، لذلك سنستخدم الذاكرة مؤقتاً
let db = {
    users: [{
        id: 1, name: "Administrator", email: "mohamadhabar120@gmail.com",
        password: "SARNANTO_X123", isAdmin: true, banned: false,
        createdAt: new Date().toISOString()
    }],
    mods: [], resourcePacks: [], ideas: [], logs: [],
    visitors: 128, totalDownloads: 0
};

// دالة لجلب قاعدة البيانات (إذا كنت تستخدم Blob)
async function loadDB() {
    if (HAS_BLOB) {
        try {
            const { blobs } = await list({ prefix: DB_BLOB_PATH, limit: 1 });
            const dbBlob = blobs.find(b => b.pathname === DB_BLOB_PATH);
            if (dbBlob) {
                const res = await fetch(dbBlob.url, { cache: 'no-store' });
                if (res.ok) return await res.json();
            }
        } catch (e) { console.error('Blob DB load error:', e); }
    }
    return db;
}

// دالة لحفظ قاعدة البيانات
async function saveDB(data) {
    if (HAS_BLOB) {
        try {
            await put(DB_BLOB_PATH, JSON.stringify(data, null, 2), {
                access: 'public',
                contentType: 'application/json',
                addRandomSuffix: false,
                allowOverwrite: true
            });
        } catch (e) { console.error('Blob DB save error:', e); }
    }
}

// --- Middleware ---
app.use(async (req, res, next) => {
    if (HAS_BLOB) {
        try { db = await loadDB(); } catch (e) { console.error(e); }
    }
    next();
});

function generateToken() { return 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9); }
function generateId() { return Date.now() + '_' + Math.random().toString(36).substr(2, 9); }

function authMiddleware(req, res, next) {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const user = db.users.find(u => u.token === token);
    if (!user) return res.status(401).json({ error: "Invalid token" });
    req.user = user;
    next();
}

// --- Routes ---

// تسجيل الدخول
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = db.users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: "❌ البريد غير موجود" });
    if (user.password !== password) return res.status(401).json({ error: "❌ كلمة مرور خاطئة" });

    const tok = generateToken();
    user.token = tok;
    db.visitors++;
    await saveDB(db);
    
    res.json({
        success: true, token: tok,
        user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin }
    });
});

// جلب بيانات المستخدم الحالي
app.get('/api/me', (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.json({ user: null });
    const user = db.users.find(u => u.token === token);
    if (!user) return res.json({ user: null });
    res.json({ user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin } });
});

// إحصائيات (للتأكد من عمل الخادم)
app.get('/api/stats', (req, res) => {
    res.json({
        users: db.users.length, mods: db.mods.length,
        resourcePacks: db.resourcePacks.length, ideas: db.ideas.length,
        downloads: db.totalDownloads || 0, visitors: db.visitors || 0
    });
});

// جلب المودات
app.get('/api/mods', (req, res) => { res.json({ mods: db.mods }); });

// إضافة مود (للأدمن)
app.post('/api/mods', authMiddleware, async (req, res) => {
    const { name, desc, iconUrl, downloadLink } = req.body;
    if (!name) return res.status(400).json({ error: "اسم المود مطلوب" });
    
    const newMod = {
        id: generateId(), name, desc, iconUrl, downloadLink,
        isFree: true, downloads: 0, createdAt: new Date().toISOString()
    };
    db.mods.push(newMod);
    await saveDB(db);
    res.json({ success: true, mod: newMod });
});

// حذف مود (للأدمن)
app.delete('/api/mods/:id', authMiddleware, async (req, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ error: "Admin only" });
    db.mods = db.mods.filter(m => m.id !== req.params.id);
    await saveDB(db);
    res.json({ success: true });
});

// --- توجيه الصفحة الرئيسية ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// معالجة الأخطاء
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message || 'حدث خطأ ما!' });
});

// تصدير التطبيق لـ Vercel (مهم جداً!)
module.exports = app;