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

const housingSituationEnum = ['proprietaire', 'locataire', 'heberge', 'sans_logement', 'autre'];

const familleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20
    },
    zone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true
    },
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Zone',
      default: null,
      index: true
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 120
    },
    numberOfPeople: {
      type: Number,
      required: true,
      min: 1
    },
    date_de_naissance: {
      type: Date,
      validate: {
        validator: (value) => !value || value <= new Date(),
        message: 'date_de_naissance must be in the past'
      }
    },
    nombre_enfants: {
      type: Number,
      min: 0
    },
    occupation: {
      type: String,
      trim: true,
      maxlength: 120
    },
    revenu_mensuel: {
      type: Number,
      min: 0
    },
    situation_logement: {
      type: String,
      enum: housingSituationEnum
    },
    aidTypes: [
      {
        type: String,
        enum: ['alimentaire', 'medicaments', 'aide_specifique']
      }
    ],
    observations: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ''
    },
    donationGoal: {
      type: Number,
      min: 0,
      default: 0
    },
    totalRaised: {
      type: Number,
      min: 0,
      default: 0
    },
    goalReached: {
      type: Boolean,
      default: false
    },
    visited: {
      type: Boolean,
      default: false
    },
    lastVisitedAt: {
      type: Date,
      default: null
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

familleSchema.pre('validate', function syncDonationFlags(next) {
  const donationGoal = Number(this.donationGoal || 0);
  const totalRaised = Number(this.totalRaised || 0);
  this.goalReached = donationGoal > 0 && totalRaised >= donationGoal;
  return next();
});

familleSchema.index({ name: 1 });
familleSchema.index({ postalCode: 1 });
familleSchema.index({ aidTypes: 1 });
familleSchema.index({ zoneId: 1, visited: 1, goalReached: 1 });
familleSchema.index({ name: 'text', address: 'text' });

module.exports = mongoose.model('Famille', familleSchema);
