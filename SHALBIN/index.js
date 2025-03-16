// import express from 'express';
// import mongoose from 'mongoose';
// import cors from 'cors';
// import dotenv from 'dotenv';
// import jwt from 'jsonwebtoken';
// import bcrypt from 'bcryptjs';

// dotenv.config();

// const app = express();
// app.use(cors());
// app.use(express.json());

// // MongoDB connection
// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart-locks");
//     console.log('✅ MongoDB Connected Successfully');
//   } catch (err) {
//     console.error('❌ MongoDB Connection Error:', err.message);
//     process.exit(1);
//   }
// };
// connectDB();

// // User Schema
// const userSchema = new mongoose.Schema({
//   email: { type: String, required: true, unique: true },
//   password: { type: String, required: true },
//   whatsappNumber: { type: String },
//   createdAt: { type: Date, default: Date.now }
// });

// // Lock Schema with enhanced security features
// const lockSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, required: true },
//   name: { type: String, required: true },
//   status: { type: String, default: 'locked' },
//   pins: {
//     pin1: String,
//     pin2: String,
//     pin3: String,
//     pin4: String
//   },
//   otp: String,
//   otpExpiresAt: Date,
//   failedAttempts: { type: Number, default: 0 },
//   lastFailedAttempt: Date,
//   cooldownUntil: Date,
//   permanentlyLocked: { type: Boolean, default: false },
//   lastUnauthorizedAttempt: Date,
//   lastUpdated: { type: Date, default: Date.now },
//   createdAt: { type: Date, default: Date.now }
// });

// const User = mongoose.model('User', userSchema);
// const Lock = mongoose.model('Lock', lockSchema);

// // Authentication middleware
// const auth = async (req, res, next) => {
//   try {
//     const token = req.header('Authorization')?.replace('Bearer ', '');
//     if (!token) throw new Error();

//     const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
//     const user = await User.findById(decoded.id);
//     if (!user) throw new Error();

//     req.user = user;
//     next();
//   } catch (error) {
//     res.status(401).json({ error: 'Please authenticate' });
//   }
// };

// // Auth routes
// app.post('/api/auth/signup', async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     const hashedPassword = await bcrypt.hash(password, 10);
//     const user = new User({ email, password: hashedPassword });
//     await user.save();

//     const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'your-secret-key');
//     res.status(201).json({ user: { id: user._id, email }, token });
//   } catch (error) {
//     res.status(400).json({ error: 'Email already exists' });
//   }
// });

// app.post('/api/auth/login', async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     const user = await User.findOne({ email });
//     if (!user || !(await bcrypt.compare(password, user.password))) {
//       throw new Error();
//     }

//     const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'your-secret-key');
//     res.json({ user: { id: user._id, email }, token });
//   } catch (error) {
//     res.status(401).json({ error: 'Invalid credentials' });
//   }
// });

// // Update WhatsApp number
// app.put('/api/user/whatsapp', auth, async (req, res) => {
//   try {
//     const { whatsappNumber } = req.body;
//     const user = await User.findById(req.user._id);
//     if (!user) throw new Error('User not found');
    
//     user.whatsappNumber = whatsappNumber;
//     await user.save();
//     res.json({ whatsappNumber });
//   } catch (error) {
//     res.status(400).json({ error: 'Failed to update WhatsApp number' });
//   }
// });

// // Lock routes
// app.get('/api/locks', auth, async (req, res) => {
//   try {
//     const locks = await Lock.find({ userId: req.user._id });
//     res.json(locks);
//   } catch (error) {
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// app.post('/api/locks', auth, async (req, res) => {
//   try {
//     const lock = new Lock({
//       userId: req.user._id,
//       name: req.body.name,
//       status: 'locked',
//       failedAttempts: 0,
//       permanentlyLocked: false,
//       pins: {
//         pin1: null,
//         pin2: null,
//         pin3: null,
//         pin4: null
//       }
//     });
//     await lock.save();
//     res.status(201).json(lock);
//   } catch (error) {
//     res.status(400).json({ error: 'Invalid lock data' });
//   }
// });

// // Update PIN
// app.put('/api/locks/:id/pins', auth, async (req, res) => {
//   try {
//     const { pinNumber, pin } = req.body;
    
//     // Validate PIN format
//     if (!/^\d{6}$/.test(pin)) {
//       return res.status(400).json({ error: 'PIN must be exactly 6 digits' });
//     }

//     // Find the lock and verify ownership
//     const lock = await Lock.findOne({ _id: req.params.id, userId: req.user._id });
//     if (!lock) {
//       return res.status(404).json({ error: 'Lock not found' });
//     }

