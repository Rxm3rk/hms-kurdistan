/** Texts of the emar screen (en, ckb, ar). AI-drafted ckb and ar, unreviewed. */
import { defineMessages } from '../../i18n/use-t.ts';

export const messages = defineMessages({
  en: {
    title: "Medication (eMAR)",
    subtitle: "Today's medicines: due, given and held",
    placeholder: "This screen is being built.",
    placeholderBody: "The prototype shell, data and helpers are ready; the screen builder fills this in.",
  },
  ckb: {
    title: "دەرمان (eMAR)",
    subtitle: "دەرمانەکانی ئەمڕۆ: کاتی هاتووە، دراوە و ڕاگیراوە",
    placeholder: "ئەم پەڕەیە لە دروستکردندایە.",
    placeholderBody: "چوارچێوە، داتا و یارمەتیدەرەکانی نموونەکە ئامادەن؛ دروستکەری پەڕەکە ئەمە پڕ دەکاتەوە.",
  },
  ar: {
    title: "الأدوية (eMAR)",
    subtitle: "أدوية اليوم: المستحقة والمعطاة والموقوفة",
    placeholder: "هذه الشاشة قيد الإنشاء.",
    placeholderBody: "إطار النموذج والبيانات والأدوات جاهزة؛ سيكمل منشئ الشاشة هذا الجزء.",
  },
});
