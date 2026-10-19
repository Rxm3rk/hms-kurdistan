package hms.archfixtures.restricted.orders.application;

import hms.archfixtures.restricted.kernel.time.EntryTimePolicy;
import hms.archfixtures.restricted.kernel.time.EnvironmentClass;
import hms.archfixtures.restricted.kernel.time.ResolvedValue;
import java.util.function.BiFunction;

/** Violating fixture for safety-parameter-factories-only-in-resolvers: a Java method reference to the factory. */
public final class JavaReferencesEntryTimePolicy {
    /** Hands out the factory as a function. */
    public BiFunction<ResolvedValue, EnvironmentClass, EntryTimePolicy> factory() {
        return EntryTimePolicy::fromResolved;
    }
}
