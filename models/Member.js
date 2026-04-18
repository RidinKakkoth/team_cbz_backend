const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

memberSchema.index({ name: 'text', phone: 'text' });

module.exports = mongoose.model('Member', memberSchema);
