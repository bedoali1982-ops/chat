const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

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

// 3. كلمة السر لمسح الشات (تُجلب من إعدادات Render أو تكون 123456 افتراضياً)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";

// 4. إدارة الاتصالات في الشات
io.on('connection', async (socket) => {

  // عند دخول مستخدم جديد: نرسل له كل الرسائل القديمة من قاعدة البيانات
  try {
    const oldMessages = await Message.find().sort({ createdAt: 1 });
    socket.emit('load_messages', oldMessages);
  } catch (err) {
    console.error(err);
  }

  // عند إرسال رسالة جديدة: نحفظها ونرسلها للجميع
  socket.on('send_message', async (data) => {
    const newMessage = new Message({ sender: data.sender, text: data.text });
    await newMessage.save();
    io.emit('receive_message', newMessage);
  });

  // عند طلب مسح الرسائل بكلمة السر
  socket.on('clear_chat', async (data) => {
    if (data.password === ADMIN_PASSWORD) {
      await Message.deleteMany({}); // مسح من قاعدة البيانات
      io.emit('chat_cleared');      // تنبيه كل الناس بمحوها من الشاشة
    } else {
      socket.emit('error_message', '❌ كلمة السر غير صحيحة!');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`));
