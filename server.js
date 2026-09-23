const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// إتاحة مجلد الملفات الثابتة وتوجيه الصفحة الرئيسية
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. الاتصال بقاعدة البيانات
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح'))
  .catch((err) => console.error('❌ خطأ في قاعدة البيانات:', err));

// 2. تصميم شكل الرسالة المخزنة
const MessageSchema = new mongoose.Schema({
  sender: String,
  text: String,
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// 3. كلمة السر لمسح الشات
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";

// 4. إدارة الاتصالات في الشات
io.on('connection', async (socket) => {

  // إرسال الرسائل القديمة للمستخدم فور دخوله
  try {
    const oldMessages = await Message.find().sort({ createdAt: 1 });
    socket.emit('load_messages', oldMessages);
  } catch (err) {
    console.error(err);
  }

  // استقبال وإعادة إرسال الرسائل الجديدة
  socket.on('send_message', async (data) => {
    const newMessage = new Message({ sender: data.sender, text: data.text });
    await newMessage.save();
    io.emit('receive_message', newMessage);
  });

  // مسح الشات بكلمة السر
  socket.on('clear_chat', async (data) => {
    if (data.password === ADMIN_PASSWORD) {
      await Message.deleteMany({});
      io.emit('chat_cleared');
    } else {
      socket.emit('error_message', '❌ كلمة السر غير صحيحة!');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`));
