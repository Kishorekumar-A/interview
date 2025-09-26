const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage as fallback
const memoryStorage = {
  users: [],
  rooms: [],
  currentUserId: 1,
  currentRoomId: 1
};

// Mock models for fallback
class MemoryUser {
  constructor(data) {
    this._id = memoryStorage.currentUserId++;
    this.email = data.email;
    this.password = data.password;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.googleId = data.googleId;
    this.isGoogleAuth = data.isGoogleAuth || false;
    this.createdAt = new Date();
  }

  static findOne(query) {
    return memoryStorage.users.find(user => {
      if (query.email) return user.email === query.email;
      if (query._id) return user._id == query._id;
      return false;
    });
  }

  static findById(id) {
    return memoryStorage.users.find(user => user._id == id);
  }

  save() {
    const existingIndex = memoryStorage.users.findIndex(u => u._id === this._id);
    if (existingIndex >= 0) {
      memoryStorage.users[existingIndex] = this;
    } else {
      memoryStorage.users.push(this);
    }
    return Promise.resolve(this);
  }
}

class MemoryRoom {
  constructor(data) {
    this._id = memoryStorage.currentRoomId++;
    this.roomId = data.roomId;
    this.password = data.password;
    this.createdBy = data.createdBy;
    this.createdAt = new Date();
    this.participants = data.participants || [];
    this.interviewer = data.interviewer;
    this.isActive = true;
  }

  static findOne(query) {
    return memoryStorage.rooms.find(room => {
      if (query.roomId) return room.roomId === query.roomId;
      return false;
    });
  }

  static find(query) {
    return memoryStorage.rooms.filter(room => {
      if (query.isActive !== undefined) return room.isActive === query.isActive;
      return true;
    });
  }

  save() {
    const existingIndex = memoryStorage.rooms.findIndex(r => r._id === this._id);
    if (existingIndex >= 0) {
      memoryStorage.rooms[existingIndex] = this;
    } else {
      memoryStorage.rooms.push(this);
    }
    return Promise.resolve(this);
  }
}

// MongoDB Connection with fallback
let User, Room;
let dbConnected = false;

const connectDB = async () => {
  try {
    // Try different connection strings
    const connectionStrings = [
      'mongodb://127.0.0.1:27017/truehire',
      'mongodb://localhost:27017/truehire',
      'mongodb://0.0.0.0:27017/truehire'
    ];

    for (const uri of connectionStrings) {
      try {
        console.log(`Trying to connect to: ${uri}`);
        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 3000,
          socketTimeoutMS: 20000,
        });
        
        // If connection successful, define Mongoose models
        const UserSchema = new mongoose.Schema({
          email: { type: String, required: true, unique: true },
          password: { type: String },
          firstName: { type: String, required: true },
          lastName: { type: String, required: true },
          googleId: { type: String },
          isGoogleAuth: { type: Boolean, default: false },
          createdAt: { type: Date, default: Date.now }
        });

        const RoomSchema = new mongoose.Schema({
          roomId: { type: String, required: true, unique: true },
          password: { type: String, required: true },
          createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
          createdAt: { type: Date, default: Date.now },
          participants: [{
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            joinedAt: { type: Date, default: Date.now },
            isActive: { type: Boolean, default: true },
            socketId: { type: String }
          }],
          interviewer: {
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            joinedAt: { type: Date, default: Date.now },
            isActive: { type: Boolean, default: true },
            socketId: { type: String }
          },
          isActive: { type: Boolean, default: true }
        });

        User = mongoose.model('User', UserSchema);
        Room = mongoose.model('Room', RoomSchema);
        
        dbConnected = true;
        console.log('✅ MongoDB connected successfully!');
        return;
      } catch (err) {
        console.log(`❌ Connection failed: ${uri}`);
      }
    }

    // If all connections fail, use in-memory storage
    console.log('⚠️ MongoDB not available. Using in-memory storage (data will reset on server restart)');
    User = MemoryUser;
    Room = MemoryRoom;
    dbConnected = false;
    
  } catch (error) {
    console.log('⚠️ MongoDB not available. Using in-memory storage');
    User = MemoryUser;
    Room = MemoryRoom;
    dbConnected = false;
  }
};

// Initialize database connection
connectDB();

const JWT_SECRET = 'your-secret-key-change-in-production';

// Auth Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Helper function to populate user data
const populateUserData = async (user) => {
  if (dbConnected) {
    return {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isGoogleAuth: user.isGoogleAuth
    };
  } else {
    return {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isGoogleAuth: user.isGoogleAuth || false
    };
  }
};

// Routes

// User Registration
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });
    const userData = await populateUserData(user);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: userData
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// User Login
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });
    const userData = await populateUserData(user);

    res.json({
      message: 'Login successful',
      token,
      user: userData
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Google Auth
app.post('/api/auth/google', async (req, res) => {
  try {
    const { email, firstName, lastName, googleId } = req.body;

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        email,
        firstName,
        lastName,
        googleId,
        isGoogleAuth: true
      });
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });
    const userData = await populateUserData(user);

    res.json({
      message: 'Google authentication successful',
      token,
      user: userData
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create Interview Room
app.post('/api/rooms/create', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;

    // Generate unique room ID
    const generateRoomId = () => {
      const min = 100000;
      const max = 999999;
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    let roomId;
    let roomExists = true;

    // Ensure room ID is unique
    while (roomExists) {
      roomId = generateRoomId().toString();
      const existingRoom = await Room.findOne({ roomId });
      roomExists = !!existingRoom;
    }

    // Create room
    const room = new Room({
      roomId,
      password,
      createdBy: req.user._id,
      interviewer: {
        user: req.user._id,
        isActive: true
      }
    });

    await room.save();

    res.status(201).json({
      message: 'Room created successfully',
      room: {
        id: room.roomId,
        password: room.password,
        createdAt: room.createdAt,
        isJoining: false,
        participants: room.participants || [],
        interviewer: room.interviewer,
        createdBy: await populateUserData(req.user)
      }
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Join Interview Room
app.post('/api/rooms/join', authenticateToken, async (req, res) => {
  try {
    const { roomId, password } = req.body;

    // Find room
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check password
    if (room.password !== password) {
      return res.status(401).json({ message: 'Invalid room password' });
    }

    // Add participant
    room.participants.push({
      user: req.user._id,
      isActive: true
    });

    await room.save();

    res.json({
      message: 'Joined room successfully',
      room: {
        id: room.roomId,
        password: room.password,
        createdAt: room.createdAt,
        isJoining: true,
        participants: room.participants || [],
        interviewer: room.interviewer,
        createdBy: await populateUserData(req.user)
      }
    });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's rooms
app.get('/api/rooms/my-rooms', authenticateToken, async (req, res) => {
  try {
    const rooms = await Room.find({ isActive: true });
    res.json({ rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    database: dbConnected ? 'MongoDB' : 'In-Memory',
    timestamp: new Date().toISOString()
  });
});

// Socket.io setup (same as before)
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', async (data) => {
    const { roomId, userId } = data;
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', { userId, socketId: socket.id });
  });

  socket.on('offer', (data) => {
    socket.to(data.target).emit('offer', data);
  });

  socket.on('answer', (data) => {
    socket.to(data.target).emit('answer', data);
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
  console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
  console.log(`💾 Database: ${dbConnected ? 'MongoDB' : 'In-Memory (Fallback)'}`);
});