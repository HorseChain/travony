import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

// Log Twilio configuration at module load
console.log(`Twilio Config: MessagingService=${messagingServiceSid ? 'SET' : 'NOT SET'}, PhoneNumber=${fromNumber ? 'SET' : 'NOT SET'}, WhatsApp=${whatsappNumber ? 'SET' : 'NOT SET'}`);

let client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio | null {
  if (!accountSid || !authToken) {
    console.log('Twilio: Not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
    return null;
  }
  
  if (!client) {
    client = twilio(accountSid, authToken);
  }
  
  return client;
}

export async function sendOtpWhatsApp(to: string, otp: string): Promise<{ success: boolean; error?: string }> {
  const twilioClient = getClient();
  
  if (!twilioClient || !whatsappNumber) {
    console.error('Twilio WhatsApp not configured. Set TWILIO_WHATSAPP_NUMBER.');
    return { success: false, error: 'WhatsApp service not configured' };
  }
  
  try {
    // Ensure proper E.164 format for the recipient
    let cleanTo = to.trim().replace(/\s+/g, '');
    // Add + if missing for international format
    if (!cleanTo.startsWith('+') && !cleanTo.startsWith('whatsapp:')) {
      cleanTo = '+' + cleanTo;
    }
    
    const cleanNumber = whatsappNumber.trim().replace(/\s+/g, '');
    const whatsappTo = cleanTo.startsWith('whatsapp:') ? cleanTo : `whatsapp:${cleanTo}`;
    const whatsappFrom = cleanNumber.startsWith('whatsapp:') ? cleanNumber : `whatsapp:${cleanNumber}`;
    
    console.log(`Attempting WhatsApp OTP to: ${whatsappTo} from: ${whatsappFrom}`);
    
    await twilioClient.messages.create({
      body: `Your Travony verification code is: ${otp}. Valid for 5 minutes.`,
      from: whatsappFrom,
      to: whatsappTo,
    });
    
    console.log(`WhatsApp OTP sent successfully to ${to}`);
    return { success: true };
  } catch (error: any) {
    console.error('Twilio WhatsApp error:', error.message, 'Code:', error.code, 'Status:', error.status);
    return { success: false, error: error.message };
  }
}

export async function sendOtpSms(to: string, otp: string): Promise<{ success: boolean; error?: string }> {
  const twilioClient = getClient();
  
  const hasMessagingService = !!messagingServiceSid;
  const hasFromNumber = !!fromNumber;
  
  if (!twilioClient || (!hasMessagingService && !hasFromNumber)) {
    console.error('Twilio not configured. Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER.');
    return { success: false, error: 'SMS service not configured' };
  }
  
  try {
    // Ensure proper E.164 format for the recipient
    let cleanTo = to.trim().replace(/\s+/g, '');
    // Add + if missing for international format
    if (!cleanTo.startsWith('+')) {
      cleanTo = '+' + cleanTo;
    }
    
    const messageOptions: any = {
      body: `Your Travony verification code is: ${otp}. Valid for 5 minutes.`,
      to: cleanTo,
    };
    
    if (hasMessagingService) {
      messageOptions.messagingServiceSid = messagingServiceSid;
      console.log(`Attempting SMS via Messaging Service to ${cleanTo}`);
    } else {
      messageOptions.from = fromNumber;
      console.log(`Attempting SMS via phone number to ${cleanTo}`);
    }
    
    await twilioClient.messages.create(messageOptions);
    
    console.log(`SMS sent successfully to ${to}`);
    return { success: true };
  } catch (error: any) {
    console.error('Twilio SMS error:', error.message, 'Code:', error.code, 'Status:', error.status);
    return { success: false, error: error.message };
  }
}

export async function sendOtp(to: string, otp: string, preferWhatsApp: boolean = true): Promise<{ success: boolean; error?: string; channel?: string }> {
  if (preferWhatsApp && whatsappNumber) {
    const result = await sendOtpWhatsApp(to, otp);
    if (result.success) {
      return { ...result, channel: 'whatsapp' };
    }
    console.log('WhatsApp failed, falling back to SMS');
  }
  
  const smsResult = await sendOtpSms(to, otp);
  return { ...smsResult, channel: 'sms' };
}

export function isTwilioConfigured(): boolean {
  return !!(accountSid && authToken && (fromNumber || messagingServiceSid || whatsappNumber));
}

export function isWhatsAppConfigured(): boolean {
  return !!(accountSid && authToken && whatsappNumber);
}
