import { BaseAdapter, QuoteResult, ExecuteResult, FinalizeResult } from '../base-adapter.js';
import { getPrice } from '../../pricing.service.js';

export class TwilioAdapter extends BaseAdapter {
  slug = 'twilio';

  async quote(_body: unknown): Promise<QuoteResult> {
    const pricing = await getPrice('twilio', 'sms');
    return { operation: 'sms', quotedSats: pricing.priceSats };
  }

  async execute(body: unknown): Promise<ExecuteResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    if (!accountSid) throw new Error('TWILIO_ACCOUNT_SID is not set');
    if (!authToken) throw new Error('TWILIO_AUTH_TOKEN is not set');
    if (!fromNumber) throw new Error('TWILIO_FROM_NUMBER is not set');

    const { Body, To } = body as { Body: string; To: string };

    const params = new URLSearchParams();
    params.set('Body', Body);
    params.set('To', To);
    params.set('From', fromNumber);

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );

    const data = await res.json();

    return {
      status: res.status,
      data,
      headers: Object.fromEntries(res.headers.entries()),
    };
  }

  async finalize(_response: ExecuteResult, quotedSats: number): Promise<FinalizeResult> {
    return { finalSats: quotedSats };
  }
}

export const twilioAdapter = new TwilioAdapter();
