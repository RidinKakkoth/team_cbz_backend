const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    monthlyAmount: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', eventSchema);
