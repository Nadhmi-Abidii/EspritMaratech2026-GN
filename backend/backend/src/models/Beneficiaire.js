const mongoose = require('mongoose');

const beneficiaireSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    birthDate: {
      type: Date,
      required: true
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true
    },
    hasDisability: {
      type: Boolean,
      default: false
    },
    healthHistory: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: ''
    },
    famille: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Famille',
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

beneficiaireSchema.index({ lastName: 1 });

module.exports = mongoose.model('Beneficiaire', beneficiaireSchema);
