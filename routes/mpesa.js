const express = require('express');
const axios = require('axios');
const router = express.Router();

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || 'nMoELpC1MHTQNu04VDCABmrLXMLYj4QfjkGA83kouLNitOAv';
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || 'hf3pIF6DhyCxKMRZu4vYGVWquj0hyuahIr6alSiikfa7cdZwIbf446H8yCfHQpQv';
const SHORTCODE = process.env.MPESA_SHORTCODE || '174379';
const PASSKEY = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const BASE_URL = 'https://sandbox.safaricom.co.ke';

// Get access token
async function getAccessToken() {
  const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  const response = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${credentials}` } }
  );
  return response.data.access_token;
}

// Generate timestamp
function getTimestamp() {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
}

// Format phone number
function formatPhone(phone) {
  phone = phone.replace(/\s|-/g, '');
  if (phone.startsWith('0')) return '254' + phone.substring(1);
  if (phone.startsWith('+')) return phone.substring(1);
  return phone;
}

// STK Push endpoint
router.post('/stk-push', async (req, res) => {
  try {
    const { phoneNumber, amount, accountReference, description } = req.body;

    if (!phoneNumber || !amount || !accountReference) {
      return res.status(400).json({
        success: false,
        message: 'phoneNumber, amount and accountReference are required'
      });
    }

    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');
    const phone = formatPhone(phoneNumber);

    const response = await axios.post(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phone,
        PartyB: SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: process.env.CALLBACK_URL || 'https://mydomain.com/callback',
        AccountReference: accountReference,
        TransactionDesc: description || 'LDN Payment',
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.data.ResponseCode === '0') {
      res.json({
        success: true,
        message: 'Payment request sent. Enter your Mpesa PIN.',
        checkoutRequestId: response.data.CheckoutRequestID,
      });
    } else {
      res.json({
        success: false,
        message: response.data.ResponseDescription || 'Payment failed',
      });
    }
  } catch (error) {
    console.error('STK Push error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.errorMessage || 'Payment processing failed',
    });
  }
});

// Mpesa callback — Safaricom calls this after payment
router.post('/callback', (req, res) => {
  const callbackData = req.body;
  console.log('Mpesa callback received:', JSON.stringify(callbackData, null, 2));

  const resultCode = callbackData?.Body?.stkCallback?.ResultCode;
  if (resultCode === 0) {
    console.log('Payment successful');
    // Here we'll update Supabase with the transaction later
  } else {
    console.log('Payment failed or cancelled');
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// Check transaction status
router.post('/query', async (req, res) => {
  try {
    const { checkoutRequestId } = req.body;
    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

    const response = await axios.post(
      `${BASE_URL}/mpesa/stkpushquery/v1/query`,
      {
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({
      success: true,
      resultCode: response.data.ResultCode,
      resultDesc: response.data.ResultDesc,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.response?.data?.errorMessage || 'Query failed',
    });
  }
});

module.exports = router;
