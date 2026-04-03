import Razorpay from 'razorpay';
import crypto from 'crypto';

if (!process.env.RAZORPAY_KEY_ID) {
  throw new Error('RAZORPAY_KEY_ID environment variable is not set');
}
if (!process.env.RAZORPAY_KEY_SECRET) {
  throw new Error('RAZORPAY_KEY_SECRET environment variable is not set');
}

const RAZORPAY_KEY_ID: string = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET: string = process.env.RAZORPAY_KEY_SECRET;

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
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
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  return expectedSignature === razorpaySignature;
}

export function getKeyId(): string {
  return RAZORPAY_KEY_ID;
}

export default razorpay;