//     // Hash and save the PIN
//     const hashedPin = await bcrypt.hash(pin, 10);
//     lock.pins[`pin${pinNumber}`] = hashedPin;
//     lock.lastUpdated = new Date();
//     await lock.save();

//     res.json({ success: true });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to update PIN' });
//   }
// });

// // Generate OTP
// app.post('/api/locks/:id/otp', auth, async (req, res) => {
//   try {
//     const lock = await Lock.findOne({ _id: req.params.id, userId: req.user._id });
//     if (!lock) {
//       return res.status(404).json({ error: 'Lock not found' });
//     }

//     if (lock.permanentlyLocked) {
//       return res.status(403).json({ error: 'Lock is permanently locked' });
//     }

//     const user = await User.findById(req.user._id);
//     const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit number
//     const otpExpiresAt = new Date(Date.now() + 300000); // 5 minutes

//     lock.otp = otp;
//     lock.otpExpiresAt = otpExpiresAt;
//     lock.lastUpdated = new Date();
//     await lock.save();

//     res.json({ 
//       otp, 
//       otpExpiresAt,
//       whatsappMessage: `Your OTP for ${lock.name} is: ${otp}. This code will expire in 5 minutes.`,
//       userWhatsapp: user.whatsappNumber 
//     });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to generate OTP' });
//   }
// });

// // Handle unauthorized attempts
// app.post('/api/locks/:id/notify', auth, async (req, res) => {
//   try {
//     const lock = await Lock.findOne({ _id: req.params.id, userId: req.user._id });
//     if (!lock) throw new Error('Lock not found');

//     const { event } = req.body;
//     if (event === 'unauthorized_attempt') {
//       lock.lastUnauthorizedAttempt = new Date();
//       await lock.save();
//     }

//     res.json({ success: true });
//   } catch (error) {
//     res.status(404).json({ error: 'Lock not found' });
//   }
// });

// // Permanent lock control
// app.post('/api/locks/:id/permanent-lock', auth, async (req, res) => {
//   try {
//     const lock = await Lock.findOne({ _id: req.params.id, userId: req.user._id });
//     if (!lock) throw new Error('Lock not found');

//     lock.permanentlyLocked = true;
//     lock.lastUpdated = new Date();
//     await lock.save();

//     res.json({ success: true });
//   } catch (error) {
//     res.status(404).json({ error: 'Lock not found' });
//   }
// });

// app.post('/api/locks/:id/permanent-unlock', auth, async (req, res) => {
//   try {
//     const lock = await Lock.findOne({ _id: req.params.id, userId: req.user._id });
//     if (!lock) throw new Error('Lock not found');

//     lock.permanentlyLocked = false;
//     lock.failedAttempts = 0;
//     lock.cooldownUntil = null;
//     lock.lastUpdated = new Date();
//     await lock.save();

//     res.json({ success: true });
//   } catch (error) {
//     res.status(404).json({ error: 'Lock not found' });
//   }
// });

// // ESP8266 endpoint for code verification
// app.post('/api/verify-otp', async (req, res) => {
//   try {
//     const { lockId, code } = req.body;
//     const lock = await Lock.findById(lockId);
//     if (!lock) {
//       return res.status(404).json({ error: 'Lock not found' });
//     }

//     // Check permanent lock
//     if (lock.permanentlyLocked) {
//       return res.status(403).json({ error: 'Lock is permanently locked' });
//     }

//     // Check cooldown period
//     if (lock.cooldownUntil && new Date() < lock.cooldownUntil) {
//       return res.status(429).json({ 
//         error: 'Too many attempts',
//         cooldownRemaining: Math.ceil((lock.cooldownUntil.getTime() - Date.now()) / 1000)
//       });
//     }

//     let isValid = false;

//     // Check OTP
//     if (lock.otp === code && lock.otpExpiresAt && new Date() <= lock.otpExpiresAt) {
//       isValid = true;
//       lock.otp = null;
//       lock.otpExpiresAt = null;
//     }

//     // Check permanent PINs
//     if (!isValid) {
//       for (let i = 1; i <= 4; i++) {
//         const hashedPin = lock.pins[`pin${i}`];
//         if (hashedPin && await bcrypt.compare(code, hashedPin)) {
//           isValid = true;
//           break;
//         }
//       }
//     }

//     if (!isValid) {
//       // Handle failed attempt
//       lock.failedAttempts += 1;
//       lock.lastFailedAttempt = new Date();

