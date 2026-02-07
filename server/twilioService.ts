import twilio from 'twilio';

// Read env vars dynamically to handle hot-reloading of secrets
function getAccountSid() { return process.env.TWILIO_ACCOUNT_SID; }
function getAuthToken() { return process.env.TWILIO_AUTH_TOKEN; }
function getFromNumber() { return process.env.TWILIO_PHONE_NUMBER; }
function getMessagingServiceSid() { return process.env.TWILIO_MESSAGING_SERVICE_SID; }
function getWhatsappNumber() { return process.env.TWILIO_WHATSAPP_NUMBER; }
function getVerifyServiceSid() { return process.env.TWILIO_VERIFY_SERVICE_SID; }
function getIndiaSenderId() { return process.env.TWILIO_INDIA_SENDER_ID || 'TRAVNY'; }
function getIndiaDltEntityId() { return process.env.TWILIO_INDIA_DLT_ENTITY_ID; }
function getIndiaDltTemplateId() { return process.env.TWILIO_INDIA_DLT_TEMPLATE_ID; }

// Log Twilio configuration at module load (may show NOT SET initially if secrets haven't propagated)
console.log(`Twilio Config: Verify=${getVerifyServiceSid() ? 'SET' : 'NOT SET'}, MessagingService=${getMessagingServiceSid() ? 'SET' : 'NOT SET'}, PhoneNumber=${getFromNumber() ? 'SET' : 'NOT SET'}`);

let client: twilio.Twilio | null = null;
let lastAccountSid: string | undefined = undefined;

