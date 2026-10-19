import sys
from pathlib import Path
p = Path(sys.argv[1]); s = p.read_text(encoding='utf-8')
old_start = s.index('| **1.1b Hub core** |')
old_end = s.index('\n', old_start)
new = ("| **1.1b Hub core** | 1.1 | `INT-ENG-01` (base): MLLP over TLS, acknowledgement state, owned dead-letter queues, ordered replay, outbound generation from domain events, DICOM and ASTM bridge skeletons, the simulators from §3.7. WPs 1.2, 1.4, 1.7 and 1.8 add their message types here, so no other module emits HL7 v2, FHIR or DICOM (§5.2) "
       "| An ADT message round-trips over MLLP/TLS to a simulator with acknowledgement tracking; a dead-lettered message raises an owned task and an alarm; ordered replay works after a simulated outage; outbound messages come only from domain events; the DICOM and ASTM skeletons answer their simulators |")
s = s[:old_start] + new + s[old_end:]
p.write_text(s, encoding='utf-8'); print('ok')
