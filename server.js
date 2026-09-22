const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

const activeUsers = new Map(); // قائمة تخزين المستخدمين النشطين

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    
    socket.on('join', ({ username, date }) => {
        if (date !== '13.01.2007') {
            socket.emit('access-denied', 'التاريخ غير صحيح! لا يمكن الدخول.');
            return;
        }
        
        socket.username = username;
        activeUsers.set(socket.id, username);

        socket.emit('access-granted');
        io.emit('system-message', `${username} انضم إلى الدردشة.`);
        
        // إرسال القائمة المحدثة للأعضاء النشطين للجميع
        io.emit('update-user-list', Array.from(activeUsers.values()));
    });

    socket.on('chat-message', (data) => {
        io.emit('new-message', {
            username: socket.username,
            text: data.text,
            file: data.file,
            fileType: data.fileType,
            fileName: data.fileName
        });

        if (data.text) {
            const mailOptions = {
                from: process.env.EMAIL_USER || 'your-email@gmail.com',
                to: 'gazeery@yahoo.com',
                subject: 'New Chat Notification',
                text: 'Message written on Letschat'
            };

            transporter.sendMail(mailOptions, (error) => {
                if (error) console.log('خطأ في إرسال الإيميل:', error.message);
            });
        }
    });

    // مكالمات الفيديو
    socket.on('call-user', (data) => socket.broadcast.emit('incoming-call', data));
    socket.on('answer-call', (data) => socket.broadcast.emit('call-answered', data));
    socket.on('ice-candidate', (candidate) => socket.broadcast.emit('ice-candidate', candidate));

    socket.on('disconnect', () => {
        if (socket.username) {
            activeUsers.delete(socket.id);
            io.emit('system-message', `${socket.username} غادر الدردشة.`);
            io.emit('update-user-list', Array.from(activeUsers.values())); // تحديث القائمة عند الخروج
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
