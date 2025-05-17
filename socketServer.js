const socketIO = require('socket.io');

function setupSocketServer(server) {
  const io = socketIO(server);
  
  // Store active call rooms
  const callRooms = {};
  
  io.on('connection', (socket) => {
    console.log('New socket connection:', socket.id);
    
    // Join a video call room
    socket.on('join-call', (data) => {
      const { appointmentId, userId, userName, userRole } = data;
      const roomId = `call-${appointmentId}`;
      
      console.log(`User ${userName} (${userRole}) joining room ${roomId}`);
      
      // Join the socket room
      socket.join(roomId);
      
      // Store user info
      socket.userId = userId;
      socket.userName = userName;
      socket.userRole = userRole;
      socket.roomId = roomId;
      
      // Initialize room if doesn't exist
      if (!callRooms[roomId]) {
        callRooms[roomId] = { users: {} };
      }
      
      // Add user to room
      callRooms[roomId].users[userId] = {
        socketId: socket.id,
        userName,
        userRole
      };
      
      // Check if this is the first user (initiator) or second user
      const userCount = Object.keys(callRooms[roomId].users).length;
      const isInitiator = userCount === 1;
      
      // If second user joining, notify both users
      if (userCount === 2) {
        // Get the other user in the room
        const otherUserId = Object.keys(callRooms[roomId].users).find(id => id !== userId);
        const otherUser = callRooms[roomId].users[otherUserId];
        
        // Tell the new user about the existing user
        socket.emit('user-connected', {
          userId: otherUserId,
          userName: otherUser.userName,
          userRole: otherUser.userRole,
          isInitiator: false
        });
        
        // Tell the existing user about the new user
        io.to(otherUser.socketId).emit('user-connected', {
          userId,
          userName,
          userRole,
          isInitiator: true
        });
      }
    });
    
    // Handle WebRTC signaling
    socket.on('signal', (data) => {
      const { appointmentId, signal } = data;
      const roomId = `call-${appointmentId}`;
      
      // If room exists
      if (callRooms[roomId]) {
        const userId = socket.userId;
        
        // Find the other user in the room
        const otherUserId = Object.keys(callRooms[roomId].users).find(id => id !== userId);
        
        if (otherUserId) {
          const otherUser = callRooms[roomId].users[otherUserId];
          // Send signal to the other user
          io.to(otherUser.socketId).emit('signal', {
            userId,
            signal
          });
        }
      }
    });
    
    // Handle user leaving
    socket.on('leave-call', (data) => {
      handleDisconnect(socket);
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      handleDisconnect(socket);
    });
    
    // Function to handle user disconnection
    function handleDisconnect(socket) {
      const roomId = socket.roomId;
      const userId = socket.userId;
      
      if (roomId && callRooms[roomId] && callRooms[roomId].users[userId]) {
        // Remove the user from the room
        delete callRooms[roomId].users[userId];
        
        // If room is now empty, remove it
        if (Object.keys(callRooms[roomId].users).length === 0) {
          delete callRooms[roomId];
        } else {
          // Otherwise notify remaining users
          Object.values(callRooms[roomId].users).forEach(user => {
            io.to(user.socketId).emit('user-disconnected', { userId });
          });
        }
      }
      
      console.log(`Socket ${socket.id} disconnected`);
    }
  });
  
  return io;
}

module.exports = setupSocketServer;
