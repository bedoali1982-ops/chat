const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 1. إعداد البورت من بيئة التشغيل (مهم لـ Render)
const PORT = process.env.PORT || 3000;

// 2. الاتصال بقاعدة البيانات MongoDB (قم بتغيير الرابط برابط MongoDB Atlas الخاص بك إن وجد)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chatApp';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ تم الاتصال بقاعدة البيانات MongoDB بنجاح'))
  .catch((err) => console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err));

// 3. تعريف هيكل الرسالة (Schema & Model)
const messageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    text: { type: String, default: '' },
    file: { type: String, default: null },
    fileName: { type: String, default: null },
    fileType: { type: String, default: null },
    createdAt: { type: Date, default: Date.now } // التوقيت القياسي الموحد
});

const Message = mongoose.model('Message', messageSchema);

// 4. تقديم الملفات الثابتة (مجلد المترجم/العميل)
app.use(express.static(path.join(__dirname, 'public')));

// 5. إدارة اتصالات Socket.io
io.on('connection', async (socket) => {
    console.log(`🔌 مستخدم جديد متصل: ${socket.id}`);

    // أ) تحميل الرسائل القديمة فور دخول المستخدم
    try {
        const oldMessages = await Message.find().sort({ createdAt: 1 });
        socket.emit('load_old_messages', oldMessages);
    } catch (err) {
        console.error('❌ خطأ أثناء تجليب الرسائل القديمة:', err);
    }

    // ب) استقبال ورسائل جديدة
    socket.on('send_message', async (data) => {
        try {
            const msgData = {
                sender: data.sender,
                text: data.text,
                file: data.file,
                fileName: data.fileName,
                fileType: data.fileType,
                createdAt: new Date() // يرسل الوقت الخام
            };

            const savedMsg = new Message(msgData);
            await savedMsg.save(); // ✅ استخدام await بشكل صحيح داخل async

            // بث الرسالة للجميع
            io.emit('receive_message', savedMsg);
        } catch (err) {
            console.error('❌ خطأ أثناء حفظ أو إرسال الرسالة:', err);
        }
    });

    // ج) مسح كافة الرسائل (باستخدام كلمة السر)
    socket.on('clear_chat', async (data) => {
        try {
            // يمكنك تغيير كلمة السر هنا
            if (data.password === '123456') { 
                await Message.deleteMany({});
                io.emit('chat_cleared');
            } else {
                socket.emit('error_message', 'كلمة السر غير صحيحة!');
            }
        } catch (err) {
            console.error('❌ خطأ أثناء مسح الشات:', err);
        }
    });

    // د) عند قطع الاتصال
    socket.on('disconnect', () => {
        console.log(`❌ انقطع اتصال المستخدم: ${socket.id}`);
    });
});

// 6. تشغيل السيرفر
server.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل الآن على البورت ${PORT}`);
});