function getClient(): twilio.Twilio | null {
  const accountSid = getAccountSid();
  const authToken = getAuthToken();
  
  if (!accountSid || !authToken) {
    console.log('Twilio: Not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
    return null;
  }
  
  // Recreate client if credentials changed (secrets hot-reload)
  if (!client || lastAccountSid !== accountSid) {
    client = twilio(accountSid, authToken);
    lastAccountSid = accountSid;
  }
  
  return client;
}

// ============ TWILIO VERIFY API (Production OTP - works globally) ============

export async function sendVerifyOtp(to: string): Promise<{ success: boolean; error?: string; channel?: string }> {
  const twilioClient = getClient();
  const verifyServiceSid = getVerifyServiceSid();
  
  if (!twilioClient || !verifyServiceSid) {
    console.log('Twilio Verify not configured. Falling back to SMS.');
    return { success: false, error: 'Verify service not configured' };
  }
  
  try {
    let cleanTo = to.trim().replace(/\s+/g, '');
    if (!cleanTo.startsWith('+')) {
      cleanTo = '+' + cleanTo;
    }
    
    console.log(`Sending Twilio Verify OTP to ${cleanTo}`);
    
    const verification = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verifications.create({ 
        to: cleanTo, 
        channel: 'sms'
      });
    
    console.log(`Verify OTP sent to ${cleanTo}, status: ${verification.status}`);
    return { success: true, channel: 'verify' };
  } catch (error: any) {
    console.error('Twilio Verify error:', error.message, 'Code:', error.code);
    return { success: false, error: error.message };
  }
}

export async function checkVerifyOtp(to: string, code: string): Promise<{ success: boolean; error?: string }> {
  const twilioClient = getClient();
  const verifyServiceSid = getVerifyServiceSid();
  
  if (!twilioClient || !verifyServiceSid) {
    return { success: false, error: 'Verify service not configured' };
  }
  
  try {
    let cleanTo = to.trim().replace(/\s+/g, '');
    if (!cleanTo.startsWith('+')) {
      cleanTo = '+' + cleanTo;
    }
    
    const verificationCheck = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({ to: cleanTo, code });
    
    if (verificationCheck.status === 'approved') {
      console.log(`Verify OTP approved for ${cleanTo}`);
      return { success: true };
    } else {
      console.log(`Verify OTP rejected for ${cleanTo}, status: ${verificationCheck.status}`);
      return { success: false, error: 'Invalid code' };
    }
  } catch (error: any) {
    console.error('Twilio Verify check error:', error.message);
    return { success: false, error: error.message };
  }
}

export function isVerifyConfigured(): boolean {
  return !!(getAccountSid() && getAuthToken() && getVerifyServiceSid());
}

export async function sendOtpWhatsApp(to: string, otp: string): Promise<{ success: boolean; error?: string }> {
  const twilioClient = getClient();
  const whatsappNumber = getWhatsappNumber();
  
  if (!twilioClient || !whatsappNumber) {
    console.error('Twilio WhatsApp not configured. Set TWILIO_WHATSAPP_NUMBER.');
    return { success: false, error: 'WhatsApp service not configured' };
  }
  
  try {
    let cleanTo = to.trim().replace(/\s+/g, '');
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

// Check if phone number is from India
function isIndianNumber(phone: string): boolean {
  const cleaned = phone.replace(/\s+/g, '').replace(/^0+/, '');
  return cleaned.startsWith('+91') || cleaned.startsWith('91');
}

export async function sendOtpSms(to: string, otp: string): Promise<{ success: boolean; error?: string }> {
  const twilioClient = getClient();
  const messagingServiceSid = getMessagingServiceSid();
  const fromNumber = getFromNumber();
  const INDIA_SENDER_ID = getIndiaSenderId();
  const INDIA_DLT_ENTITY_ID = getIndiaDltEntityId();
  const INDIA_DLT_TEMPLATE_ID = getIndiaDltTemplateId();
  
  const hasMessagingService = !!messagingServiceSid;
  const hasFromNumber = !!fromNumber;
  
  if (!twilioClient || (!hasMessagingService && !hasFromNumber)) {
    console.error('Twilio not configured. Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER.');
    return { success: false, error: 'SMS service not configured' };
  }
  
  try {
    let cleanTo = to.trim().replace(/\s+/g, '');
    if (!cleanTo.startsWith('+')) {
      cleanTo = '+' + cleanTo;
    }
    
    const isIndia = isIndianNumber(cleanTo);
    
    const messageOptions: any = {
      body: `Your Travony verification code is: ${otp}. Valid for 5 minutes.`,
      to: cleanTo,
    };
    
    if (isIndia) {
      if (hasMessagingService) {
        messageOptions.messagingServiceSid = messagingServiceSid;
        console.log(`Attempting India SMS via Messaging Service to ${cleanTo}`);
      } else if (INDIA_SENDER_ID) {
        messageOptions.from = INDIA_SENDER_ID;
        console.log(`Attempting India SMS via Sender ID ${INDIA_SENDER_ID} to ${cleanTo}`);
      } else {
        messageOptions.from = fromNumber;
        console.log(`Attempting India SMS via phone number to ${cleanTo} (may fail without DLT)`);
      }
      
      if (INDIA_DLT_ENTITY_ID && INDIA_DLT_TEMPLATE_ID) {
        messageOptions.contentVariables = JSON.stringify({ 1: otp });
        console.log(`Using DLT Entity: ${INDIA_DLT_ENTITY_ID}, Template: ${INDIA_DLT_TEMPLATE_ID}`);
      }
    } else {
      if (hasMessagingService) {
        messageOptions.messagingServiceSid = messagingServiceSid;
        console.log(`Attempting SMS via Messaging Service to ${cleanTo}`);
      } else {
        messageOptions.from = fromNumber;
        console.log(`Attempting SMS via phone number to ${cleanTo}`);
      }
    }
    
    await twilioClient.messages.create(messageOptions);
    
    console.log(`SMS sent successfully to ${to}${isIndia ? ' (India)' : ''}`);
    return { success: true };
  } catch (error: any) {
    console.error('Twilio SMS error:', error.message, 'Code:', error.code, 'Status:', error.status);
    
    // Provide helpful error messages for India-specific issues
    if (isIndianNumber(to)) {
      if (error.code === 21408 || error.message?.includes('permission')) {
        return { 
          success: false, 
          error: 'India SMS requires DLT registration. Please complete Twilio India setup.' 
        };
      }
      if (error.code === 21610 || error.message?.includes('unsubscribed')) {
        return { 
          success: false, 
          error: 'This number has opted out of SMS. Please use WhatsApp instead.' 
        };
      }
    }
    
    return { success: false, error: error.message };
  }
}

export async function sendOtp(to: string, otp: string, preferWhatsApp: boolean = true): Promise<{ success: boolean; error?: string; channel?: string }> {
  const isIndia = isIndianNumber(to);
  const whatsappNumber = getWhatsappNumber();
  
  // Try WhatsApp if preferWhatsApp is true and configured
  if (preferWhatsApp && whatsappNumber) {
    console.log(`${isIndia ? 'India number detected - ' : ''}Trying WhatsApp first for ${to}`);
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
  return !!(getAccountSid() && getAuthToken() && (getFromNumber() || getMessagingServiceSid() || getWhatsappNumber()));
}

export function isWhatsAppConfigured(): boolean {
  return !!(getAccountSid() && getAuthToken() && getWhatsappNumber());
}
