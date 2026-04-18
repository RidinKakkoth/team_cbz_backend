const mongoose = require('mongoose');

// One row per (event, member, YYYY-MM). Presence of the doc = paid.
const paymentSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    period: { type: String, required: true }, // "YYYY-MM"
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

paymentSchema.index({ event: 1, member: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('Payment', paymentSchema);
