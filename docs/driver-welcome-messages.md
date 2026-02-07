# Driver Welcome & Onboarding Messages

## Automated Welcome Messages for Founding Drivers

These messages are sent automatically after a driver is approved and added to the internal testing program.

---

## Telegram Welcome Sequence

### Message 1: Welcome (Immediate)

**Spanish:**
```
Bienvenido a Travony, Conductor Fundador de CDMX.

Eres uno de los primeros 10 conductores en probar nuestra plataforma. Tu feedback es muy importante para nosotros.

Comandos disponibles:
/status - Ver tu estado
/earnings - Ver ganancias
/rides - Viajes recientes
/online - Conectarse
/offline - Desconectarse
/feedback [mensaje] - Enviar comentarios

Siguiente paso: Descarga la app desde el enlace que te enviamos por email.
```

**English:**
```
Welcome to Travony, CDMX Founding Driver.

You are one of the first 10 drivers to test our platform. Your feedback is very important to us.

Available commands:
/status - Check your status
/earnings - View earnings
/rides - Recent rides
/online - Go online
/offline - Go offline
/feedback [message] - Send feedback

Next step: Download the app from the link we sent to your email.
```

### Message 2: Onboarding Guide (After 1 hour)

**Spanish:**
```
Guía de inicio rápido:

1. Abre la app e inicia sesión con tu número de teléfono
2. Completa tu perfil (foto, licencia, vehículo)
3. Espera la verificación (máximo 24 horas)
4. Una vez aprobado, toca "Conectarse" para recibir viajes

Problemas? Escribe /feedback seguido de tu problema.
```

### Message 3: First Ride Tips (After approval)

**Spanish:**
```
Tu cuenta está aprobada. Estás listo para recibir viajes.

Consejos para tu primer viaje:
- Mantén la app abierta y en primer plano
- Acepta el viaje en los primeros 30 segundos
- Usa la navegación integrada
- Al terminar, confirma el pago antes de cerrar

Comisión: Solo 10% - El 90% de cada viaje es tuyo.

Buena suerte!
```

---

## WhatsApp Welcome Sequence

### Message 1: Welcome (Immediate)

**Spanish:**
```
Bienvenido a Travony

Eres conductor fundador de CDMX. Gracias por ser parte del inicio.

Escribe cualquiera de estos comandos:
- "estado" - Ver tu estado
- "ganancias" - Ver tus ganancias
- "viajes" - Ver viajes recientes
- "ayuda" - Obtener ayuda

Siguiente: Descarga la app del enlace en tu email.
```

### Message 2: Onboarding Reminder (After 24 hours if not completed)

**Spanish:**
```
Hola! Notamos que aún no completaste el registro.

Pasos:
1. Descarga la app
2. Inicia sesión con este número
3. Sube tu licencia y foto del vehículo
4. Espera aprobación (menos de 24 hrs)

Dudas? Responde a este mensaje.
```

### Message 3: Approval Notification

**Spanish:**
```
Tu cuenta fue APROBADA

Ya puedes conectarte y recibir viajes.

Recuerda:
- Comisión: Solo 10%
- Ganancias: Depósito diario
- Soporte: Este chat 24/7

Escribe "conectar" para activarte.
```

---

## Daily Check-in Message (Optional)

**Spanish:**
```
Buenos días, conductor Travony!

Resumen de ayer:
- Viajes: [X]
- Ganancias: $[X]

Pregunta del día:
"¿Qué fue lo más confuso ayer?"

Tu respuesta nos ayuda a mejorar.
```

---

## Error/Issue Response Templates

### App Crash

**Spanish:**
```
Lamentamos el problema. Estamos revisando.

Por favor:
1. Cierra la app completamente
2. Espera 30 segundos
3. Abre de nuevo

Si continúa, escribe /feedback con los detalles.
```

### Payment Issue

**Spanish:**
```
Revisando tu caso de pago.

Por favor confirma:
- Monto esperado: $[X]
- Monto recibido: $[X]
- ID del viaje: [X]

Responderemos en menos de 2 horas.
```

### Ride Assignment Issue

**Spanish:**
```
Estamos revisando el problema con la asignación de viajes.

Mientras tanto:
1. Verifica que tu GPS esté activo
2. Asegúrate de estar "conectado"
3. Mantén la app en primer plano

Escribe "estado" para verificar tu conexión.
```

---

## Feedback Collection Template

**Spanish:**
```
Gracias por tu feedback.

Lo que entendimos:
"[RESUMEN DEL FEEDBACK]"

Estado: Recibido
Prioridad: [Alta/Media/Baja]

Te avisaremos cuando esté resuelto.
```

---

## Driver Group Welcome (WhatsApp/Telegram Group)

**Spanish:**
```
Grupo de Conductores Fundadores - Travony CDMX

Bienvenidos. Este es el espacio oficial para:
- Reportar problemas
- Compartir sugerencias
- Recibir actualizaciones

Reglas:
1. Respeto mutuo
2. Sin spam ni publicidad
3. Solo temas de Travony

Admins: @[ADMIN_USERNAME]

Pregunta de inicio:
"¿Cuál es tu mayor frustración con las apps actuales?"
```

---

## Implementation Notes

### Telegram Bot Integration
These messages are sent via the `sendDriverNotification` function in `server/telegramBot.ts`.

### WhatsApp Integration
These messages are sent via the `sendDriverWhatsAppNotification` function in `server/whatsappBot.ts`.

### Timing
- Welcome: Immediate after approval
- Onboarding guide: 1 hour after welcome
- First ride tips: After driver document approval
- Daily check-in: 8:00 AM local time (optional)

### Personalization
Replace placeholders:
- `[X]` with actual numbers
- `[DRIVER_NAME]` with driver's first name
- `[ADMIN_USERNAME]` with support contact
