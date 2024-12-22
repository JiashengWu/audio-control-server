import {
    getLogTagByConnection
} from './utils.js'

// HTML elements
const idElement = document.getElementById('id');
const usernameElement = document.getElementById('username');
const usernameInput = document.getElementById('username-input');
const updateButton = document.getElementById('update-btn');
const audioNameElement = document.getElementById('audio-name');
const clientAudio = document.getElementById('client-audio');
const readyButton = document.getElementById('ready-btn');

const socket = io();
const connection = {};
const consoleLog = (...args) => console.log(getLogTagByConnection(connection), ...args);

function updateUsername(username) {
    connection.username = username;
    usernameElement.textContent = username;
    usernameInput.value = username;
    localStorage.setItem('username', username);
    const data = { username: username };
    consoleLog('Updating username:', data);
    socket.emit('update-client-status', data);
}

socket.on('connect', () => {
    connection.id = socket.id;
    consoleLog('Connection established');
    idElement.textContent = connection.id;

    const storedUsername = localStorage.getItem('username');
    if (storedUsername === null) {
        consoleLog('Hello, new client');
    } else {
        consoleLog(`Welcome back, ${storedUsername}`);
        updateUsername(storedUsername);
    }
});

// Handle update button
updateButton.addEventListener('click', () => {
    const username = usernameInput.value || usernameInput.placeholder;
    updateUsername(username);
});

// Handle ready button
readyButton.addEventListener('click', () => {
    clientAudio.play();
    clientAudio.pause();
});

// FIXME: To bypass autoplay policy, here are many hacks.
// Handle preload event
socket.on('preload', file => {
    audioNameElement.textContent = '??';
    clientAudio.src = `/uploads/${file.md5}`;
    readyButton.disabled = false;
    const data = {
        status: 'PENDING',
        file: file.filename,
    };
    consoleLog('Updating file:', data);
    socket.emit('update-client-status', data);
    clientAudio.addEventListener('canplaythrough', () => {
        audioNameElement.textContent = file.md5;
        // audioNameElement.textContent = file.filename;
        socket.emit('update-client-status', { status: 'PAUSED' })
        readyButton.disabled = true;
    });
});

// Handle play event
socket.on('play', (timerStart) => {
    consoleLog('Received event: Play');
    try {
        clientAudio.play();
        const delay = Date.now() - timerStart;
        socket.emit('update-client-status', { status: `PLAYING (-${delay}ms)` })
    } catch (error) {
        console.error('Error playing audio:', error);
    }
});

// Handle pause event
socket.on('pause', () => {
    consoleLog('Received event: Pause');
    clientAudio.pause();
    socket.emit('update-client-status', { status: 'PAUSED' })
});

// Handle jump-to event
socket.on('jump-to', time => {
    consoleLog(`Received event: Jump to ${time}s`);
    clientAudio.currentTime = time;
});
