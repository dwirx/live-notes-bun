const notesFile = Bun.file("./notes.txt");

// Read notes from the file, or start with an empty string if it doesn't exist.
let currentNotes = await notesFile.exists() ? await notesFile.text() : "";

// A set to keep track of all connected WebSocket clients
const clients = new Set();

const server = Bun.serve({
  port: 3000,
  
  // This function handles incoming HTTP requests
  async fetch(req, server) {
    const url = new URL(req.url);

    // Check if the client is requesting to upgrade to a WebSocket connection
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 500 });
      }
      // The 'upgrade' function handles the response, so we don't return anything here
      return;
    }

    // For any other request, serve the main HTML file
    if (url.pathname === "/") {
      return new Response(Bun.file("./index.html"));
    }
    
    // Handle cases where the file is not found
    return new Response("Not Found", { status: 404 });
  },

  // This object handles WebSocket events
  websocket: {
    // This function is called when a new WebSocket connection is opened
    open(ws) {
      console.log("Client connected");
      clients.add(ws);
      // Send the current notes content to the newly connected client
      ws.send(currentNotes);
    },

    // This function is called when a message is received from a client
    async message(ws, message) {
      // Handle the clear message
      if (message === 'clear') {
        currentNotes = "";
        // Broadcast the empty notes to all clients
        for (const client of clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(currentNotes);
          }
        }
      } else {
        // The message is the updated notes content.
        currentNotes = message.toString();
        
        // Broadcast the updated notes to all other connected clients
        for (const client of clients) {
          // Check if the client is not the one who sent the message and is ready
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(currentNotes);
          }
        }
      }
      
      // Persist the changes to the file
      await Bun.write(notesFile, currentNotes);
    },

    // This function is called when a WebSocket connection is closed
    close(ws) {
      console.log("Client disconnected");
      clients.delete(ws);
    },
  },
});

console.log(`Listening on http://localhost:${server.port}`);
