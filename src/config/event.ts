/**
 * The one place to edit the invitation.
 * The page, countdown, share text and social-preview tags all read from here.
 */
export const event = {
  groom: { ar: 'علي', en: 'Ali' },
  bride: { ar: 'رند', en: 'Rand' },
  namesAr: 'علي ورند',

  /** The paper: 'blush' or 'ivory'. Each palette is a few lines at the top of src/styles/base.css. */
  theme: 'blush' as 'blush' | 'ivory',

  /** Start of the celebration as wall-clock time in `timeZone`. There is deliberately no end time. */
  date: '2026-11-26',
  time: '16:00',
  timeZone: 'Asia/Baghdad',

  venue: {
    name: 'مزرعة غزل',
    area: 'الدورة – البوعيثة',
    full: 'مزرعة غزل – الدورة – البوعيثة',
    mapsUrl: 'https://maps.app.goo.gl/MHSG1Es7NzxsDXX79?g_st=ic',
  },

  text: {
    envelopeTitle: 'لديكم دعوة خاصة',
    envelopeHint: 'اضغط لفتح الظرف',
    cardHint: 'اضغط لفتح بطاقة الدعوة',
    cardCaption: 'دعوة حفل الخطوبة',
    bismillah: 'بسم الله الرحمن الرحيم',
    /** Quranic verse: keep exactly as supplied. */
    verse: '﴿وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنْفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً﴾',
    intro: ['بكل الحب والسرور', 'نتشرف بدعوتكم لحضور حفل خطوبة'],
    dayLine: 'وذلك يوم الخميس',
    dateLine: '26 نوفمبر 2026',
    timeLine: 'الساعة الرابعة مساءً',
    closing: 'حضوركم يكتمل به فرحنا',
    /** Small headings over the countdown and the venue. */
    countdownTitle: 'الوقت المتبقي',
    venueTitle: 'مكان الحفل',
    mapButton: 'موقع الحفل',
    shareButton: 'شارك الدعوة',
  },

  /** Link preview shown by WhatsApp and other apps. */
  share: {
    title: 'علي ورند – دعوة حفل الخطوبة',
    description: 'بكل الحب والسرور، نتشرف بمشاركتكم فرحتنا وحضور حفل خطوبة علي ورند.',
  },

  /** File inside /public. Replace the file to change the music. */
  music: { src: 'audio/engagement-waltz.mp3', volume: 0.7 },
} as const;
