import { suggestLatin, suggestArabic } from '../../frontend/apps/demo/src/proto/screens/patients/transliterate.ts';
for (const n of ['کاروان تاهیر بەکر','گوڵاڵە عوسمان ڕەشید','ڕێبین سەردار قادر','ئاسۆ کامەران یوسف','نەسرین جەلال مەحموود','شادی سەرکەوت مەحموود','هاوڕێ نەوزاد فەتاح','پەیمان شێرزاد ئەنوەر','عەبدولڕەحمان عەبدولکەریم عەبدولڕەزاق هەورامانی','لاڤین ئەکرەم تاها']) {
  console.log(n, '|', suggestLatin(n), '|', suggestArabic(n));
}