//       // Check if we need to start cooldown
//       if (lock.failedAttempts >= 3) {
//         if (lock.failedAttempts >= 6) {
//           // Permanent lock after 6 failed attempts
//           lock.permanentlyLocked = true;
//         } else {
//           // Set 1-minute cooldown
//           lock.cooldownUntil = new Date(Date.now() + 60000);
//         }
//       }

//       await lock.save();
//       return res.status(401).json({ 
//         error: 'Invalid code',
//         attempts: lock.failedAttempts,
//         cooldownUntil: lock.cooldownUntil
//       });
//     }

//     // Reset attempts on successful verification
//     lock.failedAttempts = 0;
//     lock.cooldownUntil = null;
//     lock.status = 'unlocked';
//     lock.lastUpdated = new Date();
//     await lock.save();

//     // Auto-lock after 5 seconds
//     setTimeout(async () => {
//       try {
//         lock.status = 'locked';
//         lock.lastUpdated = new Date();
//         await lock.save();
//       } catch (error) {
//         console.error('Error re-locking:', error);
//       }
//     }, 5000);

//     res.json({ success: true });
//   } catch (error) {
//     console.error('Error verifying code:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`✨ Server running on port ${PORT}`));
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart-locks");
    console.log('✅ MongoDB Connected Successfully');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};
connectDB();

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  whatsappNumber: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Lock Schema with enhanced security features
const lockSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  status: { type: String, default: 'locked' },
  pins: {
    pin1: String,
    pin2: String,
    pin3: String,
    pin4: String
  },
  otp: String,
  otpExpiresAt: Date,
  failedAttempts: { type: Number, default: 0 },
  lastFailedAttempt: Date,
  cooldownUntil: Date,
  permanentlyLocked: { type: Boolean, default: false },
  lastUnauthorizedAttempt: Date,
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Lock = mongoose.model('Lock', lockSchema);

// Authentication middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error();

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.id);
    if (!user) throw new Error();

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

