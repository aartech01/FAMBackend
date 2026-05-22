// services/qrService.js
import QRCode from "qrcode";
import cloudinary from "../config/cloudinary.js";

export const uploadQRToCloudinary = async (qrDataURL, eventId) => {
  const result = await cloudinary.uploader.upload(qrDataURL, {
    folder: "events/qr",
    public_id: `event_qr_${eventId}`,
    overwrite: true,
  });
  return result.secure_url;
};

// Generate QR Code for event join form
export const generateEventQRCode = async (eventId, eventCode, eventName) => {
  try {
    // Create URL that opens the join form
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const formUrl = `${frontendUrl}/join/${eventId}?code=${encodeURIComponent(eventCode)}&name=${encodeURIComponent(eventName)}`;
    
    const qrOptions = {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.92,
      margin: 2,
      width: parseInt(process.env.QR_CODE_SIZE) || 300,
      color: {
        dark: '#1F4E3D',  // fam-forest
        light: '#F5F0E8'  // fam-cream
      }
    };
    
    // Generate QR code with the form URL
    const qrCodeDataURL = await QRCode.toDataURL(formUrl, qrOptions);
    
    return qrCodeDataURL;
  } catch (error) {
    console.error("QR Code generation error:", error);
    throw new Error("Failed to generate QR code");
  }
};

// Generate QR Code with embedded data (for offline use)
export const generateEmbeddedEventQRCode = async (eventId, eventCode, eventName) => {
  try {
    const qrData = {
      eventId: eventId.toString(),
      eventCode: eventCode,
      eventName: eventName,
      type: "event_join",
      apiUrl: `${process.env.API_URL || process.env.FRONTEND_URL?.replace(':3000', ':8000') || "http://localhost:8000"}/api/qr/join-from-qr`,
      formFields: {
        required: ["name", "email", "dob"],
        optional: ["bloodGroup", "profession", "location", "gender", "phone", "socialMediaLink"]
      }
    };
    
    const qrOptions = {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 2,
      width: 300,
    };
    
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), qrOptions);
    return qrCodeDataURL;
  } catch (error) {
    console.error("QR Code generation error:", error);
    throw new Error("Failed to generate QR code");
  }
};

export const generateQRCode = async (data) => {
  try {
    const qrOptions = {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.92,
      margin: 2,
      width: parseInt(process.env.QR_CODE_SIZE) || 300,
    };
    
    const qrData = typeof data === 'object' ? JSON.stringify(data) : data;
    const qrCodeDataURL = await QRCode.toDataURL(qrData, qrOptions);
    return qrCodeDataURL;
  } catch (error) {
    console.error("QR Code generation error:", error);
    throw new Error("Failed to generate QR code");
  }
};