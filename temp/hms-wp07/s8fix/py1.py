from pathlib import Path
p=Path('capture.py'); s=p.read_text(encoding='utf-8')
def rep(a,b):
    global s
    assert a in s, a[:60]
    s=s.replace(a,b)
rep('''        if max_job_bytes < 1 or idle_timeout <= 0 or max_connections < 1 or max_jobs < 1 or max_stored_bytes < 1:
            raise ValueError("max_job_bytes, idle_timeout, max_connections, max_jobs and max_stored_bytes must be positive")''','''        limits = (max_job_bytes, idle_timeout, max_connections, max_jobs, max_stored_bytes)
        if any(limit <= 0 for limit in limits):
            raise ValueError("the job size, idle timeout, connection, job and byte limits must be positive")''')
rep('''    # The name the first version used; kept for callers of it.
    reject_oversized = reject

''','')
rep('''    def process_request(self, request, client_address) -> None:  # type: ignore[override]''','''    def process_request(self, request, client_address) -> None:''')
rep('''    def process_request_thread(self, request, client_address) -> None:  # type: ignore[override]''','''    def process_request_thread(self, request, client_address) -> None:''')
rep('''                descriptor = os.open(part, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), 0o600)''','''                descriptor = os.open(part, _CREATE_NEW, 0o600)''')
rep('''                _fsync_write(os.open(part, os.O_WRONLY | os.O_TRUNC | getattr(os, "O_BINARY", 0)), data)''','''                _fsync_write(os.open(part, os.O_WRONLY | os.O_TRUNC | _O_BINARY), data)''')
rep('''                    os.open(metadata_tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), 0o600),''','''                    os.open(metadata_tmp, _CREATE_NEW, 0o600),''')
rep('''_PART_SUFFIX = ".part"
''','''_PART_SUFFIX = ".part"
_O_BINARY = getattr(os, "O_BINARY", 0)  # Windows only; without it Windows would translate line ends
_CREATE_NEW = os.O_WRONLY | os.O_CREAT | os.O_EXCL | _O_BINARY
''')
rep('''def _fsync_write(handle_fd: int, data: bytes) -> None:
    with os.fdopen(handle_fd, "wb") as handle:''','''def _fsync_write(descriptor: int, data: bytes) -> None:
    with os.fdopen(descriptor, "wb") as handle:''')
rep('''    parser.add_argument("--max-connections", default=DEFAULT_MAX_CONNECTIONS, type=int,
                        help=f"connections served at once; more are closed unread (default {DEFAULT_MAX_CONNECTIONS})")''','''    parser.add_argument("--max-connections", default=DEFAULT_MAX_CONNECTIONS, type=int,
                        help=f"connections at once; more are closed unread (default {DEFAULT_MAX_CONNECTIONS})")''')
rep('''                        help=f"bytes stored in one run; later jobs are rejected (default {DEFAULT_MAX_STORED_BYTES})")''','''                        help=f"bytes stored in one run; later jobs are rejected (default {DEFAULT_MAX_STORED_BYTES})")''')
p.write_text(s,encoding='utf-8')
