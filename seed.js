require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Member = require('./models/Member');
const Event = require('./models/Event');
const Payment = require('./models/Payment');
const Expense = require('./models/Expense');
const { listPeriods } = require('./utils/periods');

async function run() {
  await connectDB();

  console.log('Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Member.deleteMany({}),
    Event.deleteMany({}),
    Payment.deleteMany({}),
    Expense.deleteMany({}),
  ]);

  const adminUsername = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const guestUsername = (process.env.GUEST_USERNAME || 'guest').toLowerCase();
  const guestPassword = process.env.GUEST_PASSWORD || 'guest123';

  console.log('Creating users...');
  await User.create([
    { username: adminUsername, passwordHash: await User.hashPassword(adminPassword), role: 'admin' },
    { username: guestUsername, passwordHash: await User.hashPassword(guestPassword), role: 'guest' },
  ]);

  console.log('Creating members...');
  const memberSeed = [
    { name: 'Arun Kumar', phone: '9876500001', notes: 'Founder' },
    { name: 'Bala Subramanian', phone: '9876500002', notes: '' },
    { name: 'Chandru R', phone: '9876500003', notes: '' },
    { name: 'Dinesh M', phone: '9876500004', notes: 'Treasurer' },
    { name: 'Elango S', phone: '9876500005', notes: '' },
    { name: 'Ganesh V', phone: '9876500006', notes: '' },
    { name: 'Hari Prasad', phone: '9876500007', notes: '' },
    { name: 'Imran Khan', phone: '9876500008', notes: '' },
    { name: 'Jeeva K', phone: '9876500009', notes: '' },
    { name: 'Karthik N', phone: '9876500010', notes: '' },
    { name: 'Lokesh P', phone: '9876500011', notes: '' },
    { name: 'Manoj R', phone: '9876500012', notes: '' },
  ];
  const members = await Member.insertMany(memberSeed);

  console.log('Creating events...');
  const now = new Date();
  const aprilEventStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 4, 1)); // May last year
  const festivalStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)); // Jan this year

  const events = await Event.create([
    {
      name: 'Fireworks April ' + (now.getUTCFullYear() + (now.getUTCMonth() >= 3 ? 1 : 0)),
      description: 'Annual fireworks celebration — monthly collection.',
      monthlyAmount: 500,
      startDate: aprilEventStart,
      members: members.map((m) => m._id),
    },
    {
      name: 'Festival Fund ' + now.getUTCFullYear(),
      description: 'Pooja and festival-day expenses.',
      monthlyAmount: 200,
      startDate: festivalStart,
      members: members.slice(0, 8).map((m) => m._id),
    },
  ]);

  console.log('Creating payment history...');
  const payments = [];
  for (const ev of events) {
    const periods = listPeriods(ev.startDate);
    for (let i = 0; i < ev.members.length; i++) {
      const memberId = ev.members[i];
      // Seed: ~80% of past periods paid, random skips = defaulters
      for (let j = 0; j < periods.length; j++) {
        // never mark current month as paid for member index 0 & 1 so we have visible pending
        const skip = (i < 2 && j === periods.length - 1) || Math.random() < 0.2;
        if (!skip) {
          payments.push({
            event: ev._id,
            member: memberId,
            period: periods[j],
            amount: ev.monthlyAmount,
            paidAt: new Date(),
          });
        }
      }
    }
  }
  await Payment.insertMany(payments, { ordered: false }).catch(() => {});

  console.log('Creating sample expenses...');
  const expenseSamples = [
    { name: 'Fireworks — crackers bulk order', amount: 12000 },
    { name: 'Sound system rental', amount: 3500 },
    { name: 'Light decorations', amount: 2200 },
    { name: 'Tea & snacks', amount: 850 },
    { name: 'Banner printing', amount: 600 },
    { name: 'Pooja items', amount: 450 },
    { name: 'Flowers', amount: 300 },
    { name: 'Sweets distribution', amount: 1800 },
  ];
  const expenses = [];
  for (const ev of events) {
    const sampleCount = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < sampleCount; i++) {
      const s = expenseSamples[Math.floor(Math.random() * expenseSamples.length)];
      const who = members[Math.floor(Math.random() * members.length)];
      const daysAgo = Math.floor(Math.random() * 60);
      expenses.push({
        event: ev._id,
        name: s.name,
        amount: s.amount,
        paidBy: who._id,
        date: new Date(Date.now() - daysAgo * 86400000),
        notes: '',
      });
    }
  }
  await Expense.insertMany(expenses);

  console.log('Seed complete.');
  console.log(`  Admin login: ${adminUsername} / ${adminPassword}`);
  console.log(`  Guest login: ${guestUsername} / ${guestPassword}`);
  console.log(`  Members: ${members.length}`);
  console.log(`  Events:  ${events.length}`);
  console.log(`  Payments:${payments.length}`);
  console.log(`  Expenses:${expenses.length}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
