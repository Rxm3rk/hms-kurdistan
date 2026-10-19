package hms.archfixtures.restricted.orders.application;

import hms.archfixtures.restricted.kernel.quantity.Quantity;
import java.math.BigDecimal;

/** Violating fixture for dose-and-quantity-operations-only-in-reg-dose: Java calls the static magnitude factory. */
public final class JavaBuildsQuantity {
    /** Builds a quantity from a bare number. */
    public Quantity build() {
        return Quantity.ofMagnitude(BigDecimal.TEN, "mg");
    }
}
