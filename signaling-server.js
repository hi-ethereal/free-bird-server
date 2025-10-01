// Import the WebSocket and WebSocketServer classes from the 'ws' module.
const { WebSocket, WebSocketServer } = require('ws');

// Get the port from the environment variable provided by Render,
// or default to 8080 for local testing.
const PORT = process.env.PORT || 8080;

// Create a new WebSocket server using the correct port.
const wss = new WebSocketServer({ port: PORT });

// Use a Map to store rooms. The key is the room ID (e.g., "Free-Bird-Lounge"),
// and the value is a Set of connected clients (WebSockets) in that room.
const rooms = new Map();

console.log(`Signaling server is running on port ${PORT}...`);

// This function runs every time a new client connects to our server.
wss.on('connection', (ws) => {
    console.log('Client connected');

    // This function runs when the server receives a message from a client.
    ws.on('message', (message) => {
        let data;
        try {
            // We expect messages to be in JSON format.
            data = JSON.parse(message);
        } catch (e) {
            console.error('Invalid JSON received:', message);
            return;
        }

        const { type, room } = data;

        // Handle different message types from the client.
        switch (type) {
            case 'join':
                // When a client wants to join a room...
                console.log(`Client wants to join room: ${room}`);

                // If the room doesn't exist yet, create it.
                if (!rooms.has(room)) {
                    rooms.set(room, new Set());
                }

                const roomClients = rooms.get(room);
                // Add the new client to the room.
                roomClients.add(ws);
                // Store the room ID on the WebSocket object for later reference.
                ws.roomId = room;

                // If this client is the first one in the room, tell them they've 'joined'.
                if (roomClients.size === 1) {
                    ws.send(JSON.stringify({ type: 'joined' }));
                }
                // If there are two clients, it's time for them to connect.
                else if (roomClients.size === 2) {
                    // Tell all clients in the room that it's 'ready' for the WebRTC handshake.
                    broadcast(room, { type: 'ready' }, ws);
                }
                // If a third client tries to join, we could handle that here (e.g., reject them).
                break;

            // These cases just forward the WebRTC handshake messages to the other client in the room.
            case 'offer':
            case 'answer':
            case 'candidate':
                // The `broadcast` function sends the message to everyone in the room *except* the sender.
                broadcast(room, data, ws);
                break;
        }
    });

    // This function runs when a client disconnects.
    ws.on('close', () => {
        console.log('Client disconnected');
        const { roomId } = ws;
        if (roomId && rooms.has(roomId)) {
            const roomClients = rooms.get(roomId);
            // Remove the client from the room.
            roomClients.delete(ws);
            // Tell the remaining client that the other has left.
            broadcast(roomId, { type: 'leave' }, ws);
        }
    });
});

/**
 * Helper function to send a message to all clients in a room except the sender.
 * @param {string} room - The ID of the room.
 * @param {object} message - The message object to send.
 * @param {WebSocket} sender - The client who sent the original message.
 */
function broadcast(room, message, sender) {
    if (rooms.has(room)) {
        rooms.get(room).forEach((client) => {
            // Only send if the client is not the sender and is ready to receive messages.
            if (client !== sender && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
}