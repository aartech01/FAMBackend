// models/Relationship.js
import mongoose from "mongoose";

const relationshipSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  person1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  person2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  relationType: {
    type: String,
    enum: ["parent", "child", "spouse", "sibling", "friend", 
           "step-parent", "step-child", "step-sibling", 
           "grandparent", "grandchild", "cousin", "uncle", 
           "aunt", "nephew", "niece", "father-in-law", 
           "mother-in-law", "brother-in-law", "sister-in-law"],
    required: true,
  },
  familySide: {
    type: String,
    enum: ["groom", "bride", "common"],
    default: "common",
  },
  generationLevel: {
    type: Number,
    default: 0,
  },
  isValidated: {
    type: Boolean,
    default: false,
  },
  marriageDate: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
}, {
  timestamps: true,
});

// Compound index to prevent duplicates
relationshipSchema.index({ eventId: 1, person1: 1, person2: 1, relationType: 1 }, { unique: true });
relationshipSchema.index({ eventId: 1, familySide: 1 });

const Relationship = mongoose.model("Relationship", relationshipSchema);
export default Relationship;