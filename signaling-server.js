// Import the WebSocket and WebSocketServer classes from the 'ws' module.
const { WebSocket, WebSocketServer } = require('ws');

// Create a new WebSocket server on port 8080.
// This is the port our server will listen on for new connections.
const wss = new WebSocketServer({ port: 8080 });

// Use a Map to store rooms. The key is the room ID (e.g., "Free-Bird-Lounge"),
// and the value is a Set of connected clients (WebSockets) in that room.
const rooms = new Map();

console.log('Signaling server is running on port 8080...');

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
```

### 2. How to Host It (The Deployment Process)

We'll use a service called **Fly.io**. It's perfect for this because it has a generous free tier that is more than enough for your chat app to run 24/7 at no cost.

**Step 1: Prepare Your Server Project**

1.  **Create a New Folder:** On your computer, create a new folder named `free-bird-server`.
2.  **Save the Code:** Inside this folder, save the server code above as `signaling-server.js`.
3.  **Initialize Node.js:** Open a terminal or command prompt, navigate into the `free-bird-server` folder, and run these two commands:
    ```bash
    npm init -y
    npm install ws
    ```
    This creates a `package.json` file and installs the necessary WebSocket library.

**Step 2: Deploy to Fly.io**

1.  **Install Flyctl:** Follow the instructions on the [Fly.io website](https://fly.io/docs/hands-on/install-flyctl/) to install their command-line tool (`flyctl`).
2.  **Sign Up & Log In:** Create a free account on Fly.io and log in via the command line by running `flyctl auth login`.
3.  **Launch the App:** In your terminal (still inside the `free-bird-server` folder), run:
    ```bash
    flyctl launch
    ```
    Fly.io will automatically detect it's a Node.js app, ask you to choose an app name (like `free-bird-signal`), and configure everything for you. When it asks "Do you want to deploy now?", say yes.
4.  **Get Your URL:** After deployment, Fly.io will give you a public URL, like `https://free-bird-signal.fly.dev`. This is the address of your very own signaling server!

### 3. Update Your Chat App

Now, you just need to tell your "Free Bird" chat app to use your new server instead of the public one.

1.  **Open `script.js`:** Open the `script.js` file from your `free-bird-chat` project.
2.  **Change the URL:** Find the `SIGNALING_SERVER_URL` constant and change its value to your new Fly.io URL. Remember to use `wss://` for the secure connection.
    ```javascript
    // Change this line in your script.js
    const SIGNALING_SERVER_URL = 'wss://free-bird-signal.fly.dev'; // Use your actual Fly.io URL
    
