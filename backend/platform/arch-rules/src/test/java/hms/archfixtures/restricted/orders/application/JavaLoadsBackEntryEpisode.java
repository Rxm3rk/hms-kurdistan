package hms.archfixtures.restricted.orders.application;

import hms.archfixtures.restricted.kernel.time.BackEntryEpisode;
import java.time.Instant;
import java.util.UUID;

/** Violating fixture for back-entry-authority-only-from-back-entry-tooling: Java calls the static registry factory. */
public final class JavaLoadsBackEntryEpisode {
    /** Builds an episode outside the registry. */
    public BackEntryEpisode load() {
        return BackEntryEpisode.fromRegistry(new UUID(0, 1), Instant.EPOCH);
    }
}
