import { db } from "./db";
import { translations, rideMessages } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const QUICK_REPLIES: Record<string, Record<string, string>> = {
  en: {
    "arriving_soon": "I'm arriving soon",
    "im_here": "I'm here at the pickup point",
    "waiting": "I'm waiting for you",
    "on_my_way": "On my way!",
    "stuck_traffic": "Stuck in traffic, will be there soon",
    "wrong_location": "I think the location is wrong",
    "call_me": "Please call me",
    "thank_you": "Thank you!",
    "5_minutes": "I'll be there in 5 minutes",
    "2_minutes": "I'll be there in 2 minutes",
    "looking_for_you": "I'm looking for you",
    "near_entrance": "I'm near the entrance",
    "wait_please": "Please wait, I'm coming",
    "change_pickup": "Can we change the pickup point?",
    "confirm_destination": "Can you confirm the destination?",
  },
  ar: {
    "arriving_soon": "سأصل قريباً",
    "im_here": "أنا هنا في نقطة الالتقاء",
    "waiting": "أنا في انتظارك",
    "on_my_way": "في الطريق!",
    "stuck_traffic": "عالق في المرور، سأصل قريباً",
    "wrong_location": "أعتقد أن الموقع خاطئ",
    "call_me": "من فضلك اتصل بي",
    "thank_you": "شكراً لك!",
    "5_minutes": "سأصل خلال 5 دقائق",
    "2_minutes": "سأصل خلال دقيقتين",
    "looking_for_you": "أبحث عنك",
    "near_entrance": "أنا قرب المدخل",
    "wait_please": "انتظر من فضلك، أنا قادم",
    "change_pickup": "هل يمكننا تغيير نقطة الالتقاء؟",
    "confirm_destination": "هل يمكنك تأكيد الوجهة؟",
  },
  ru: {
    "arriving_soon": "Скоро буду",
    "im_here": "Я на месте",
    "waiting": "Жду вас",
    "on_my_way": "Еду!",
    "stuck_traffic": "Застрял в пробке, скоро буду",
    "wrong_location": "Кажется, адрес неверный",
    "call_me": "Позвоните мне, пожалуйста",
    "thank_you": "Спасибо!",
    "5_minutes": "Буду через 5 минут",
    "2_minutes": "Буду через 2 минуты",
    "looking_for_you": "Ищу вас",
    "near_entrance": "Я у входа",
    "wait_please": "Подождите, пожалуйста",
    "change_pickup": "Можем поменять точку посадки?",
    "confirm_destination": "Подтвердите пункт назначения",
  },
  hi: {
    "arriving_soon": "मैं जल्द आ रहा हूं",
    "im_here": "मैं पिकअप पॉइंट पर हूं",
    "waiting": "मैं आपका इंतजार कर रहा हूं",
    "on_my_way": "रास्ते में हूं!",
    "stuck_traffic": "ट्रैफिक में फंसा हूं, जल्द पहुंचूंगा",
    "wrong_location": "मुझे लगता है लोकेशन गलत है",
    "call_me": "कृपया मुझे कॉल करें",
    "thank_you": "धन्यवाद!",
    "5_minutes": "5 मिनट में पहुंच रहा हूं",
    "2_minutes": "2 मिनट में पहुंच रहा हूं",
    "looking_for_you": "मैं आपको ढूंढ रहा हूं",
    "near_entrance": "मैं प्रवेश द्वार के पास हूं",
    "wait_please": "कृपया रुकें, मैं आ रहा हूं",
    "change_pickup": "क्या हम पिकअप पॉइंट बदल सकते हैं?",
    "confirm_destination": "क्या आप गंतव्य की पुष्टि कर सकते हैं?",
  },
  zh: {
    "arriving_soon": "我马上就到",
    "im_here": "我到接载点了",
    "waiting": "我在等你",
    "on_my_way": "在路上了！",
    "stuck_traffic": "堵车中，马上到",
    "wrong_location": "位置好像不对",
    "call_me": "请给我打电话",
    "thank_you": "谢谢！",
    "5_minutes": "5分钟后到",
    "2_minutes": "2分钟后到",
    "looking_for_you": "我在找你",
    "near_entrance": "我在入口附近",
    "wait_please": "请稍等，我来了",
    "change_pickup": "能换个接载点吗？",
    "confirm_destination": "请确认目的地",
  },
  es: {
    "arriving_soon": "Estoy llegando",
    "im_here": "Estoy aquí en el punto de recogida",
    "waiting": "Te estoy esperando",
    "on_my_way": "¡En camino!",
    "stuck_traffic": "Atascado en el tráfico, llegaré pronto",
    "wrong_location": "Creo que la ubicación es incorrecta",
    "call_me": "Por favor llámame",
    "thank_you": "¡Gracias!",
    "5_minutes": "Llego en 5 minutos",
    "2_minutes": "Llego en 2 minutos",
    "looking_for_you": "Te estoy buscando",
    "near_entrance": "Estoy cerca de la entrada",
    "wait_please": "Espera por favor, ya voy",
    "change_pickup": "¿Podemos cambiar el punto de recogida?",
    "confirm_destination": "¿Puedes confirmar el destino?",
  },
  fr: {
    "arriving_soon": "J'arrive bientôt",
    "im_here": "Je suis au point de prise en charge",
    "waiting": "Je vous attends",
    "on_my_way": "En route !",
    "stuck_traffic": "Bloqué dans le trafic, j'arrive bientôt",
    "wrong_location": "Je pense que l'adresse est incorrecte",
    "call_me": "Appelez-moi s'il vous plaît",
    "thank_you": "Merci !",
    "5_minutes": "J'arrive dans 5 minutes",
    "2_minutes": "J'arrive dans 2 minutes",
    "looking_for_you": "Je vous cherche",
    "near_entrance": "Je suis près de l'entrée",
    "wait_please": "Attendez s'il vous plaît, j'arrive",
    "change_pickup": "On peut changer le point de prise en charge ?",
    "confirm_destination": "Pouvez-vous confirmer la destination ?",
  },
  pt: {
    "arriving_soon": "Estou chegando",
    "im_here": "Estou aqui no ponto de embarque",
    "waiting": "Estou esperando você",
    "on_my_way": "A caminho!",
    "stuck_traffic": "Preso no trânsito, chegarei em breve",
    "wrong_location": "Acho que o local está errado",
    "call_me": "Por favor me ligue",
    "thank_you": "Obrigado!",
    "5_minutes": "Chego em 5 minutos",
    "2_minutes": "Chego em 2 minutos",
    "looking_for_you": "Estou procurando você",
    "near_entrance": "Estou perto da entrada",
    "wait_please": "Aguarde por favor, estou indo",
    "change_pickup": "Podemos mudar o ponto de embarque?",
    "confirm_destination": "Pode confirmar o destino?",
  },
  de: {
    "arriving_soon": "Ich komme gleich",
    "im_here": "Ich bin am Abholpunkt",
    "waiting": "Ich warte auf Sie",
    "on_my_way": "Bin unterwegs!",
    "stuck_traffic": "Stehe im Stau, bin bald da",
    "wrong_location": "Ich glaube der Standort ist falsch",
    "call_me": "Bitte rufen Sie mich an",
    "thank_you": "Danke!",
    "5_minutes": "Bin in 5 Minuten da",
    "2_minutes": "Bin in 2 Minuten da",
    "looking_for_you": "Ich suche Sie",
    "near_entrance": "Ich bin am Eingang",
    "wait_please": "Bitte warten Sie, ich komme",
    "change_pickup": "Können wir den Abholort ändern?",
    "confirm_destination": "Können Sie das Ziel bestätigen?",
  },
  sw: {
    "arriving_soon": "Ninakuja hivi karibuni",
    "im_here": "Niko hapa kwenye eneo la kupakia",
    "waiting": "Ninakusubiri",
    "on_my_way": "Njiani!",
    "stuck_traffic": "Nimekwama trafikini, nitafika hivi karibuni",
    "wrong_location": "Nadhani eneo ni makosa",
    "call_me": "Tafadhali nipigie simu",
    "thank_you": "Asante!",
    "5_minutes": "Nitafika dakika 5",
    "2_minutes": "Nitafika dakika 2",
    "looking_for_you": "Ninakutafuta",
    "near_entrance": "Niko karibu na mlango",
    "wait_please": "Tafadhali subiri, ninakuja",
    "change_pickup": "Tunaweza kubadilisha eneo la kupakia?",
    "confirm_destination": "Unaweza kuthibitisha mwisho?",
  },
  th: {
    "arriving_soon": "ใกล้ถึงแล้ว",
    "im_here": "ฉันอยู่ที่จุดรับแล้ว",
    "waiting": "รอคุณอยู่",
    "on_my_way": "กำลังไป!",
    "stuck_traffic": "ติดการจราจร จะถึงเร็วๆ นี้",
    "wrong_location": "ดูเหมือนตำแหน่งไม่ถูกต้อง",
    "call_me": "กรุณาโทรหาฉัน",
    "thank_you": "ขอบคุณ!",
    "5_minutes": "จะถึงใน 5 นาที",
    "2_minutes": "จะถึงใน 2 นาที",
    "looking_for_you": "กำลังหาคุณอยู่",
    "near_entrance": "อยู่ใกล้ทางเข้า",
    "wait_please": "กรุณารอสักครู่ กำลังไป",
    "change_pickup": "เปลี่ยนจุดรับได้ไหม?",
    "confirm_destination": "ยืนยันจุดหมายได้ไหม?",
  },
  vi: {
    "arriving_soon": "Tôi sắp đến",
    "im_here": "Tôi đang ở điểm đón",
    "waiting": "Tôi đang đợi bạn",
    "on_my_way": "Đang trên đường!",
    "stuck_traffic": "Đang kẹt xe, sẽ đến sớm",
    "wrong_location": "Hình như địa điểm sai rồi",
    "call_me": "Vui lòng gọi cho tôi",
    "thank_you": "Cảm ơn!",
    "5_minutes": "Tôi sẽ đến trong 5 phút",
    "2_minutes": "Tôi sẽ đến trong 2 phút",
    "looking_for_you": "Tôi đang tìm bạn",
    "near_entrance": "Tôi ở gần lối vào",
    "wait_please": "Vui lòng đợi, tôi đang đến",
    "change_pickup": "Có thể đổi điểm đón không?",
    "confirm_destination": "Bạn xác nhận điểm đến được không?",
  },
  id: {
    "arriving_soon": "Saya segera tiba",
    "im_here": "Saya di titik jemput",
    "waiting": "Saya menunggu Anda",
    "on_my_way": "Dalam perjalanan!",
    "stuck_traffic": "Terjebak macet, segera tiba",
    "wrong_location": "Sepertinya lokasi salah",
    "call_me": "Tolong hubungi saya",
    "thank_you": "Terima kasih!",
    "5_minutes": "Tiba dalam 5 menit",
    "2_minutes": "Tiba dalam 2 menit",
    "looking_for_you": "Saya mencari Anda",
    "near_entrance": "Saya di dekat pintu masuk",
    "wait_please": "Mohon tunggu, saya datang",
    "change_pickup": "Bisa ganti titik jemput?",
    "confirm_destination": "Bisa konfirmasi tujuan?",
  },
  fil: {
    "arriving_soon": "Malapit na ako",
    "im_here": "Nandito na ako sa pickup point",
    "waiting": "Hinihintay kita",
    "on_my_way": "Papunta na!",
    "stuck_traffic": "Na-traffic, darating na",
    "wrong_location": "Mali yata ang location",
    "call_me": "Paki-tawagan mo ako",
    "thank_you": "Salamat!",
    "5_minutes": "Darating sa 5 minuto",
    "2_minutes": "Darating sa 2 minuto",
    "looking_for_you": "Hinahanap kita",
    "near_entrance": "Nasa malapit ako sa entrance",
    "wait_please": "Sandali lang, parating na",
    "change_pickup": "Pwede bang palitan ang pickup?",
    "confirm_destination": "Confirm mo naman ang destination?",
  },
  tr: {
    "arriving_soon": "Yakında varıyorum",
    "im_here": "Buluşma noktasındayım",
    "waiting": "Sizi bekliyorum",
    "on_my_way": "Yoldayım!",
    "stuck_traffic": "Trafiğe takıldım, birazdan varırım",
    "wrong_location": "Konum yanlış gibi",
    "call_me": "Lütfen beni arayın",
    "thank_you": "Teşekkürler!",
    "5_minutes": "5 dakikada varırım",
    "2_minutes": "2 dakikada varırım",
    "looking_for_you": "Sizi arıyorum",
    "near_entrance": "Girişin yakınındayım",
    "wait_please": "Lütfen bekleyin, geliyorum",
    "change_pickup": "Buluşma noktasını değiştirebilir miyiz?",
    "confirm_destination": "Varış noktasını onaylayabilir misiniz?",
  },
  ja: {
    "arriving_soon": "もうすぐ着きます",
    "im_here": "乗車地点に到着しました",
    "waiting": "お待ちしています",
    "on_my_way": "向かっています！",
    "stuck_traffic": "渋滞中です、まもなく到着します",
    "wrong_location": "場所が違うようです",
    "call_me": "電話をください",
    "thank_you": "ありがとうございます！",
    "5_minutes": "5分で到着します",
    "2_minutes": "2分で到着します",
    "looking_for_you": "探しています",
    "near_entrance": "入口の近くにいます",
    "wait_please": "お待ちください、向かっています",
    "change_pickup": "乗車地点を変更できますか？",
    "confirm_destination": "目的地を確認できますか？",
  },
};

