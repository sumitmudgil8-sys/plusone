import Razorpay from 'razorpay';
import crypto from 'crypto';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

export async function createOrder(amount: number, receipt: string, notes?: Record<string, string>) {
  const options = {
    amount: Math.round(amount * 100), // Razorpay expects paise
    currency: 'INR',
    receipt,
    notes,
  };

  return await razorpay.orders.create(options);
}

export function verifyPayment(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
): boolean {
  const body = razorpayOrderId + '|' + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(body)
    .digest('hex');

  return expectedSignature === razorpaySignature;
}

export function getKeyId(): string {
  return process.env.RAZORPAY_KEY_ID || '';
}

export default razorpay;
