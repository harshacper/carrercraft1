const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');

const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
};

const getCleanIp = (req) => {
  let ip = req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '127.0.0.1';
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
  }
  return ip.slice(0, 45);
};

// Admin Login
router.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Hardcoded fallback override
    if (username === 'harsha8453' && password === '845352') {
      return res.json({ token: generateToken('harsha-admin-override'), username });
    }

    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !admin) {
      return res.status(401).json({ message: 'Invalid Admin Credentials' });
    }

    // Since we seeded the admin with plain text password in the SQL script, 
    // we should check both hashed and plain text for compatibility.
    const isMatch = (password === admin.password) || (await bcrypt.compare(password, admin.password));

    if (isMatch) {
      res.json({ token: generateToken(admin.id), username: admin.username });
    } else {
      res.status(401).json({ message: 'Invalid Admin Credentials' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const { fullName, email, phoneNumber, password, gender, qualification, experience } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const cleanIp = getCleanIp(req);
    
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in Supabase
    const { data: user, error } = await supabase
      .from('users')
      .insert([
        { 
          full_name: fullName, 
          email: normalizedEmail, 
          phone_number: phoneNumber, 
          password: hashedPassword, 
          gender, 
          qualification, 
          experience,
          last_ip: cleanIp
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ 
      _id: user.id, 
      fullName: user.full_name, 
      email: user.email, 
      role: user.experience || 'Aspiring Professional',
      token: generateToken(user.id) 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const cleanIp = getCleanIp(req);
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    const isMatch = user && (await bcrypt.compare(password, user.password));

    // Log the login attempt
    await supabase
      .from('login_details')
      .insert([
        {
          email: normalizedEmail,
          ip_address: cleanIp,
          status: isMatch ? 'Success' : 'Failed',
          user_agent: req.headers['user-agent']
        }
      ]);

    if (isMatch) {
      // Update last IP
      await supabase
        .from('users')
        .update({ last_ip: cleanIp })
        .eq('id', user.id);

      res.json({ 
        _id: user.id, 
        fullName: user.full_name, 
        email: user.email, 
        role: user.experience || 'Aspiring Professional',
        token: generateToken(user.id) 
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/google-login', async (req, res) => {
  try {
    const { email, fullName } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const cleanIp = getCleanIp(req);
    
    // Check if user exists
    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!user) {
      // Create a new user with dummy hashed password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('google-auth-mock-bypass-' + Math.random(), salt);
      
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          { 
            full_name: fullName, 
            email: normalizedEmail, 
            phone_number: 'N/A', 
            password: hashedPassword, 
            gender: 'other', 
            qualification: 'N/A', 
            experience: 'Google Authorized User',
            last_ip: cleanIp
          }
        ])
        .select()
        .single();

      if (insertError) throw insertError;
      user = newUser;
    } else {
      // Update last IP
      await supabase
        .from('users')
        .update({ last_ip: cleanIp })
        .eq('id', user.id);
    }

    // Log the login attempt
    await supabase
      .from('login_details')
      .insert([
        {
          email: normalizedEmail,
          ip_address: cleanIp,
          status: 'Success',
          user_agent: req.headers['user-agent']
        }
      ]);

    res.json({ 
      _id: user.id, 
      fullName: user.full_name, 
      email: user.email, 
      role: user.experience || 'Google Authorized User',
      token: generateToken(user.id) 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
