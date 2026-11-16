import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
    },
    topic: {
      type: String,
    },
    description: {
      type: String,
    },
    type: {
      type: String,
      enum: ['pptx', 'docx', 'txt'],
      required: [true, 'Document type is required'],
    },
    content: {
      type: mongoose.Schema.Types.Mixed, // generated structured content as JSON
    },
    settings: {
      language: String,
      tone: String,
      audience: String,
      contentLength: String,
      slideCount: Number,
      theme: String,
    },
    fileName: {
      type: String,
    },
    fileSize: {
      type: Number,
    },
    status: {
      type: String,
      enum: ['pending', 'generating', 'completed', 'failed'],
      default: 'pending',
    },
    errorMessage: {
      type: String,
    },
  },
  { timestamps: true }
);

// Compound index for efficient user document listing (newest first)
documentSchema.index({ userId: 1, createdAt: -1 });

const Document = mongoose.model('Document', documentSchema);

export default Document;
