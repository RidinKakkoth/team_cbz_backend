const express = require('express');
const Expense = require('../models/Expense');
const Event = require('../models/Event');
const { authRequired, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired);

// List expenses with optional filters: ?event=&paidBy=
router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.event) filter.event = req.query.event;
  if (req.query.paidBy) filter.paidBy = req.query.paidBy;
  const expenses = await Expense.find(filter)
    .populate('event', 'name monthlyAmount')
    .populate('paidBy', 'name phone')
    .sort({ date: -1, createdAt: -1 });
  res.json(expenses);
});

router.get('/:id', async (req, res) => {
  const expense = await Expense.findById(req.params.id)
    .populate('event', 'name monthlyAmount')
    .populate('paidBy', 'name phone');
  if (!expense) return res.status(404).json({ error: 'Not found' });
  res.json(expense);
});

router.post('/', adminOnly, async (req, res) => {
  const { event, name, amount, date, paidBy, notes } = req.body || {};
  if (!event || !name || amount == null) {
    return res.status(400).json({ error: 'event, name, amount required' });
  }
  const ev = await Event.findById(event);
  if (!ev) return res.status(404).json({ error: 'Event not found' });

  const expense = await Expense.create({
    event,
    name,
    amount,
    date: date || new Date(),
    paidBy: paidBy || null,
    notes: notes || '',
  });
  const populated = await expense.populate([
    { path: 'event', select: 'name monthlyAmount' },
    { path: 'paidBy', select: 'name phone' },
  ]);
  res.status(201).json(populated);
});

router.put('/:id', adminOnly, async (req, res) => {
  const { event, name, amount, date, paidBy, notes } = req.body || {};
  const update = {};
  if (event !== undefined) update.event = event;
  if (name !== undefined) update.name = name;
  if (amount !== undefined) update.amount = amount;
  if (date !== undefined) update.date = date;
  if (paidBy !== undefined) update.paidBy = paidBy || null;
  if (notes !== undefined) update.notes = notes;

  const expense = await Expense.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  })
    .populate('event', 'name monthlyAmount')
    .populate('paidBy', 'name phone');
  if (!expense) return res.status(404).json({ error: 'Not found' });
  res.json(expense);
});

router.delete('/:id', adminOnly, async (req, res) => {
  const expense = await Expense.findByIdAndDelete(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// Per-event expense summary: totals + breakdown by member
router.get('/summary/:eventId', async (req, res) => {
  const ev = await Event.findById(req.params.eventId);
  if (!ev) return res.status(404).json({ error: 'Event not found' });

  const expenses = await Expense.find({ event: ev._id })
    .populate('paidBy', 'name phone')
    .sort({ date: -1 });

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byMember = {};
  for (const e of expenses) {
    const key = e.paidBy ? e.paidBy._id.toString() : 'unknown';
    if (!byMember[key]) {
      byMember[key] = {
        member: e.paidBy
          ? { _id: e.paidBy._id, name: e.paidBy.name, phone: e.paidBy.phone }
          : null,
        total: 0,
        count: 0,
      };
    }
    byMember[key].total += e.amount;
    byMember[key].count += 1;
  }

  res.json({
    event: { _id: ev._id, name: ev.name },
    total,
    count: expenses.length,
    byMember: Object.values(byMember).sort((a, b) => b.total - a.total),
    expenses,
  });
});

module.exports = router;
