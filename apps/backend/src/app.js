const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const childrenRoutes = require('./routes/children');
const packagesRoutes = require('./routes/packages');
const visitsRoutes = require('./routes/visits');
const settingsRoutes = require('./routes/settings');
const blogRoutes = require('./routes/blog');
const uploadRoutes = require('./routes/upload');
const menuRoutes = require('./routes/menu');
const scheduleRoutes = require('./routes/schedule');
const closedDaysRoutes = require('./routes/closedDays');
const reservationsRoutes = require('./routes/reservations');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Jelovnik, raspored i obavestenja se menjaju iz admina i moraju odmah da se
// vide u aplikaciji. Express podrazumevano salje ETag, pa klijent (iOS ume da
// kesira odgovor bez Cache-Control zaglavlja) moze da posluzi stari podatak.
// Zato se odgovori API-ja izricito ne kesiraju.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/children', childrenRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/visits', visitsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/closed-days', closedDaysRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use((req, res) => {
  res.status(404).json({ message: 'Ruta nije pronadjena.' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Greska na serveru.' });
});

module.exports = app;
