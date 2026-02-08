const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      unique: true
    },
    responsible: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Utilisateur',
      default: null
    },
    assignedFamilies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Famille'
      }
    ]
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

zoneSchema.index({ responsible: 1 });

module.exports = mongoose.model('Zone', zoneSchema);
