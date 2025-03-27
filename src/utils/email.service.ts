import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GOOGLE_GMAIL,
    pass: process.env.GOOGLE_APP_PASSWORD,
  },
});

const sendEmail = async (to: string, subject: string, message: string) => {
  const mailOptions = {
    from: process.env.GOOGLE_GMAIL,
    to,
    subject,
    html: message,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}: ${subject}`);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

export const sendOtpEmail = async (email: string, subject: string, message: string) => {
  const mailOptions = {
    from: process.env.GOOGLE_GMAIL,
    to: email,
    subject: subject,
    html: message,
  };

  await transporter.sendMail(mailOptions);
};

export const sendConfirmationEmail = async (email: string, userName: string) => {
  const message = `<p>Congratulations ${userName}, your account has been successfully verified as a Buyer. You can now start shopping on our platform.</p>`;
  await sendEmail(email, "Account Verified", message);
};

// Seller Verification Email
export const sendSellerVerificationEmail = async (email: string, userName: string) => {
  const message = `<p>Dear ${userName}, you have successfully applied as a Seller. Your verification process is now under review. We will notify you once it is completed.</p>`;
  await sendEmail(email, "Seller Registration Update", message);
};
