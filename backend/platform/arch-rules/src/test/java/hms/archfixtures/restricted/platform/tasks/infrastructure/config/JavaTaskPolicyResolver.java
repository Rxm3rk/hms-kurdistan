package hms.archfixtures.restricted.platform.tasks.infrastructure.config;

import hms.archfixtures.restricted.kernel.time.EntryTimePolicy;
import hms.archfixtures.restricted.kernel.time.EnvironmentClass;
import hms.archfixtures.restricted.kernel.time.ResolvedValue;

/** Compliant fixture: the platform-tasks resolver package is on the safety-parameter allow-list (platform-kernel.md §6.5). */
public final class JavaTaskPolicyResolver {
    /** Builds a policy from a resolved value. */
    public EntryTimePolicy resolve(ResolvedValue value) {
        return EntryTimePolicy.fromResolved(value, EnvironmentClass.TEST);
    }
}
