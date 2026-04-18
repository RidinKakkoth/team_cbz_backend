const express = require('express');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Event = require('../models/Event');
const Member = require('../models/Member');
const { authRequired, adminOnly } = require('../middleware/auth');
const { listPeriods } = require('../utils/periods');

const router = express.Router();

router.use(authRequired);

// List payments with optional filters: ?event=&member=&period=
router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.event) filter.event = req.query.event;
  if (req.query.member) filter.member = req.query.member;
  if (req.query.period) filter.period = req.query.period;
  const payments = await Payment.find(filter)
    .populate('member', 'name phone')
    .populate('event', 'name monthlyAmount')
    .sort({ period: -1, createdAt: -1 });
  res.json(payments);
});

// Mark a payment as paid (idempotent).
router.post('/', adminOnly, async (req, res) => {
  const { event, member, period, amount, note } = req.body || {};
  if (!event || !member || !period) {
    return res.status(400).json({ error: 'event, member, period required' });
  }
  const ev = await Event.findById(event);
  if (!ev) return res.status(404).json({ error: 'Event not found' });

  const payment = await Payment.findOneAndUpdate(
    { event, member, period },
    {
      $set: {
        amount: amount != null ? amount : ev.monthlyAmount,
        note: note || '',
        paidAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.status(201).json(payment);
});

// Unmark (delete) a payment
router.delete('/', adminOnly, async (req, res) => {
  const { event, member, period } = req.body || {};
  if (!event || !member || !period) {
    return res.status(400).json({ error: 'event, member, period required' });
  }
  await Payment.deleteOne({ event, member, period });
  res.json({ ok: true });
});

// Per-event matrix: members x periods with paid/unpaid status.
router.get('/matrix/:eventId', async (req, res) => {
  const event = await Event.findById(req.params.eventId).populate('members');
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const periods = listPeriods(event.startDate);
  const payments = await Payment.find({ event: event._id });
  const paidMap = new Map(
    payments.map((p) => [`${p.member.toString()}::${p.period}`, p.paidAt])
  );

  const rows = event.members.map((m) => {
    const cells = periods.map((p) => {
      const key = `${m._id.toString()}::${p}`;
      const paidAt = paidMap.get(key);
      return {
        period: p,
        paid: !!paidAt,
        paidAt: paidAt || null,
      };
    });
    const paidCount = cells.filter((c) => c.paid).length;
    const pendingCount = cells.length - paidCount;
    return {
      member: { _id: m._id, name: m.name, phone: m.phone },
      cells,
      paidCount,
      pendingCount,
      paidAmount: paidCount * event.monthlyAmount,
      pendingAmount: pendingCount * event.monthlyAmount,
    };
  });

  res.json({
    event: {
      _id: event._id,
      name: event.name,
      monthlyAmount: event.monthlyAmount,
      startDate: event.startDate,
    },
    periods,
    rows,
  });
});

// Payment history for a single member across all events
router.get('/member/:memberId', async (req, res) => {
  const member = await Member.findById(req.params.memberId);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const events = await Event.find({ members: member._id });
  const payments = await Payment.find({ member: member._id });
  const paidMap = new Map(
    payments.map((p) => [`${p.event.toString()}::${p.period}`, p.paidAt])
  );

  const result = events.map((ev) => {
    const periods = listPeriods(ev.startDate);
    const cells = periods.map((p) => {
      const key = `${ev._id.toString()}::${p}`;
      const paidAt = paidMap.get(key);
      return {
        period: p,
        paid: !!paidAt,
        paidAt: paidAt || null,
      };
    });
    const paidCount = cells.filter((c) => c.paid).length;
    return {
      event: { _id: ev._id, name: ev.name, monthlyAmount: ev.monthlyAmount },
      cells,
      paidCount,
      pendingCount: cells.length - paidCount,
      paidAmount: paidCount * ev.monthlyAmount,
      pendingAmount: (cells.length - paidCount) * ev.monthlyAmount,
    };
  });

  res.json({ member, events: result });
});

module.exports = router;
