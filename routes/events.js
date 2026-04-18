const express = require('express');
const Event = require('../models/Event');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const { authRequired, adminOnly } = require('../middleware/auth');
const { listPeriods } = require('../utils/periods');

const router = express.Router();

router.use(authRequired);

router.get('/', async (req, res) => {
  const events = await Event.find().sort({ createdAt: -1 });
  res.json(events);
});

router.get('/:id', async (req, res) => {
  const event = await Event.findById(req.params.id).populate('members');
  if (!event) return res.status(404).json({ error: 'Not found' });
  res.json(event);
});

router.post('/', adminOnly, async (req, res) => {
  const { name, description, monthlyAmount, startDate, members = [], active = true } = req.body || {};
  if (!name || monthlyAmount == null || !startDate) {
    return res.status(400).json({ error: 'name, monthlyAmount, startDate required' });
  }
  const event = await Event.create({ name, description, monthlyAmount, startDate, members, active });
  res.status(201).json(event);
});

router.put('/:id', adminOnly, async (req, res) => {
  const { name, description, monthlyAmount, startDate, members, active } = req.body || {};
  const update = {};
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (monthlyAmount !== undefined) update.monthlyAmount = monthlyAmount;
  if (startDate !== undefined) update.startDate = startDate;
  if (members !== undefined) update.members = members;
  if (active !== undefined) update.active = active;

  const event = await Event.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });
  if (!event) return res.status(404).json({ error: 'Not found' });
  res.json(event);
});

router.delete('/:id', adminOnly, async (req, res) => {
  const event = await Event.findByIdAndDelete(req.params.id);
  if (!event) return res.status(404).json({ error: 'Not found' });
  await Payment.deleteMany({ event: event._id });
  await Expense.deleteMany({ event: event._id });
  res.json({ ok: true });
});

// Add / remove members on an event
router.post('/:id/members', adminOnly, async (req, res) => {
  const { memberIds = [] } = req.body || {};
  const event = await Event.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { members: { $each: memberIds } } },
    { new: true }
  ).populate('members');
  if (!event) return res.status(404).json({ error: 'Not found' });
  res.json(event);
});

router.delete('/:id/members/:memberId', adminOnly, async (req, res) => {
  const event = await Event.findByIdAndUpdate(
    req.params.id,
    { $pull: { members: req.params.memberId } },
    { new: true }
  ).populate('members');
  if (!event) return res.status(404).json({ error: 'Not found' });
  res.json(event);
});

// Period list from event start -> now
router.get('/:id/periods', async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ error: 'Not found' });
  res.json(listPeriods(event.startDate));
});

module.exports = router;