const SIMPLE_TRANSLATIONS: Record<string, Record<string, string>> = {
  "en->ar": { "hello": "مرحبا", "yes": "نعم", "no": "لا", "ok": "حسنا", "sorry": "آسف" },
  "en->ru": { "hello": "привет", "yes": "да", "no": "нет", "ok": "хорошо", "sorry": "извините" },
  "en->hi": { "hello": "नमस्ते", "yes": "हां", "no": "नहीं", "ok": "ठीक है", "sorry": "माफ़ कीजिए" },
  "en->zh": { "hello": "你好", "yes": "是", "no": "不", "ok": "好的", "sorry": "对不起" },
};

export function getQuickReplies(language: string): { key: string; text: string }[] {
  const replies = QUICK_REPLIES[language] || QUICK_REPLIES["en"];
  return Object.entries(replies).map(([key, text]) => ({ key, text }));
}

export function getQuickReplyTranslation(key: string, targetLanguage: string): string {
  const replies = QUICK_REPLIES[targetLanguage] || QUICK_REPLIES["en"];
  return replies[key] || QUICK_REPLIES["en"][key] || key;
}

export function translateMessage(
  message: string,
  fromLanguage: string,
  toLanguage: string
): string {
  if (fromLanguage === toLanguage) return message;
  
  const key = `${fromLanguage}->${toLanguage}`;
  const simpleTranslations = SIMPLE_TRANSLATIONS[key];
  
  if (simpleTranslations) {
    const lowerMessage = message.toLowerCase();
    if (simpleTranslations[lowerMessage]) {
      return simpleTranslations[lowerMessage];
    }
  }
  
  return message;
}

