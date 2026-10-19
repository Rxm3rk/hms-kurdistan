package hms.archfixtures.restricted.orders.application;

import hms.archfixtures.restricted.kernel.quantity.GovernedThreshold;
import hms.archfixtures.restricted.kernel.time.EnvironmentClass;
import hms.archfixtures.restricted.kernel.time.ResolvedValue;

/** Violating fixture for safety-parameter-factories-only-in-resolvers: Java builds the SI-05 threshold. */
public final class JavaBuildsGovernedThreshold {
    /** Builds a threshold outside the resolvers. */
    public GovernedThreshold build() {
        return GovernedThreshold.fromResolved(new ResolvedValue("medications.factor"), EnvironmentClass.TEST);
    }
}
