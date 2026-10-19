package hms.archfixtures.restricted.orders.application;

import hms.archfixtures.restricted.kernel.time.EntryTimePolicy;
import hms.archfixtures.restricted.kernel.time.EnvironmentClass;
import hms.archfixtures.restricted.kernel.time.ResolvedValue;

/** Violating fixture for safety-parameter-factories-only-in-resolvers: Java calls the static factory. */
public final class JavaBuildsEntryTimePolicy {
    /** Builds a policy outside the resolvers. */
    public EntryTimePolicy build() {
        return EntryTimePolicy.fromResolved(new ResolvedValue("platform.time.entry.x"), EnvironmentClass.TEST);
    }
}
