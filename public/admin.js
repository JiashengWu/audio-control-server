import {
    getLogTagByConnection
} from './utils.js';

// HTML elements
const idElement = document.getElementById('id');
const fileInput = document.getElementById('file-input');
const uploadButton = document.getElementById('upload-btn');
const audioTable = document.getElementById('audio-table').querySelector('tbody');
const clientTable = document.getElementById('client-table').querySelector('tbody');
const preloadButton = document.getElementById('preload-btn');
const playButton = document.getElementById('play-btn');
const pauseButton = document.getElementById('pause-btn');
const jumpInput = document.getElementById('jump-input');
const jumpButton = document.getElementById('jump-btn');

const socket = io();
const connection = {};
const consoleLog = (...args) => console.log(getLogTagByConnection(connection), ...args);
let uploadedFiles = {};

socket.on('connect', () => {
    connection.id = socket.id;
    consoleLog('Connection established');
    idElement.textContent = connection.id;

    socket.emit('update-client-status', { admin: true })
});

// Update all dropdown
function updateAllAudioDropdown(chosenMd5 = null, choose = true) {
    document.querySelectorAll('.audio-dropdown').forEach(dropdown => {
        if (!chosenMd5) {
            // Create dropdown
            const previousValue = dropdown.value || '';
            dropdown.innerHTML = '';
            Object.values(uploadedFiles).forEach(file => {
                const option = document.createElement('option');
                option.value = file.md5;
                option.textContent = file.filename;
                dropdown.appendChild(option);
            });
            dropdown.value = previousValue;
        } else {
            // Select the chosen md5
            if (choose) {
                dropdown.value = chosenMd5;
            } else {
                if (dropdown.value == chosenMd5) {
                    dropdown.value = '';
                }
            }
        }
    });
}

// Handle file upload
uploadButton.addEventListener('click', async () => {
    const files = fileInput.files;
    if (files.length === 0) {
        alert('Please select at least one audio file.');
        return;
    }
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('files', file));
    try {
        await fetch('/upload', { method: 'POST', body: formData });
    } catch (error) {
        console.error('Error uploading files:', error);
    }
});

// Handle preload button
preloadButton.addEventListener('click', () => {
    const clientToFileMap = {};
    const rows = clientTable.querySelectorAll('tr');
    rows.forEach(row => {
        const id = row.querySelector('td:first-child').textContent;
        const md5 = row.querySelector('select').value;
        if (id && md5) {
            clientToFileMap[id] = md5;
        }
    });
    socket.emit('preload', clientToFileMap);
});

// Update audio list
socket.on('update-uploaded-files', data => {
    uploadedFiles = data;
    consoleLog('Received audio list:', uploadedFiles);
    audioTable.innerHTML = '';
    Object.values(uploadedFiles).forEach(audio => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${audio.md5}</td>
            <td>${audio.filename || ''}</td>
            <td>
                <button class="choose-file-btn">Choose</button>
            </td>
            <td>
                <button class="delete-file-btn">Delete</button>
            </td>
        `;
        audioTable.appendChild(row);
        row.querySelector('.choose-file-btn').addEventListener('click', () => {
            updateAllAudioDropdown(audio.md5);
        });
        row.querySelector('.delete-file-btn').addEventListener('click', async () => {
            try {
                await fetch(`/delete/${audio.md5}`, { method: 'DELETE' });
            } catch (error) {
                console.error('Error deleting files:', error);
            }
            updateAllAudioDropdown(audio.md5, false);
        });
    });
    updateAllAudioDropdown();
});

// Update client list
socket.on('update-connections', connections => {
    clientTable.innerHTML = '';
    Object.values(connections).filter(connection => !connection.admin).forEach(connection => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${connection.id}</td>
            <td>${connection.username || ''}</td>
            <td>${connection.status || ''}</td>
            <td>${connection.file || ''}</td>
            <td>
                <select class="audio-dropdown">
                </select>
            </td>
        `;
        clientTable.appendChild(row);
    });
    updateAllAudioDropdown();
});

// Handle play button
playButton.addEventListener('click', () => {
    const rows = clientTable.querySelectorAll('tr');
    const allClientsPaused = Object.values(rows).every(row => {
        return row.querySelector('td:nth-child(3)').textContent === "PAUSED";
    });
    if (!allClientsPaused) {
        const userConfirmed = confirm('Not all clients are in PAUSED status. Are you sure you want to play?');
        if (!userConfirmed) {
            return;
        }
    }
    consoleLog('Sending event: Play');
    socket.emit('play');
});

// Handle pause button
pauseButton.addEventListener('click', () => {
    consoleLog('Sending event: Pause');
    socket.emit('pause');
});

// Handle jump button
jumpButton.addEventListener('click', () => {
    const time = parseInt(jumpInput.value || jumpInput.placeholder, 10);
    if (!isNaN(time) && time >= 0) {
        consoleLog(`Sending event: Jump to ${time}s`);
        socket.emit('jump-to', time);
    } else {
        alert('Please enter a valid number of seconds.');
    }
});
