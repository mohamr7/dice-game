const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// إعدادات
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname))); // تقديم index.html مباشرة

// اتصال بقاعدة البيانات MongoDB Atlas
mongoose.connect('mongodb+srv://mohamr604:6NnhHH4KfCxSA22B@cluster0.vulhqtq.mongodb.net/diceGame?retryWrites=true&w=majority&appName=Cluster0');

const db = mongoose.connection;
db.once('open', () => console.log('✅ Connected to MongoDB Atlas'));
db.on('error', console.error);

// مخطط المستخدم
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  balance: Number,
  deposited: Number,
});

const User = mongoose.model('User', userSchema);

// مخطط طلبات الشحن والسحب
const requestSchema = new mongoose.Schema({
  userId: String,
  amount: Number,
  type: String, // 'deposit' أو 'withdraw'
  status: String, // 'pending' أو 'approved' أو 'rejected'
  createdAt: { type: Date, default: Date.now },
});

const Request = mongoose.model('Request', requestSchema);

// ========== نقاط النهاية ==========

// تسجيل مستخدم
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  const exists = await User.findOne({ username });
  if (exists) return res.status(400).json({ message: 'المستخدم موجود بالفعل' });

  const user = new User({ username, password, balance: 0, deposited: 0 });
  await user.save();
  res.json(user);
});

// تسجيل دخول
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) return res.status(401).json({ message: 'بيانات غير صحيحة' });
  res.json(user);
});

// الحصول على مستخدم
app.get('/api/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'لم يتم العثور على المستخدم' });
  res.json(user);
});

// طلب شحن أو سحب
app.post('/api/request', async (req, res) => {
  const { userId, amount, type } = req.body;
  const request = new Request({ userId, amount, type, status: 'pending' });
  await request.save();
  res.json({ message: 'تم إرسال الطلب للمراجعة' });
});

// لعب اللعبة
app.post('/api/play', async (req, res) => {
  const { userId, amount } = req.body;
  const user = await User.findById(userId);
  if (!user || user.balance < amount)
    return res.status(400).json({ message: 'رصيد غير كافي' });

  // خصم المبلغ
  user.balance -= amount;

  const win = Math.random() < 0.1; // 10% فوز
  let profit = 0;

  if (win) {
    profit = Math.floor(amount * 0.2);
    user.balance += amount + profit;
  }

  await user.save();
  res.json({ win, profit, balance: user.balance });
});

// المسؤول: عرض الطلبات
app.get('/api/admin/requests', async (req, res) => {
  const requests = await Request.find({ status: 'pending' }).sort({ createdAt: -1 });
  res.json(requests);
});

// المسؤول: قبول أو رفض طلب
app.post('/api/admin/requests/:id/:action', async (req, res) => {
  const { id, action } = req.params;
  const request = await Request.findById(id);
  if (!request) return res.status(404).json({ message: 'الطلب غير موجود' });

  const user = await User.findById(request.userId);
  if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

  if (action === 'approve') {
    if (request.type === 'deposit') {
      user.balance += request.amount;
      user.deposited += request.amount;
    } else if (request.type === 'withdraw') {
      if (user.balance >= request.amount) {
        user.balance -= request.amount;
      } else {
        return res.status(400).json({ message: 'رصيد غير كافي للسحب' });
      }
    }
    request.status = 'approved';
    await user.save();
  } else if (action === 'reject') {
    request.status = 'rejected';
  }

  await request.save();
  res.json({ message: `تم ${action === 'approve' ? 'الموافقة على' : 'رفض'} الطلب` });
});

// إرسال index.html عند الدخول للرابط الأساسي
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
