const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const utilisateurSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 120
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: ''
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },
    role: {
      type: String,
      enum: ['admin', 'volunteer', 'coordinator', 'responsible'],
      default: 'volunteer'
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    assignedZones: [
      {
        type: String,
        trim: true,
        maxlength: 80
      }
    ],
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
        delete ret.password;
        delete ret.__v;
        return ret;
      }
    }
  }
);

utilisateurSchema.index({ role: 1, assignedZones: 1 });

utilisateurSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

utilisateurSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Utilisateur', utilisateurSchema);
