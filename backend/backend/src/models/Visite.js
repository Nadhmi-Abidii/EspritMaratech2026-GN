const mongoose = require('mongoose');

const geolocationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180
    }
  },
  { _id: false }
);

const visiteSchema = new mongoose.Schema(
  {
    visitDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ''
    },
    aides: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Aide'
      }
    ],
    famille: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Famille',
      required: true,
      index: true
    },
    geolocation: {
      type: geolocationSchema,
      default: null
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

visiteSchema.index({ visitDate: -1 });

module.exports = mongoose.model('Visite', visiteSchema);
