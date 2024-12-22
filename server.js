import { readFileSync, existsSync, renameSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Buffer } from 'buffer';

import express from 'express';
import { Server } from 'socket.io';
import multer from 'multer';
import md5 from 'md5';

import {
    getLogTagByConnection
} from './public/utils.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

const upload = multer({ dest: 'uploads/' });
const connections = {};
const uploadedFiles = {};

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Handle file upload
app.post('/upload', upload.array('files'), (req, res) => {
    req.files.map((file) => {
        const fileMd5 = md5(readFileSync(file.path));
        const fileDstPath = join(__dirname, 'uploads', fileMd5);
        if (!existsSync(fileDstPath)) {
            renameSync(file.path, fileDstPath);
        } else {
            unlinkSync(file.path);
        }
        uploadedFiles[fileMd5] = {
            md5: fileMd5,
            filename: Buffer.from(file.originalname, 'latin1').toString('utf-8'), // Note: https://github.com/expressjs/multer/issues/962
        };
    });
    io.emit('update-uploaded-files', Object.values(uploadedFiles));
    res.status(200);
});

// Handle file delete
app.delete('/delete/:md5', (req, res) => {
    const { md5 } = req.params;
    const filePath = join(__dirname, 'uploads', md5);
    try {
        unlinkSync(filePath);
        delete uploadedFiles[md5];
        io.emit('update-uploaded-files', Object.values(uploadedFiles));
        res.status(200);
    } catch (error) {
        console.error(`Error deleting file with MD5 ${md5}:`, error);
        res.status(500);
    }
});

io.on('connection', (socket) => {
    connections[socket.id] = {
        id: socket.id,
        username: 'Anonymous',
        status: 'PENDING',
        admin: false,
    };
    const consoleLog = (...args) => console.log(getLogTagByConnection(connections[socket.id]), ...args);
    consoleLog('Connection established');
    io.emit('update-connections', Object.values(connections));
    io.emit('update-uploaded-files', Object.values(uploadedFiles));

    socket.on('update-client-status', (data) => {
        consoleLog('Updating client status:', data);
        if (connections[socket.id]) {
            Object.assign(connections[socket.id], data)
            io.emit('update-connections', Object.values(connections));
        }
    });

    socket.on('preload', (clientToFileMap) => {
        consoleLog('Client-to-File map:', clientToFileMap);
        Object.entries(clientToFileMap).forEach(([id, md5]) => {
            if (connections[id] && uploadedFiles[md5]) {
                io.to(id).emit('preload', uploadedFiles[md5]);
            }
        });
    });

    socket.on('play', () => {
        consoleLog('Sending event: Play');
        io.emit('play', Date.now());
    });

    socket.on('pause', () => {
        consoleLog('Sending event: Pause');
        io.emit('pause');
    });

    socket.on('jump-to', (time) => {
        consoleLog(`Sending event: Jump to ${time}s`);
        io.emit('jump-to', time);
    });

    socket.on('disconnect', () => {
        consoleLog('Connection terminated');
        delete connections[socket.id];
        io.emit('update-connections', Object.values(connections));
    });
});

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});
