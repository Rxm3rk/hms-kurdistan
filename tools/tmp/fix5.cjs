const fs=require('fs');
function edit(p, pairs){ let s=fs.readFileSync(p,'utf8'); const crlf=s.includes('\r\n'); if(crlf) s=s.replace(/\r\n/g,'\n'); for(const [a,b] of pairs){ if(!s.includes(a)) throw new Error(p+' missing '+a.slice(0,80)); s=s.replace(a,b);} if(crlf) s=s.replace(/\n/g,'\r\n'); fs.writeFileSync(p,s); }
const base='C:/Users/Surface/hms-demo/frontend/apps/demo/src/proto/screens/patients/';
edit(base+'register-patient.tsx', [
 ["                  {t('openPatient')}\n                </Button>\n", "                  {t('openPatient')}\n                </Button>\n                <Button\n                  variant=\"ghost\"\n                  icon=\"search\"\n                  onPress={() => {\n                    onShowPatient(patient.id);\n                  }}\n                >\n                  {t('tabFind')}\n                </Button>\n"],
]);