// Auth routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'your-secret-key');
    res.status(201).json({ user: { id: user._id, email }, token });
  } catch (error) {
    res.status(400).json({ error: 'Email already exists' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error();
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'your-secret-key');
    res.json({ user: { id: user._id, email }, token });
  } catch (error) {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Update WhatsApp number
app.put('/api/user/whatsapp', auth, async (req, res) => {
  try {
    const { whatsappNumber } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) throw new Error('User not found');
    
    user.whatsappNumber = whatsappNumber;
    await user.save();
    res.json({ whatsappNumber });
  } catch (error) {
    res.status(400).json({ error: 'Failed to update WhatsApp number' });
  }
});

// Lock routes
app.get('/api/locks', auth, async (req, res) => {
  try {
    const locks = await Lock.find({ userId: req.user._id });
    res.json(locks);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single lock status - New endpoint for ESP8266
app.get('/api/locks/:id', async (req, res) => {
  try {
    const lock = await Lock.findById(req.params.id);
    if (!lock) {
      return res.status(404).json({ error: 'Lock not found' });
    }
    res.json({
      id: lock._id,
      name: lock.name,
      status: lock.status,
      permanentlyLocked: lock.permanentlyLocked,
      failedAttempts: lock.failedAttempts
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/locks', auth, async (req, res) => {
  try {
    const lock = new Lock({
      userId: req.user._id,
      name: req.body.name,
      status: 'locked',
      failedAttempts: 0,
      permanentlyLocked: false,
      pins: {
        pin1: null,
        pin2: null,
        pin3: null,
        pin4: null
      }
    });
    await lock.save();
    res.status(201).json(lock);
  } catch (error) {
    res.status(400).json({ error: 'Invalid lock data' });
  }
});

// Update PIN
app.put('/api/locks/:id/pins', auth, async (req, res) => {
  try {
    const { pinNumber, pin } = req.body;
    
    // Validate PIN format
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 6 digits' });
    }

    // Find the lock and verify ownership
    const lock = await Lock.findOne({ _id: req.params.id, userId: req.user._id });
    if (!lock) {
      return res.status(404).json({ error: 'Lock not found' });
    }

    // Hash and save the PIN
    const hashedPin = await bcrypt.hash(pin, 10);
    lock.pins[`pin${pinNumber}`] = hashedPin;
    lock.lastUpdated = new Date();
    await lock.save();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update PIN' });
  }
});

// Generate OTP
app.post('/api/locks/:id/otp', auth, async (req, res) => {
  try {
    const lock = await Lock.findOne({ _id: req.params.id, userId: req.user._id });
    if (!lock) {
      return res.status(404).json({ error: 'Lock not found' });
    }

    if (lock.permanentlyLocked) {
      return res.status(403).json({ error: 'Lock is permanently locked' });
    }

    const user = await User.findById(req.user._id);
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit number
    const otpExpiresAt = new Date(Date.now() + 300000); // 5 minutes

    lock.otp = otp;
    lock.otpExpiresAt = otpExpiresAt;
    lock.lastUpdated = new Date();
    await lock.save();

    res.json({ 
      otp, 
      otpExpiresAt,
      whatsappMessage: `Your OTP for ${lock.name} is: ${otp}. This code will expire in 5 minutes.`,
      userWhatsapp: user.whatsappNumber 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate OTP' });
  }
});

// Handle unauthorized attempts
app.post('/api/locks/:id/notify', auth, async (req, res) => {
  try {
    const lock = await Lock.findOne({ _id: req.params.id, userId: req.user._id });
    if (!lock) throw new Error('Lock not found');

    const { event } = req.body;
    if (event === 'unauthorized_attempt') {
      lock.lastUnauthorizedAttempt = new Date();
      await lock.save();
    }

    res.json({ success: true });
  } catch (error) {
    res.status(404).json({ error: 'Lock not found' });
  }
});

// Permanent lock control
app.post('/api/locks/:id/permanent-lock', async (req, res) => {
  try {
    const lock = await Lock.findById(req.params.id);
    if (!lock) {
      return res.status(404).json({ error: 'Lock not found' });
    }

    lock.permanentlyLocked = true;
    lock.lastUpdated = new Date();
    await lock.save();

    res.json({ success: true });
  } catch (error) {
    res.status(404).json({ error: 'Lock not found' });
  }
});

app.post('/api/locks/:id/permanent-unlock', auth, async (req, res) => {
  try {
    const lock = await Lock.findOne({ _id: req.params.id, userId: req.user._id });
    if (!lock) throw new Error('Lock not found');

    lock.permanentlyLocked = false;
    lock.failedAttempts = 0;
    lock.cooldownUntil = null;
    lock.lastUpdated = new Date();
    await lock.save();

    res.json({ success: true });
  } catch (error) {
    res.status(404).json({ error: 'Lock not found' });
  }
});

// ESP8266 endpoint for code verification
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { lockId, code } = req.body;
    const lock = await Lock.findById(lockId);
    if (!lock) {
      return res.status(404).json({ error: 'Lock not found' });
    }

    // Check permanent lock
    if (lock.permanentlyLocked) {
      return res.status(403).json({ error: 'Lock is permanently locked' });
    }

    // Check cooldown period
    if (lock.cooldownUntil && new Date() < lock.cooldownUntil) {
      return res.status(429).json({ 
        error: 'Too many attempts',
        cooldownRemaining: Math.ceil((lock.cooldownUntil.getTime() - Date.now()) / 1000)
      });
    }

    let isValid = false;

    // Check OTP
    if (lock.otp === code && lock.otpExpiresAt && new Date() <= lock.otpExpiresAt) {
      isValid = true;
      lock.otp = null;
      lock.otpExpiresAt = null;
    }

    // Check permanent PINs
    if (!isValid) {
      for (let i = 1; i <= 4; i++) {
        const hashedPin = lock.pins[`pin${i}`];
        if (hashedPin && await bcrypt.compare(code, hashedPin)) {
          isValid = true;
          break;
        }
      }
    }

    if (!isValid) {
      // Handle failed attempt
      lock.failedAttempts += 1;
      lock.lastFailedAttempt = new Date();

      // Check if we need to start cooldown
      if (lock.failedAttempts >= 3) {
        if (lock.failedAttempts >= 6) {
          // Permanent lock after 6 failed attempts
          lock.permanentlyLocked = true;
        } else {
          // Set 1-minute cooldown
          lock.cooldownUntil = new Date(Date.now() + 60000);
        }
      }

      await lock.save();
      return res.status(401).json({ 
        error: 'Invalid code',
        attempts: lock.failedAttempts,
        cooldownUntil: lock.cooldownUntil,
        permanentlyLocked: lock.permanentlyLocked
      });
    }

    // Reset attempts on successful verification
    lock.failedAttempts = 0;
    lock.cooldownUntil = null;
    lock.status = 'unlocked';
    lock.lastUpdated = new Date();
    await lock.save();

    // Auto-lock after 5 seconds
    setTimeout(async () => {
      try {
        lock.status = 'locked';
        lock.lastUpdated = new Date();
        await lock.save();
      } catch (error) {
        console.error('Error re-locking:', error);
      }
    }, 5000);

    res.json({ success: true });
  } catch (error) {
    console.error('Error verifying code:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✨ Server running on port ${PORT}`));