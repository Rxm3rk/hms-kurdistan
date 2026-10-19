const fs=require('fs');
function edit(p, pairs){ let s=fs.readFileSync(p,'utf8'); const crlf=s.includes('\r\n'); if(crlf) s=s.replace(/\r\n/g,'\n'); for(const [a,b,all] of pairs){ if(!s.includes(a)) throw new Error(p+' missing '+a.slice(0,80)); s= all? s.split(a).join(b) : s.replace(a,b);} if(crlf) s=s.replace(/\n/g,'\r\n'); fs.writeFileSync(p,s); }
const base='C:/Users/Surface/hms-demo/frontend/apps/demo/src/proto/screens/patients/';
edit(base+'find-patient.tsx', [
 [" onPress={onOpen} isDisabled={session}>", " onPress={onOpen}>"],
 ["onPress={() => { onOpen('chart'); }} isDisabled={session}>", "onPress={() => { onOpen('chart'); }}>"],
 ["onPress={() => { onOpen('billing'); }} isDisabled={session}>", "onPress={() => { onOpen('billing'); }}>"],
]);
edit(base+'register-patient.tsx', [
 ["                  onPress={() => {\n                    onShowPatient(patient.id);\n                  }}", "                  onPress={() => {\n                    openPatient(patient.id, 'chart');\n                  }}"],
]);
edit(base+'messages.ts', [
 ["'Prototype limit: a patient registered in this session can be found, given a wristband and checked in as a walk-in, but the record screens (chart, orders, medication, laboratory, billing) open only patients of the synthetic data.'",
  "'New record: this patient was registered in this browser session, so the chart, orders, medication, laboratory and billing screens open empty. A page reload forgets the registration.'"],
 ["'سنووری نموونەکە: نەخۆشێک کە لەم دانیشتنەدا تۆمار کراوە دەدۆزرێتەوە، دەستبەندی بۆ چاپ دەکرێت و وەک سەردانی بێ کات وەردەگیرێت، بەڵام پەڕەکانی دۆسیە (دۆسیە، داواکارییەکان، دەرمان، تاقیگە، پارەدان) تەنها نەخۆشانی داتای دەستکرد دەکەنەوە.'",
  "'تۆماری نوێ: ئەم نەخۆشە لەم دانیشتنەی وێبگەڕەکەدا تۆمار کراوە، بۆیە پەڕەکانی دۆسیە، داواکارییەکان، دەرمان، تاقیگە و پارەدان بە بەتاڵی دەکرێنەوە. نوێکردنەوەی پەڕەکە تۆمارەکە لەبیر دەکات.'"],
 ["'حدود النموذج: يمكن البحث عن المريض المسجَّل في هذه الجلسة وطباعة سوار له وتسجيل وصوله كمراجع بلا موعد، لكن شاشات الملف (الملف الطبي، الأوامر، الأدوية، المختبر، الفوترة) تفتح مرضى البيانات التجريبية فقط.'",
  "'سجل جديد: سُجّل هذا المريض في جلسة المتصفح الحالية، لذا تُفتح شاشات الملف الطبي والأوامر والأدوية والمختبر والفوترة فارغة. إعادة تحميل الصفحة تمحو التسجيل.'"],
]);
