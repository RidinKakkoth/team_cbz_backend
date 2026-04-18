const express = require('express');
const Member = require('../models/Member');
const Event = require('../models/Event');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const { authRequired, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired);

router.get('/', async (req, res) => {
  const { q } = req.query;
  const filter = q
    ? { $or: [{ name: new RegExp(q, 'i') }, { phone: new RegExp(q, 'i') }] }
    : {};
  const members = await Member.find(filter).sort({ name: 1 });
  res.json(members);
});

router.get('/:id', async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) return res.status(404).json({ error: 'Not found' });
  res.json(member);
});

router.post('/', adminOnly, async (req, res) => {
  const { name, phone, notes } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });
  const member = await Member.create({ name, phone, notes });
  res.status(201).json(member);
});

router.put('/:id', adminOnly, async (req, res) => {
  const { name, phone, notes } = req.body || {};
  const member = await Member.findByIdAndUpdate(
    req.params.id,
    { name, phone, notes },
    { new: true, runValidators: true }
  );
  if (!member) return res.status(404).json({ error: 'Not found' });
  res.json(member);
});

router.delete('/:id', adminOnly, async (req, res) => {
  const member = await Member.findByIdAndDelete(req.params.id);
  if (!member) return res.status(404).json({ error: 'Not found' });
  await Event.updateMany({ members: member._id }, { $pull: { members: member._id } });
  await Payment.deleteMany({ member: member._id });
  await Expense.updateMany({ paidBy: member._id }, { $set: { paidBy: null } });
  res.json({ ok: true });
});

module.exports = router;
