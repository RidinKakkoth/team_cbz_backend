const express = require('express');
const Member = require('../models/Member');
const Event = require('../models/Event');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const { authRequired } = require('../middleware/auth');
const { listPeriods } = require('../utils/periods');

const router = express.Router();

router.use(authRequired);

router.get('/summary', async (req, res) => {
  const [events, memberCount] = await Promise.all([
    Event.find().populate('members', '_id'),
    Member.countDocuments(),
  ]);

  let totalCollected = 0;
  let totalPending = 0;
  let totalSpent = 0;
  const defaulterIds = new Set();
  const perEvent = [];

  for (const ev of events) {
    const periods = listPeriods(ev.startDate);
    const expected = ev.members.length * periods.length * ev.monthlyAmount;
    const [payments, expenses] = await Promise.all([
      Payment.find({ event: ev._id }),
      Expense.find({ event: ev._id }),
    ]);
    const collected = payments.reduce((s, p) => s + p.amount, 0);
    const pending = Math.max(expected - collected, 0);
    const spent = expenses.reduce((s, e) => s + e.amount, 0);

    totalCollected += collected;
    totalPending += pending;
    totalSpent += spent;

    const paidSet = new Set(payments.map((p) => `${p.member.toString()}::${p.period}`));
    const defaultersThisEvent = [];
    for (const m of ev.members) {
      const hasPending = periods.some((p) => !paidSet.has(`${m._id.toString()}::${p}`));
      if (hasPending) {
        defaulterIds.add(m._id.toString());
        defaultersThisEvent.push(m._id);
      }
    }

    perEvent.push({
      _id: ev._id,
      name: ev.name,
      monthlyAmount: ev.monthlyAmount,
      memberCount: ev.members.length,
      periodCount: periods.length,
      collected,
      pending,
      spent,
      balance: collected - spent,
      expenseCount: expenses.length,
      defaulterCount: defaultersThisEvent.length,
    });
  }

  res.json({
    totals: {
      collected: totalCollected,
      pending: totalPending,
      spent: totalSpent,
      balance: totalCollected - totalSpent,
      members: memberCount,
      events: events.length,
      defaulters: defaulterIds.size,
    },
    events: perEvent,
  });
});

router.get('/pending', async (req, res) => {
  const events = await Event.find().populate('members', 'name phone');
  const out = [];
  for (const ev of events) {
    const periods = listPeriods(ev.startDate);
    const payments = await Payment.find({ event: ev._id });
    const paidSet = new Set(payments.map((p) => `${p.member.toString()}::${p.period}`));
    for (const m of ev.members) {
      const pendingPeriods = periods.filter((p) => !paidSet.has(`${m._id.toString()}::${p}`));
      if (pendingPeriods.length > 0) {
        out.push({
          event: { _id: ev._id, name: ev.name, monthlyAmount: ev.monthlyAmount },
          member: { _id: m._id, name: m.name, phone: m.phone },
          pendingPeriods,
          pendingAmount: pendingPeriods.length * ev.monthlyAmount,
        });
      }
    }
  }
  out.sort((a, b) => b.pendingAmount - a.pendingAmount);
  res.json(out);
});

module.exports = router;
