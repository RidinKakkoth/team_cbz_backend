const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

expenseSchema.index({ event: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
