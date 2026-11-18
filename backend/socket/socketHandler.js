const { Server } = require('socket.io');

let io;

const init = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join general updates
    socket.join('all_reports');

    // Join location updates & register user room
    socket.on('join_location', (data) => {
      // Data: { lat, lng, userId }
      if (data && data.userId) {
        socket.join(`user_${data.userId}`);
        console.log(`Socket ${socket.id} joined user_${data.userId}`);
      }
    });

    // Explicit user room join
    socket.on('join_user', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`Socket ${socket.id} explicitly joined user_${userId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
};

const emitEvent = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

const emitToUser = (userId, event, data) => {
  if (io && userId) {
    io.to(`user_${userId}`).emit(event, data);
  }
};

module.exports = { init, emitEvent, emitToUser };
