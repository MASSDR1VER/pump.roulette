#!/usr/bin/env node

/**
 * Send authenticated message to pump.fun chat
 * Usage: node send_pump_message_auth.js <token> <message> <auth_token>
 */

const WebSocket = require('ws');

const token = process.argv[2];
const message = process.argv[3];
const authToken = process.argv[4];

if (!token || !message || !authToken) {
    console.error('Usage: node send_pump_message_auth.js <token> <message> <auth_token>');
    process.exit(1);
}

console.log(`Connecting to pump.fun chat for token: ${token}`);

const ws = new WebSocket('wss://livechat.pump.fun/socket.io/?EIO=4&transport=websocket', {
    headers: {
        'Cookie': `auth_token=${authToken}`,
        'Origin': 'https://pump.fun',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
});

let ackCounter = 420;
let isConnected = false;

ws.on('open', function open() {
    console.log('WebSocket Client Connected');
});

ws.on('message', function message(data) {
    const dataStr = data.toString();
    console.log('Received:', dataStr);

    if (dataStr.startsWith('0')) {
        // Socket.io handshake response
        console.log('Connected to socket.io server');
        isConnected = true;

        // Send join room after handshake
        setTimeout(() => {
            const joinRoomMessage = `40/pump.fun,42["joinRoom",{"roomId":"${token}"}]`;
            ws.send(joinRoomMessage);
            console.log(`Sent joinRoom for ${token}`);
        }, 1000);

    } else if (dataStr.startsWith('40')) {
        console.log('Namespace connected');
    } else if (dataStr.includes('joined')) {
        console.log('Room joined successfully');

        if (!message.sent) {
            // Send message after room join
            setTimeout(() => {
                const sendMessageData = `42/pump.fun,43["sendMessage",{"message":"${message}","roomId":"${token}"}]`;
                ws.send(sendMessageData);
                console.log(`Sending message: ${message}`);
                message.sent = true;

                // Close connection after sending
                setTimeout(() => {
                    ws.close();
                    console.log('Message sent, disconnected');
                    process.exit(0);
                }, 2000);
            }, 1000);
        }
    } else if (dataStr === '2') {
        // Ping - respond with pong
        ws.send('3');
    }
});

ws.on('error', function error(err) {
    console.error('WebSocket error:', err);
    process.exit(1);
});

ws.on('close', function close() {
    console.log('Disconnected');
});

// Timeout after 10 seconds
setTimeout(() => {
    console.error('Timeout: Could not send message');
    ws.close();
    process.exit(1);
}, 10000);