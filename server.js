const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7, cors: { origin: "*" } });

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// الاتصال بـ MongoDB
const MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('✅ تم الاتصال بـ MongoDB بنجاح'))
        .catch((err) => console.error('❌ خطأ MongoDB:', err));
}

// نموذج الرسائل مع حفظ الوقت المحسب
const MessageSchema = new mongoose.Schema({
    sender: String,
    text: String,
    file: String,
    fileName: String,
    fileType: String,
    time: String,
    createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";
const activeUsers = new Map();

io.on('connection', (socket) => {

    socket.on('join', async ({ username, date }) => {
        if (date !== '13.01.2009') {
            socket.emit('access-denied', 'التاريخ غير صحيح!');
            return;
        }

        socket.username = username;
        activeUsers.set(socket.id, username);

        socket.emit('access-granted');

        try {
            const oldMessages = await Message.find().sort({ createdAt: 1 });
            socket.emit('load_messages', oldMessages);
        } catch (err) {
            console.error(err);
        }

        io.emit('system-message', `${username} انضم إلى الدردشة.`);
        io.emit('update-user-list', Array.from(activeUsers.values()));
    });

    socket.on('send_message', async (data) => {
        // حساب وقت الإرسال الفعلي لحظة استلام السيرفر للرسالة
        const now = new Date();
        const timeString = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

        const newMsgData = {
            sender: socket.username || data.sender,
            text: data.text,
            file: data.file,
            fileName: data.fileName,
            fileType: data.fileType,
            time: timeString
        };

        if (MONGO_URI) {
            const savedMsg = new Message(newMsgData);
            await savedMsg.save();
        }

        io.emit('receive_message', newMsgData);
    });

    socket.on('clear_chat', async (data) => {
        if (data.password === ADMIN_PASSWORD) {
            if (MONGO_URI) await Message.deleteMany({});
            io.emit('chat_cleared');
        } else {
            socket.emit('error_message', '❌ كلمة السر غير صحيحة!');
        }
    });

    socket.on('call-user', (data) => socket.broadcast.emit('incoming-call', data));
    socket.on('answer-call', (data) => socket.broadcast.emit('call-answered', data));
    socket.on('ice-candidate', (candidate) => socket.broadcast.emit('ice-candidate', candidate));
    socket.on('end-call', () => socket.broadcast.emit('call-ended'));

    socket.on('disconnect', () => {
        if (socket.username) {
            activeUsers.delete(socket.id);
            io.emit('system-message', `${socket.username} غادر الدردشة.`);
            io.emit('update-user-list', Array.from(activeUsers.values()));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`));
