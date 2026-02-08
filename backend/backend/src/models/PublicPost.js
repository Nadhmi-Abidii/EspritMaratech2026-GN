const mongoose = require('mongoose');

const publicPostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000
    },
    donationGoal: {
      type: Number,
      required: true,
      min: 1
    },
    amountRaised: {
      type: Number,
      default: 0,
      min: 0
    },
    donationCount: {
      type: Number,
      default: 0,
      min: 0
    },
    associationType: {
      type: String,
      enum: ['none', 'family', 'beneficiary'],
      default: 'none'
    },
    family: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Famille',
      default: null
    },
    beneficiary: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Beneficiaire',
      default: null
    },
    processedDonationSessions: {
      type: [String],
      default: [],
      select: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Utilisateur',
      required: true
    }
  },
  {
    timestamps: true
  }
);

publicPostSchema.index({ family: 1, createdAt: -1 });
publicPostSchema.index({ associationType: 1, family: 1 });

module.exports = mongoose.model('PublicPost', publicPostSchema);
