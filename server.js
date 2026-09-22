const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e7 // السماح برفع ملفات حتى 10 ميجابايت
});

// إعداد خدمة إرسال الإيميل (استبدل البيانات ببيانات إيميلك المرسِل)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com', // إيميلك الذي سيرسل
        pass: process.env.EMAIL_PASS || 'your-app-password'    // كلمة مرور التطبيق (App Password)
    }
});

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    
    // تسجيل الدخول والتحقق من التاريخ
    socket.on('join', ({ username, date }) => {
        if (date !== '13.01.2007') {
            socket.emit('access-denied', 'التاريخ غير صحيح! لا يمكن الدخول.');
            return;
        }
        socket.username = username;
        socket.emit('access-granted');
        io.emit('system-message', `${username} انضم إلى الدردشة.`);
    });

    // إرسال الرسائل الإيميل والدردشة
    socket.on('chat-message', (data) => {
        // 1. بث الرسالة لجميع أفراد الشات
        io.emit('new-message', {
            username: socket.username,
            text: data.text,
            file: data.file,
            fileType: data.fileType,
            fileName: data.fileName
        });

        // 2. إرسال الإيميل التلقائي عند كتابة نص
        if (data.text) {
            const mailOptions = {
                from: process.env.EMAIL_USER || 'your-email@gmail.com',
                to: 'gazeery@yahoo.com',
                subject: 'New Chat Notification',
                text: 'Message written on Letschat'
            };

            transporter.sendMail(mailOptions, (error) => {
                if (error) console.log('خطأ في إرسال الإيميل:', error);
            });
        }
    });

    // التنازل/الإشارة لمكالمة الصوت والفيديو (WebRTC Signaling)
    socket.on('call-user', (data) => {
        socket.broadcast.emit('incoming-call', data);
    });

    socket.on('answer-call', (data) => {
        socket.broadcast.emit('call-answered', data);
    });

    socket.on('ice-candidate', (candidate) => {
        socket.broadcast.emit('ice-candidate', candidate);
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            io.emit('system-message', `${socket.username} غادر الدردشة.`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));