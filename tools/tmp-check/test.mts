import { searchPatients, checkName, checkDob, checkIdentifier, findDuplicates, parseDob } from './search.ts';
const P = (id: string, ckb: string, ar: string, latin: string, dob: string, prec='day', phone='', mrn='') => ({ id, mrn, phone, nationalId: 'SYN-NID-199'+id.slice(-4), name: { ckb, ar, latin, ownScript: 'ckb' }, dob, dobPrecision: prec });
const pts = [
 P('SYN-PAT-0101','کاروان تاهیر بەکر','كاروان طاهر بكر','Karwan Tahir Bakr','1971-05-12','day','+964 750 000 0101','SYN-100101-1'),
 P('SYN-PAT-0102','گوڵاڵە عوسمان ڕەشید','كولاله عثمان رشيد','Gulala Osman Rashid','1938','year','+964 750 000 0102','SYN-100102-2'),
 P('SYN-PAT-0105','ئاسۆ کامەران یوسف','آسو كامران يوسف','Aso Kamaran Yousif','1990-02-02','day','+964 750 000 0105','SYN-100105-5'),
 P('SYN-PAT-0107','عەبدولڕەحمان عەبدولکەریم عەبدولڕەزاق هەورامانی','عبدالرحمن عبدالكريم عبدالرزاق الهوراماني','Abdulrahman Abdulkarim Abdulrazaq Hawramani','1950-01-20','day','+964 750 000 0107','SYN-100107-7'),
 P('SYN-PAT-0108','عەبدولڕەحمان عەبدولکەریم عەبدولموتەلیب هەورامانی','عبدالرحمن عبدالكريم عبدالمطلب الهوراماني','Abdulrahman Abdulkarim Abdulmutalib Hawramani','1962-07-04','day','+964 750 000 0108','SYN-100108-8'),
 P('SYN-PAT-0201','سامان ڕەشید قادر','سامان رشيد قادر','Saman Rashid Qadir','1980-03-08','day','+964 750 000 0201','SYN-100201-1'),
];
for (const q of ['کاروان','كاروان','Kerwan','رەشید','Abdulrahman Hawramani','SYN-100101','SYN-100101-1','0750 000 0105','٢٠/٠١/١٩٥٠','1938','Rasheed','Mohammed','ئاسو','Yusuf','100107','12/05/1971','karwan 1971']) {
  console.log(JSON.stringify(q), '=>', searchPatients(pts, q).map(h => `${h.patient.id.slice(-4)}:${h.kind}:${h.forms.join('+')}`).join(', '));
}
const k = pts[0]; const a = pts[4];
for (const n of ['Karwan Tahir Bakr','کاروان تاهیر بەکر','كاروان طاهر بكر','Karwan Tahir','Karwan Tahir Bakir','Karwan Taher Aziz','x']) console.log('name', n, checkName(k, n));
for (const n of ['Abdulrahman Abdulkarim Abdulrazaq Hawramani','عەبدولڕەحمان عەبدولکەریم عەزیز هەورامانی']) console.log('name108', n, checkName(a, n));
for (const d of ['12/05/1971','1971-05-12','١٢/٠٥/١٩٧١','1971','13/05/1971','32/01/2000']) console.log('dob', d, checkDob(k, d));
console.log('dob year-only', checkDob(pts[1], '1938'), checkDob(pts[1], '01/07/1938'));
console.log('id', checkIdentifier(k,'mrn','SYN-100101-1'), checkIdentifier(k,'mrn','100101-1'), checkIdentifier(k,'phone','0750 000 0101'), checkIdentifier(k,'phone','07500000102'));
console.log('dupe', JSON.stringify(findDuplicates(pts, { name: { ckb: 'کاروان تاهیر بەکر', ar: '', latin: 'Karwan Tahir Bakr' }, dob: parseDob('12/05/1971') }).duplicates.map(p=>p.id)));
console.log('similar', JSON.stringify(findDuplicates(pts, { name: { ckb: '', ar: '', latin: 'Abdulrahman Abdulkarim' }, dob: null }).similarNames.map(p=>p.id)));
console.log('dupe-variant', JSON.stringify(findDuplicates(pts, { name: { ckb: '', ar: '', latin: 'Karwan Tahir Bakir' }, dob: parseDob('12/05/1971') })));