export async function sendRideMessage(
  rideId: string,
  senderId: string,
  senderRole: string,
  message: string,
  senderLanguage: string,
  recipientLanguage: string,
  isQuickReply: boolean = false
): Promise<{ id: string; originalMessage: string; translatedMessage: string }> {
  let translatedMessage = message;
  
  if (isQuickReply) {
    translatedMessage = getQuickReplyTranslation(message, recipientLanguage);
  } else if (senderLanguage !== recipientLanguage) {
    translatedMessage = translateMessage(message, senderLanguage, recipientLanguage);
  }
  
  const [inserted] = await db.insert(rideMessages).values({
    rideId,
    senderId,
    senderRole,
    originalMessage: message,
    originalLanguage: senderLanguage,
    translatedMessage,
    translatedLanguage: recipientLanguage,
    isQuickReply,
  }).returning();
  
  return {
    id: inserted.id,
    originalMessage: message,
    translatedMessage,
  };
}

export async function getRideMessages(rideId: string) {
  return db.select().from(rideMessages).where(eq(rideMessages.rideId, rideId));
}

export function getSupportedLanguages(): { code: string; name: string; nativeName: string }[] {
  return [
    { code: "en", name: "English", nativeName: "English" },
    { code: "ar", name: "Arabic", nativeName: "العربية" },
    { code: "ru", name: "Russian", nativeName: "Русский" },
    { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
    { code: "zh", name: "Chinese", nativeName: "中文" },
    { code: "es", name: "Spanish", nativeName: "Español" },
    { code: "fr", name: "French", nativeName: "Français" },
    { code: "pt", name: "Portuguese", nativeName: "Português" },
    { code: "de", name: "German", nativeName: "Deutsch" },
    { code: "sw", name: "Swahili", nativeName: "Kiswahili" },
    { code: "th", name: "Thai", nativeName: "ไทย" },
    { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
    { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
    { code: "fil", name: "Filipino", nativeName: "Filipino" },
    { code: "tr", name: "Turkish", nativeName: "Türkçe" },
    { code: "ja", name: "Japanese", nativeName: "日本語" },
  ];
}
