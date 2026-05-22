// import nodemailer from "nodemailer";

// const transporter = nodemailer.createTransport({
//   service: "gmail",

//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// const sendOTP = async (email, otp) => {
//   await transporter.sendMail({
//     from: process.env.EMAIL_USER,
//     to: email,
//     subject: "Your Login OTP",
//     html: `
//       <h2>OTP Verification</h2>
//       <p>Your OTP is:</p>
//       <h1>${otp}</h1>
//       <p>This OTP expires in 5 minutes.</p>
//     `,
//   });
// };

// export default sendOTP;





// utils/sendEmail.js (update this if you want to keep using it)
// import { sendOTPEmail } from "../services/emailService.js";

// const sendOTP = async (email, otp) => {
//   return await sendOTPEmail(email, otp);
// };

// export default sendOTP;







import { sendOTPEmail } from "../services/emailService.js";

const sendOTP = async (email, otp) => {
  return await sendOTPEmail(email, otp);
};

export default sendOTP;